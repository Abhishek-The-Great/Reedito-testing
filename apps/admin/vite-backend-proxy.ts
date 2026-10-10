import type { Plugin, ProxyOptions } from 'vite';
import type { IncomingMessage } from 'http';
import { getSubdir, REEDITO_URL } from './vite.config';

/**
 * Resolves the configured Reedito site URL by calling the admin api site endpoint
 * with retries (up to 20 seconds).
 */
async function resolveReeditoSiteUrl() {
  const MAX_ATTEMPTS = 20;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const siteEndpoint = new URL('reedito/api/admin/site/', REEDITO_URL);
      const response = await fetch(siteEndpoint);
      const data = (await response.json()) as { site: { url: string } };
      return {
        url: data.site.url,
        host: new URL(data.site.url).host,
      };
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, attempt * 1000);
      });
    }
  }

  throw new Error('Failed to resolve Reedito site URL');
}

/**
 * Creates proxy configuration for Reedito Admin API requests. Rewrites cookies
 * and headers to work with Reedito's security middleware.
 */
function createAdminApiProxy(site: { url: string; host: string }): Record<string, ProxyOptions> {
  // When running the dev server against the backend on HTTPS, we need to
  // remove the same site and secure flags from the cookie. Otherwise, the
  // browser won't set it correctly since the dev server is running on HTTP.
  const rewriteCookies = (proxyRes: IncomingMessage) => {
    const cookies = proxyRes.headers['set-cookie'];
    if (Array.isArray(cookies)) {
      proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
        return cookie
          .split(';')
          .filter((v) => v.trim().toLowerCase() !== 'secure')
          .filter((v) => v.trim().toLowerCase() !== 'samesite=none')
          .join('; ');
      });
    }
  };

  const subdir = getSubdir();

  return {
    [`^${subdir}/reedito/api/.*`]: {
      target: site.url,
      changeOrigin: true,
      followRedirects: true,
      autoRewrite: true,
      cookieDomainRewrite: {
        '*': site.host,
      },
      configure(proxy) {
        proxy.on('proxyRes', rewriteCookies);
      },
    },
  };
}

/**
 * Creates proxy configuration for Ember CLI live reload script.
 */
function createEmberLiveReloadProxy(): Record<string, ProxyOptions> {
  return {
    '^/ember-cli-live-reload.js': {
      target: 'http://localhost:4200',
      changeOrigin: true,
    },
  };
}

/**
 * Vite plugin that injects proxy configurations for:
 * 1. Reedito Admin API - proxies /reedito/api requests to the Reedito backend
 * 2. Ember Live Reload - proxies ember-cli-live-reload.js to Ember dev server
 */
export function reeditoBackendProxyPlugin(): Plugin {
  let siteUrl!: { url: string; host: string };

  return {
    name: 'reedito-backend-proxy',

    async configResolved(config) {
      // Only resolve backend URL for dev/preview, not for builds or tests
      if (config.command !== 'serve' || config.mode === 'test') {
        return;
      }

      try {
        // We expect this to succeed immediately, but if the backend
        // server is getting started, it might need some time.
        // In that case, this lets the user know in case we're barking
        // up the wrong tree (aka the REEDITO_URL is wrong.)
        const timeout = setTimeout(() => {
          config.logger.info(`Trying to reach Reedito Admin API at ${REEDITO_URL}...`);
        }, 1000);

        siteUrl = await resolveReeditoSiteUrl();
        clearTimeout(timeout);

        config.logger.info(`👻 Using backend url: ${siteUrl.url}`);
      } catch (error) {
        config.logger.error(`Could not reach Reedito Admin API at: ${REEDITO_URL}

Ensure the Reedito backend is running. If needed, set the REEDITO_URL environment variable to the correct URL.
    `);

        throw error;
      }
    },

    configureServer(server) {
      if (!siteUrl) {
        return;
      }

      server.config.server.proxy = {
        ...server.config.server.proxy,
        ...createAdminApiProxy(siteUrl),
        ...createEmberLiveReloadProxy(),
      };
    },

    configurePreviewServer(server) {
      if (!siteUrl) {
        return;
      }

      server.config.preview.proxy = {
        ...server.config.preview.proxy,
        ...createAdminApiProxy(siteUrl),
      };
    },
  } as const satisfies Plugin;
}
