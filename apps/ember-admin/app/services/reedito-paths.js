import Service from '@ember/service';
import classic from 'ember-classic-decorator';
import reeditoPaths from 'reedito-admin/utils/reedito-paths';

@classic
export default class ReeditoPathsService extends Service.extend(reeditoPaths()) {}
