import Component from '@glimmer/component';
import getUpgradeUrl from 'reedito-admin/utils/upgrade-url';
import {inject} from 'reedito-admin/decorators/inject';

export default class PublishLimitModal extends Component {
    @inject config;

    get upgradeUrl() {
        return getUpgradeUrl(this.config, '#/pro?action=checkout');
    }

    get headerMessage() {
        if (this.args.data.code === 'EMAIL_VERIFICATION_NEEDED') {
            return 'Hold up, we\'re missing some details';
        } else {
            return 'Upgrade to enable publishing';
        }
    }
}
