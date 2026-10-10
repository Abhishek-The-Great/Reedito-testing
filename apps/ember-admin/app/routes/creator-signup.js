import UnauthenticatedRoute from 'reedito-admin/routes/unauthenticated';

export default class CreatorSignupRoute extends UnauthenticatedRoute {
    model() {
        return {email: ''};
    }

    buildRouteInfoMetadata() {
        return Object.assign(super.buildRouteInfoMetadata(), {
            titleToken: 'Create a creator account'
        });
    }

    deactivate() {
        super.deactivate(...arguments);

        const controller = this.controllerFor('creator-signup');
        controller.email = '';
        controller.requestSent = false;
        controller.flowErrors = '';
    }
}
