import Controller from '@ember/controller';
import {action} from '@ember/object';
import {inject} from 'reedito-admin/decorators/inject';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

export default class CreatorSignupController extends Controller {
    @service ajax;
    @service reeditoPaths;
    @service notifications;

    @inject config;

    @tracked email = '';
    @tracked requestSent = false;
    @tracked flowErrors = '';

    @action
    setEmail(event) {
        this.email = event.target.value;
    }

    @action
    submit(event) {
        event.preventDefault();
        this.requestSignupTask.perform();
    }

    @task({drop: true})
    *requestSignupTask() {
        this.flowErrors = '';

        const email = this.email.trim().toLowerCase();
        if (!email) {
            this.flowErrors = 'Enter your email address to continue.';
            return false;
        }

        try {
            const authUrl = this.reeditoPaths.url.api('authentication', 'creator-signup');
            yield this.ajax.post(authUrl, {
                dataType: 'json',
                data: {email}
            });

            this.requestSent = true;
            return true;
        } catch (error) {
            this.notifications.showAPIError(error, {key: 'creator-signup'});
            return false;
        }
    }
}
