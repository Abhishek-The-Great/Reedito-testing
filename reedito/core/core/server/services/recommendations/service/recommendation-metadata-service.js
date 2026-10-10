"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationMetadataService = void 0;
class RecommendationMetadataService {
    #oembedService;
    #externalRequest;
    constructor(dependencies) {
        this.#oembedService = dependencies.oembedService;
        this.#externalRequest = dependencies.externalRequest;
    }
    async #fetchJSON(url, options) {
        // Even though we have throwHttpErrors: false, we still need to catch DNS errors
        // that can arise from externalRequest, otherwise we'll return a HTTP 500 to the user
        try {
            const timeout = typeof options?.timeout === 'number' ? { request: options.timeout } : options?.timeout;
            // default content type is application/x-www-form-encoded which is what we need for the webmentions spec
            const response = await this.#externalRequest.get(url.toString(), {
                throwHttpErrors: false,
                maxRedirects: 10,
                followRedirect: true,
                timeout: {
                    request: 15000,
                },
                retry: {
                    // Only retry on network issues, or specific HTTP status codes
                    limit: 3,
                },
                ...options,
                ...(timeout ? { timeout } : {}),
            });
            if (response.statusCode >= 200 && response.statusCode < 300) {
                try {
                    return JSON.parse(response.body);
                }
                catch {
                    return undefined;
                }
            }
        }
        catch {
            return undefined;
        }
    }
    #castUrl(url) {
        if (!url) {
            return null;
        }
        try {
            return new URL(url);
        }
        catch {
            return null;
        }
    }
    async fetch(url, options = { timeout: { request: 5000 } }) {
        // Make sure url path ends with a slash (urls should be resolved relative to the path)
        if (!url.pathname.endsWith('/')) {
            url.pathname += '/';
        }
        // 1. Check if it is a Reedito site
        let reeditoSiteData = await this.#fetchJSON(new URL('members/api/site', url), options);
        if (!reeditoSiteData && url.pathname !== '' && url.pathname !== '/') {
            // Try root relative URL
            reeditoSiteData = await this.#fetchJSON(new URL('members/api/site', url.origin), options);
        }
        if (reeditoSiteData &&
            typeof reeditoSiteData === 'object' &&
            reeditoSiteData.site &&
            typeof reeditoSiteData.site === 'object') {
            // Check if the Reedito site returns allow_external_signup, otherwise it is an old Reedito version that returns unreliable data
            if (typeof reeditoSiteData.site.allow_external_signup === 'boolean') {
                return {
                    title: reeditoSiteData.site.title || null,
                    excerpt: reeditoSiteData.site.description || null,
                    featuredImage: this.#castUrl(reeditoSiteData.site.cover_image),
                    favicon: this.#castUrl(reeditoSiteData.site.icon || reeditoSiteData.site.logo),
                    oneClickSubscribe: !!reeditoSiteData.site.allow_external_signup,
                };
            }
        }
        // Use the oembed service to fetch metadata
        const oembed = await this.#oembedService.fetchOembedDataFromUrl(url.toString(), 'mention');
        return {
            title: oembed?.metadata?.title || null,
            excerpt: oembed?.metadata?.description || null,
            featuredImage: this.#castUrl(oembed?.metadata?.thumbnail),
            favicon: this.#castUrl(oembed?.metadata?.icon),
            oneClickSubscribe: false,
        };
    }
}
exports.RecommendationMetadataService = RecommendationMetadataService;
