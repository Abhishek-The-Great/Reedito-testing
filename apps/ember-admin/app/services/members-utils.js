import Service, {inject as service} from '@ember/service';

export default class MembersUtilsService extends Service {
    @service settings;
    @service feature;
    @service session;
    @service store;

    paidTiers = null;

    get isMembersEnabled() {
        return this.settings.membersEnabled;
    }

    get paidMembersEnabled() {
        return false;
    }

    get isMembersInviteOnly() {
        return this.settings.membersInviteOnly;
    }

    get hasMultipleTiers() {
        return this.paidMembersEnabled && this.paidTiers && this.paidTiers.length > 1;
    }

    get hasActiveTiers() {
        return this.paidMembersEnabled && this.paidTiers && this.paidTiers.length > 0;
    }

    async fetch() {
        if (this.paidTiers !== null) {
            return;
        }

        // contributors don't have permissions to fetch tiers
        if (this.session.user && !this.session.user.isContributor) {
            return this.store.query('tier', {filter: 'type:paid+active:true', limit: 'all'}).then((tiers) => {
                this.paidTiers = tiers;
            });
        }
    }

    async reload() {
        // contributors don't have permissions to fetch tiers
        if (this.session.user && !this.session.user.isContributor) {
            return this.store.query('tier', {filter: 'type:paid+active:true', limit: 'all'}).then((tiers) => {
                this.paidTiers = tiers;
            });
        }
    }

    /**
     * Note: always use paidMembersEnabled! Only use this getter for the Stripe Connection UI.
     */
    get isStripeEnabled() {
        return false;
    }

    // Plan helpers ------------------------------------------------------------

    get isFreeChecked() {
        const allowedPlans = this.settings.portalPlans || [];
        return !!(this.settings.membersSignupAccess === 'all' && allowedPlans.includes('free'));
    }

    get isMonthlyChecked() {
        const allowedPlans = this.settings.portalPlans || [];
        return !!(this.isStripeConfigured && allowedPlans.includes('monthly'));
    }

    get isYearlyChecked() {
        const allowedPlans = this.settings.portalPlans || [];
        return !!(this.isStripeConfigured && allowedPlans.includes('yearly'));
    }
}
