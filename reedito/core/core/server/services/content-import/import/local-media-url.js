"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocalMediaUrl = isLocalMediaUrl;
const CONTENT_PATH_PREFIXES = ['/content/images', '/content/media', '/content/files'];
function normalizedPathPrefix(value) {
    if (!value.startsWith('/')) {
        return `/${value}`.replace(/\/+$/, '');
    }
    return value.replace(/\/+$/, '');
}
function pathHasPrefix(pathname, prefix) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
function isContentPath(pathname, subdirs) {
    const normalizedPathname = normalizedPathPrefix(pathname);
    const prefixes = subdirs.flatMap((subdir) => {
        const normalizedSubdir = normalizedPathPrefix(subdir);
        return CONTENT_PATH_PREFIXES.map((prefix) => `${normalizedSubdir}${prefix}`);
    });
    return [...CONTENT_PATH_PREFIXES, ...prefixes].some((prefix) => pathHasPrefix(normalizedPathname, prefix));
}
function parseUrl(value) {
    try {
        return new URL(value.startsWith('//') ? `https:${value}` : value);
    }
    catch {
        return undefined;
    }
}
function matchesBaseUrl(source, baseUrl) {
    const base = parseUrl(baseUrl.trim());
    if (!base || source.host !== base.host) {
        return false;
    }
    const basePath = normalizedPathPrefix(base.pathname);
    return basePath === '' || basePath === '/' || pathHasPrefix(source.pathname, basePath);
}
/**
 * Returns whether a media reference already belongs to this Reedito site or one
 * of its configured asset hosts. This only classifies URLs; it never checks
 * whether the referenced file exists.
 */
function isLocalMediaUrl(sourceUrl, options) {
    const value = sourceUrl.trim();
    if (value.startsWith('__REEDITO_URL__')) {
        return true;
    }
    if (value.startsWith('/') && !value.startsWith('//')) {
        return isContentPath(value, [options.subdir]);
    }
    const source = parseUrl(value);
    if (!source) {
        return false;
    }
    if (options.assetBaseUrls.some((baseUrl) => typeof baseUrl === 'string' && matchesBaseUrl(source, baseUrl))) {
        return true;
    }
    const site = parseUrl(options.siteUrl);
    if (!site || source.host !== site.host) {
        return false;
    }
    return isContentPath(source.pathname, [options.subdir, site.pathname]);
}
