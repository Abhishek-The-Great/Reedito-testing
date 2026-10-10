import type { Request, Response } from 'express';
import type { Entry, EntryResponse } from '../entry';
import buildCanonicalUrl from './canonical-url';

const urlUtils = require('../../../../../shared/url-utils').default;
const { getGatedNotice, getMarkdownPath, renderEntryMarkdown } = require('../../../llms/markdown');

const MEMBERS_ONLY_MARKDOWN =
  '# Members-only content\n\nThis post requires a subscription and is not available for public access.\n';

function llmsEnabled(req: Request): boolean {
  const llmsService = req.app.get('llmsService') || null;
  return Boolean(llmsService && llmsService.isEnabled());
}

/** Only public entries render in full as markdown. */
function isPublic(entry: Entry): boolean {
  return entry.visibility === 'public';
}

function serveMarkdown(res: Response, entry: Entry) {
  const llmsIndexUrl = urlUtils.urlFor({ relativeUrl: '/llms.txt' }, true);
  res.set('Content-Location', getMarkdownPath(new URL(entry.url).pathname));
  res.type('text/markdown');
  return res.send(renderEntryMarkdown(entry, { llmsIndexUrl }));
}

/** The content API does not serialize `type`, so the notice wording comes from the route. */
function getResourceKind(res: EntryResponse): 'page' | 'post' {
  return res.routerOptions.resourceType === 'pages' || res.routerOptions.context?.includes('page')
    ? 'page'
    : 'post';
}

function servePreviewMarkdown(res: EntryResponse, entry: Entry) {
  const llmsIndexUrl = urlUtils.urlFor({ relativeUrl: '/llms.txt' }, true);
  const subscribeUrl = urlUtils.urlFor({ relativeUrl: '/#/portal/signup' }, true);

  res.set('Content-Location', getMarkdownPath(new URL(entry.url).pathname));
  res.type('text/markdown');
  return res.send(
    renderEntryMarkdown(entry, {
      llmsIndexUrl,
      notice: getGatedNotice(entry, getResourceKind(res)),
      cta: `Subscribe: ${subscribeUrl}`,
    }),
  );
}

function refuseMembersOnlyMarkdown(res: Response) {
  return res.status(403).type('text/markdown').send(MEMBERS_ONLY_MARKDOWN);
}

/** Whether this is a `.md` URL request (the scoped suffix route sets the flag). */
export function isMdRequest(res: EntryResponse): boolean {
  return Boolean(res.routerOptions.isMarkdownRequest);
}

/** Serve public markdown, or a preview for gated entries. */
export async function serveMdRequest(req: Request, res: EntryResponse, entry: Entry) {
  if (!llmsEnabled(req)) {
    return res.redirect(302, buildCanonicalUrl(req, entry));
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
