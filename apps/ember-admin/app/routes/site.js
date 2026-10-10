import AuthenticatedRoute from 'reedito-admin/routes/authenticated';

export default class SiteRoute extends AuthenticatedRoute {
    model() {
        return (new Date()).valueOf();
    }

    buildRouteInfoMetadata() {
        return {
            titleToken: 'Site'
        };
    }
}
