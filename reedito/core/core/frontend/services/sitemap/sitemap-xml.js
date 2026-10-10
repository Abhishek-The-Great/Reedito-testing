"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeXml = escapeXml;
exports.getDeclarations = getDeclarations;
exports.renderUrlSet = renderUrlSet;
exports.renderSiteMapIndex = renderSiteMapIndex;
const node_path_1 = __importDefault(require("node:path"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
// Reedito renders exactly two sitemap documents, both with a shape the
// sitemaps.org schema fixes: a <urlset> per resource type, and the
// <sitemapindex> that lists them. They are emitted here directly rather than
// through a generic xml library — for a shape this fixed a library spends
// several times as long walking an object tree as writing the tags costs, and
// keeping both documents in one module keeps escaping in one auditable place.
const URLSET_OPEN = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">';
const URLSET_CLOSE = '</urlset>';
const SITEMAPINDEX_OPEN = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const SITEMAPINDEX_CLOSE = '</sitemapindex>';
// The characters the xml package escaped in text content, kept character for
// character so the rendered sitemaps do not change.
const XML_ESCAPES = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;',
};
function escapeXml(value) {
    return value.replace(/[&"'<>]/g, (char) => XML_ESCAPES[char]);
}
function getDeclarations() {
    const baseUrl = url_utils_1.default.urlFor('sitemap_xsl', true).replace(/^(http:|https:)/, '');
    return ('<?xml version="1.0" encoding="UTF-8"?>' +
        '<?xml-stylesheet type="text/xsl" href="' +
        baseUrl +
        '"?>');
}
/**
 * The <urlset> document for one page of one resource type.
 *
 * @param entries in the order they should appear
 */
function renderUrlSet(entries) {
    // Joined rather than concatenated: join returns a flat string, where
    // repeated concatenation leaves a rope whose fragments are held for as long
    // as the cached sitemap is.
    const parts = [getDeclarations(), URLSET_OPEN];
    for (const entry of entries) {
        parts.push('<url><loc>', escapeXml(entry.loc), '</loc><lastmod>', new Date(entry.ts).toISOString(), '</lastmod>');
        if (entry.imageLoc) {
            parts.push('<image:image><image:loc>', escapeXml(entry.imageLoc), '</image:loc><image:caption>', escapeXml(node_path_1.default.basename(entry.imageLoc)), '</image:caption></image:image>');
        }
        parts.push('</url>');
    }
    parts.push(URLSET_CLOSE);
    return parts.join('');
}
/**
 * The <sitemapindex> document listing every page of every resource type.
 */
function renderSiteMapIndex(entries) {
    const parts = [getDeclarations(), SITEMAPINDEX_OPEN];
    for (const entry of entries) {
        parts.push('<sitemap><loc>', escapeXml(entry.loc), '</loc><lastmod>', new Date(entry.ts).toISOString(), '</lastmod></sitemap>');
    }
    parts.push(SITEMAPINDEX_CLOSE);
    return parts.join('');
}
