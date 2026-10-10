const hbs = require('express-hbs');
const path = require('path');
const tpl = require('@tryghost/tpl');
const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const sentry = require('../../../shared/sentry');

const config = require('../../../shared/config');
const renderer = require('../../services/rendering');
const themeEngine = require('../../services/theme-engine');

// @TODO: make this properly shared code
const {
  prepareError,
  prepareErrorCacheControl,
  prepareStack,
} = require('@tryghost/mw-error-handler');

const messages = {
  notFound: 'File not found',
  unexpectedError: 'An unexpected error occurred',
};

/**
 * This is a bare minimum setup, which allows us to render the error page
 * It uses the {{asset}} helper, and nothing more
 */
const createHbsEngine = () => {
  const engine = hbs.create();
  engine.registerHelper('asset', require('../../helpers/asset'));

  return engine.express4();
};

const getFriendlyErrorData = (statusCode) => {
  const status = Number(statusCode) || 500;

  if (status === 404) {
    return {
      statusCode: status,
      pageTitle: 'Page not found',
      headline: "We couldn't find that page.",
      description:
        'The address may be out of date or the page may have moved. Check the link, or head back to Reedito.',
    };
  }

  if (status === 401 || status === 403) {
    return {
      statusCode: status,
      pageTitle: 'Page unavailable',
      headline: "You can't open this page.",
      description: 'You may need to sign in or ask the publication owner for access.',
    };
  }

  if (status === 429) {
    return {
      statusCode: status,
      pageTitle: 'Please slow down',
      headline: 'That was a lot of requests.',
      description: 'Wait a moment, then try again.',
    };
  }

  if (status >= 500) {
    return {
      statusCode: status,
      pageTitle: 'Temporary problem',
      headline: "We couldn't continue just now.",
      description: 'Something went wrong while loading this page. Please try again in a moment.',
    };
  }

  return {
    statusCode: status,
    pageTitle: 'Request could not be completed',
    headline: "We couldn't complete that request.",
    description: 'Check the address or go back to Reedito and try again.',
  };
};

// This last-resort response is deliberately self-contained and contains no exception data.
// It is used only if rendering either a theme error template or Reedito's fallback fails.
const emergencyErrorPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f7f6f2">
    <title>Temporary problem | Reedito</title>
    <style>
      :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f6f2;color:#19352d;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(100%,620px);padding:clamp(28px,7vw,64px);border:1px solid #e5e4dc;border-radius:24px;background:#fff;box-shadow:0 20px 60px #19352d12}.brand{font-size:14px;font-weight:750;letter-spacing:.12em;text-transform:uppercase;color:#477463}.code{margin:36px 0 8px;color:#70877e;font-size:14px;font-weight:700;letter-spacing:.16em}h1{margin:0;font-size:clamp(30px,6vw,48px);line-height:1.12;letter-spacing:-.04em}p{margin:18px 0 30px;color:#52665e}.home{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border-radius:999px;background:#19352d;color:#fff;text-decoration:none;font-weight:650}.home:focus-visible{outline:3px solid #4a8b70;outline-offset:3px}
    </style>
  </head>
  <body>
    <main class="card" aria-labelledby="error-title">
      <div class="brand">Reedito</div>
      <div class="code">500 · TEMPORARY PROBLEM</div>
      <h1 id="error-title">We couldn't continue just now.</h1>
      <p>Something went wrong while loading this page. Please try again in a moment.</p>
      <a class="home" href="/">Go to Reedito home</a>
    </main>
  </body>
</html>`;

// eslint-disable-next-line no-unused-vars
const themeErrorRenderer = function themeErrorRenderer(err, req, res, next) {
  // Return a plain text response for static files. We do this because:
  // 1. Customised 404 templates could reference the missing asset causing recursion
  // 2. Static files should return plain errors, not HTML pages
  // 3. The theme engine might not be initialized on first request after boot
  const hasExtension = Boolean(path.extname(req.path));
  const isStaticFile = hasExtension || err.code === 'STATIC_FILE_NOT_FOUND';
  if (isStaticFile) {
    // Convert non-Reedito errors for static files into proper Reedito errors
    if (!errors.utils.isGhostError(err)) {
      // Convert Express static errors to Reedito errors based on status code
      if (err.statusCode === 404) {
        err = new errors.NotFoundError({
          message: tpl(messages.notFound),
          code: 'STATIC_FILE_NOT_FOUND',
          property: err.path,
        });
      } else if (err.statusCode === 400) {
        err = new errors.BadRequestError({ err: err });
      } else if (err.statusCode === 403) {
        err = new errors.NoPermissionError({ err: err });
      } else if (err.name === 'RangeNotSatisfiableError') {
        err = new errors.RangeNotSatisfiableError({ err });
      } else if (err.statusCode) {
        err = new errors.InternalServerError({ err: err });
      }
    } else if (err.statusCode === 404 && err.code !== 'STATIC_FILE_NOT_FOUND') {
      // Override the message for 404s that were already converted to NotFoundError
      // by prepareError middleware
      err.message = tpl(messages.notFound);
      err.code = 'STATIC_FILE_NOT_FOUND';
    }

    const message = err.message || tpl(messages.unexpectedError);
    const statusCode = err.statusCode || 500;

    // Send a simple plain text error response
    res.status(statusCode);
    res.type('text/plain');
    return res.send(message);
  }

  // Renderer begin
  // Format Data
  const data = {
    message: err.message,
    statusCode: err.statusCode,
    errorDetails: err.errorDetails || [],
  };

  // Template
  // @TODO: very dirty !!!!!!
  renderer.templates.setTemplate(req, res);

  // If the active theme isn't mounted into Express we cannot render a theme error template.
  // This happens when the error was thrown before the theme middleware ran (e.g. early in
  // the request pipeline, or on the first requests after a boot): the theme's engine and
  // views directory aren't set up, and neither is the per-request/global template data
  // (@site, @custom, member, ...) that theme error pages such as error-404.hbs depend on.
  // Fall back to Reedito's self-contained built-in error template instead.
  //
  // The built-in template is referenced by absolute path rather than by repointing the
  // app-wide `views` directory, because mutating `views` here persists on the Express app
  // and would break theme template lookups (e.g. error-404) on subsequent requests.
  // @TODO: split the error handler for assets, admin & theme to refactor this away
  const activeTheme = themeEngine.getActive();
  if (!activeTheme || !activeTheme.mounted) {
    res._template = path.resolve(config.get('paths').defaultViews, 'error.hbs');

    // Register the bare-minimum hbs engine if it isn't already available. We check for the
    // `hbs` engine specifically rather than testing whether req.app.engines is empty, so the
    // fallback still works if some other engine happens to be registered. Express keys
    // engines by file extension with a leading dot, hence `.hbs`.
    if (!req.app.engines || !req.app.engines['.hbs']) {
      req.app.engine('hbs', createHbsEngine());
      req.app.set('view engine', 'hbs');
    }
  }

  const builtInErrorTemplate = path.resolve(config.get('paths').defaultViews, 'error.hbs');
  if (res._template === builtInErrorTemplate) {
    // Built-in errors are public-facing. Use friendly copy and do not expose internal
    // exception messages or theme validator details in the HTML response.
    Object.assign(data, getFriendlyErrorData(err.statusCode));
    data.homeUrl = '/';
  }

  // @TODO use renderer here?!
  // Render Call - featuring an error handler for what happens if rendering fails
  res.render(res._template, data, (_err, html) => {
    if (!_err) {
      return res.send(html);
    }

    // Capture the secondary template failure when monitoring is configured, but never
    // send its message/stack to visitors.
    req.err = _err;
    logging.error('Failed to render the Reedito error page:', _err);
    try {
      sentry.captureException(_err);
    } catch {
      // Error reporting must not prevent the emergency response.
    }

    return res.status(500).type('html').send(emergencyErrorPage);
  });
};

module.exports.handleThemeResponse = [
  // Make sure the error can be served
  prepareError,
  // Add cache-control header
  prepareErrorCacheControl(),
  // Handle the error in Sentry
  sentry.errorHandler,
  // Format the stack for the user
  prepareStack,
  // Render the error using theme template
  themeErrorRenderer,
];
