import Service, {inject as service} from '@ember/service';
import config from 'reedito-admin/config/environment';
import {tracked} from '@glimmer/tracking';

export default class MigrateService extends Service {
    @service ajax;
    @service billing;
    @service feature;
    @service router;
    @service reeditoPaths;

    // Optional external migration service. No Reedito migration host is configured by default.
    migrateUrl = config.APP.migrationUrl;
    migrateRouteRoot = '#/migrate';

    @tracked migrateWindowOpen = false;
    @tracked siteData = null;
    @tracked previousRoute = null;
    @tracked isIframeTransition = false;
    @tracked platform = null;

    get apiUrl() {
        const origin = window.location.origin;
        const subdir = this.reeditoPaths.subdir;
        const rootURL = this.router.rootURL;
        let url = this.reeditoPaths.url.join(origin, subdir, rootURL);
        url = url.replace(/\/$/, ''); // Strips the trailing slash
        return url;
    }

    async apiKey() {
        const reeditoIntegrationsUrl = this.reeditoPaths.url.api('integrations') + '?include=api_keys';
        return this.ajax.request(reeditoIntegrationsUrl).then(async (response) => {
            const ssmIntegration = response.integrations.find(r => r.slug === 'self-serve-migration');

            const key = ssmIntegration.api_keys[0].secret;

            return key;
        }).catch((error) => {
            throw error;
        });
    }

    async postMessagePayload() {
        const theKey = await this.apiKey();
        const theOwner = await this.billing.getOwnerUser();

        const payload = {
            apiUrl: this.apiUrl,
            apiKey: theKey,
            stripe: this.isStripeConnected,
            csvContentImporter: this.isCsvContentImporterEnabled,
            ghostVersion: this.reeditoVersion,
            ownerEmail: theOwner.email
        };

        return payload;
    }

    get isStripeConnected() {
        return false;
    }

    get isCsvContentImporterEnabled() {
        return this.feature.csvContentImporter ? true : false;
    }

    get reeditoVersion() {
        return config.APP.version;
    }

    constructor() {
        super(...arguments);
    }

    getIframeURL() {
        let url = this.migrateUrl;
        const params = this.router.currentRoute.params;
        if (params.platform) {
            url = url + '?platform=' + params.platform;
        }

        return url;
    }

    // Sends a route update to a child route in the migrate app, because we can't control
    // navigating to it otherwise
    sendRouteUpdate(route) {
        if (!this.migrateUrl) {
            return;
        }

        this.getMigrateIframe().contentWindow.postMessage({
            query: 'routeUpdate',
            response: route
        }, this.migrateUrl);
    }

    // Controls migrate window modal visibility and sync of the URL visible in browser
    // and the URL opened on the iframe. It is responsible to non user triggered iframe opening,
    // for example: by entering "/migrate" route in the URL or using history navigation (back and forward)
    toggleMigrateWindow(value) {
        if (this.migrateWindowOpen && value) {
            // don't attempt to open again
            return;
        }
        this.migrateWindowOpen = value;
    }

    // Controls navigation to migrate window modal which is triggered from the application UI.
    // For example: pressing "View migrate" link in navigation menu. It's main side effect is
    // remembering the route from which the action has been triggered - "previousRoute" so it
    // could be reused when closing the migrate window
    openMigrateWindow(currentRoute, childRoute) {
        if (!this.migrateUrl) {
            return;
        }

        if (this.migrateWindowOpen) {
            // don't attempt to open again
            return;
        }

        this.previousRoute = currentRoute;

        // Ensures correct "getIframeURL" calculation when syncing iframe location
        // in toggleMigrateWindow
        window.location.hash = childRoute || '/migrate';

        this.router.transitionTo(childRoute || '/migrate');
        this.toggleMigrateWindow(true);
    }

    closeMigrateWindow() {
        window.location.hash = '/settings/migration';
        this.router.transitionTo('/settings/migration');
        this.toggleMigrateWindow(false);
    }

    getMigrateIframe() {
        return document.getElementById('migrate-frame');
    }
}
