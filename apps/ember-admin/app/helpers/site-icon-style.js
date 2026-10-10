import Helper from '@ember/component/helper';
import {htmlSafe} from '@ember/template';
import {inject} from 'reedito-admin/decorators/inject';

export default class SiteIconStyleHelper extends Helper {
    @inject config;

    compute() {
        const icon = this.config.icon || '/reedito/assets/icons/reedito-orb.svg';
        return htmlSafe(`background-image: url(${icon})`);
    }
}
