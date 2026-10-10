import Configuration from 'ember-simple-auth/configuration';
import ENV from '../config/environment';
import reeditoPaths from '../utils/reedito-paths';
import setupSession from 'ember-simple-auth/initializers/setup-session';

export default {
    name: 'ember-simple-auth',
    initialize(registry) {
        const config = ENV['ember-simple-auth'] || {};
        config.rootURL = reeditoPaths().adminRoot;
        Configuration.load(config);

        setupSession(registry);
    }
};
