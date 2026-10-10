"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redirectAmpUrls = redirectAmpUrls;
const url_utils_1 = __importDefault(require("../../../../shared/url-utils"));
const utils_1 = require("../utils");
/**
 * Redirects AMP URLs to their non-AMP equivalent.
 *
 * 1. Detect requests whose path ends with `/amp/` (case-insensitive) or `/amp` before a query-string
 * 2. Issue a 301 redirect to the same URL without that suffix, preserving the query string.
 *
 * Needs to sit early in the public-site middleware stack so that the request never reaches
 * the dynamic routers or results in a 404.
 *
 * Example:
 *   /welcome/amp/      -> /welcome/
 *   /welcome/amp/?q=1  -> /welcome/?q=1
 */
function redirectAmpUrls(req, res, next) {
    const ampPattern = /\/amp\/?$/i;
    const url = new URL(req.url, 'http://example.com');
    if (!ampPattern.test(url.pathname)) {
        return next();
    }
    const sanitizedPath = url.pathname.replace(ampPattern, '/') + url.search;
    const redirectPath = (0, utils_1.removeOpenRedirectFromUrl)(sanitizedPath);
    return url_utils_1.default.redirect301(res, redirectPath);
}
