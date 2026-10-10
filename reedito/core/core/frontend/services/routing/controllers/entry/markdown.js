"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMdRequest = isMdRequest;
exports.serveMdRequest = serveMdRequest;
const canonical_url_1 = __importDefault(require("./canonical-url"));
const urlUtils = require('../../../../../shared/url-utils').default;
const { getGatedNotice, getMarkdownPath, renderEntryMarkdown } = require('../../../llms/markdown');
const MEMBERS_ONLY_MARKDOWN = '# Members-only content\n\nThis post requires a subscription and is not available for public access.\n';
function llmsEnabled(req) {
    const llmsService = req.app.get('llmsService') || null;
    return Boolean(llmsService && llmsService.isEnabled());
}
/** Only public entries render in full as markdown. */
function isPublic(entry) {
    return entry.visibility === 'public';
}
function serveMarkdown(res, entry) {
    const llmsIndexUrl = urlUtils.urlFor({ relativeUrl: '/llms.txt' }, true);
    res.set('Content-Location', getMarkdownPath(new URL(entry.url).pathname));
    res.type('text/markdown');
    return res.send(renderEntryMarkdown(entry, { llmsIndexUrl }));
}
/** The content API does not serialize `type`, so the notice wording comes from the route. */
function getResourceKind(res) {
    return res.routerOptions.resourceType === 'pages' || res.routerOptions.context?.includes('page')
        ? 'page'
        : 'post';
}
function servePreviewMarkdown(res, entry) {
    const llmsIndexUrl = urlUtils.urlFor({ relativeUrl: '/llms.txt' }, true);
    const subscribeUrl = urlUtils.urlFor({ relativeUrl: '/#/portal/signup' }, true);
    res.set('Content-Location', getMarkdownPath(new URL(entry.url).pathname));
    res.type('text/markdown');
    return res.send(renderEntryMarkdown(entry, {
        llmsIndexUrl,
        notice: getGatedNotice(entry, getResourceKind(res)),
        cta: `Subscribe: ${subscribeUrl}`,
    }));
}
function refuseMembersOnlyMarkdown(res) {
    return res.status(403).type('text/markdown').send(MEMBERS_ONLY_MARKDOWN);
}
/** Whether this is a `.md` URL request (the scoped suffix route sets the flag). */
function isMdRequest(res) {
    return Boolean(res.routerOptions.isMarkdownRequest);
}
/** Serve public markdown, or a preview for gated entries. */
async function serveMdRequest(req, res, entry) {
    if (!llmsEnabled(req)) {
        return res.redirect(302, (0, canonical_url_1.default)(req, entry));
    }
    if (!isPublic(entry)) {
        // A member's entry may contain full content; never expose it through the
        // public markdown endpoint or its cache path.
        if (entry.access === true) {
            return refuseMembersOnlyMarkdown(res);
        }
        return servePreviewMarkdown(res, entry);
    }
    return serveMarkdown(res, entry);
}
