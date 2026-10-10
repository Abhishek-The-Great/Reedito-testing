import Authenticator from 'ember-simple-auth/authenticators/base';
import RSVP from 'rsvp';
import {computed} from '@ember/object';
import {inject as service} from '@ember/service';

export default Authenticator.extend({
    ajax: service(),
    reeditoPaths: service(),

    sessionEndpoint: computed('reeditoPaths.apiRoot', function () {
        return `${this.reeditoPaths.apiRoot}/session`;
    }),

    sessionVerifyEndpoint: computed('reeditoPaths.apiRoot', function () {
        return `${this.reeditoPaths.apiRoot}/session/verify`;
    }),

    restore: function () {
        return RSVP.resolve();
    },

    authenticate({identification, password, token}) {
        if (token && !identification && !password) {
            const data = {token};
            const options = {
                data,
                contentType: 'application/json;charset=utf-8',
                // ember-ajax will try and parse the response as JSON if not explicitly set
                dataType: 'text'
            };

            return this.ajax.put(this.sessionVerifyEndpoint, options);
        }

        const data = {username: identification, password};

        if (token) {
            data.token = token;
        }

        const options = {
            data,
            contentType: 'application/json;charset=utf-8',
            // ember-ajax will try and parse the response as JSON if not explicitly set
            dataType: 'text'
        };

        return this.ajax.post(this.sessionEndpoint, options);
    },

    invalidate() {
        // if we're invalidating because of a 401 we can end up in an infinite
        // loop if we then try to perform a DELETE /session/ request
        // TODO: find a more elegant way to handle this
        if (this.ajax.skipSessionDeletion) {
            this.ajax.skipSessionDeletion = false;
            return RSVP.resolve();
        }

        return this.ajax.del(this.sessionEndpoint);
    }
});
