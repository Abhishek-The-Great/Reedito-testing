export function getScript() {
  return document.currentScript || document.querySelector('script[data-reedito-admin-toolbar]');
}

export function normalizeAdminUrl(adminUrl) {
  if (!adminUrl) {
    return null;
  }

  return adminUrl.endsWith('/') ? adminUrl : `${adminUrl}/`;
}

export function getConfig(script) {
  const dataset = script?.dataset || {};
  const adminUrl = normalizeAdminUrl(dataset.reeditoAdminToolbar);

  if (!adminUrl) {
    return null;
  }

  return {
    adminUrl,
    siteTitle: dataset.siteTitle || 'Reedito',
    pageContext: dataset.pageContext || '',
    resourceType: dataset.resourceType || '',
    resourceId: dataset.resourceId || '',
    resourceSlug: dataset.resourceSlug || '',
    siteAnalyticsEnabled: dataset.siteAnalyticsEnabled === 'true',
    activityPubEnabled: dataset.activitypubEnabled === 'true',
    membersEnabled: dataset.membersEnabled === 'true',
    commentsEnabled: dataset.commentsEnabled !== 'false',
  };
}
