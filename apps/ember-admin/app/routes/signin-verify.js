import UnauthenticatedRoute from 'reedito-admin/routes/unauthenticated';

export default class SigninVerifyRoute extends UnauthenticatedRoute {
    setupController(controller) {
        controller.resetData();
    }
}
