import Helper from '@ember/component/helper';
import {inject} from 'reedito-admin/decorators/inject';

export default class EnableDeveloperExperimentsHelper extends Helper {
    @inject config;

    compute() {
        return this.config.enableDeveloperExperiments;
    }
}
