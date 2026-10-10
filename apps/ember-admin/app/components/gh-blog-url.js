import Component from '@ember/component';
import classic from 'ember-classic-decorator';
import {inject} from 'reedito-admin/decorators/inject';
import {tagName} from '@ember-decorators/component';

@classic
@tagName('')
export default class GhBlogUrl extends Component {
    @inject config;
}
