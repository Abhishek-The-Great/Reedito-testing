const urlUtils = require('../../../../shared/url-utils').default;

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function redirectAdminUrls(req, res, next) {
  const subdir = urlUtils.getSubdir();
  const reeditoPathRegex = new RegExp(`^${subdir}/reedito/(.+)`);
  const reeditoPathMatch = req.originalUrl.match(reeditoPathRegex);

  if (reeditoPathMatch) {
    // React Router's hash routes don't match a trailing slash. Strip one
    // from the pathname only — slashes inside the query string (e.g.
    // `?next=/settings/`) must be preserved.
    const captured = reeditoPathMatch[1];
    const queryIndex = captured.indexOf('?');
    const pathname = queryIndex === -1 ? captured : captured.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : captured.slice(queryIndex);
    const hashPath = pathname.replace(/\/$/, '') + query;

    return res.redirect(urlUtils.urlJoin(urlUtils.urlFor('admin'), '#', hashPath));
  }

  next();
}

module.exports = redirectAdminUrls;
