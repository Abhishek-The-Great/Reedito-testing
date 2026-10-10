import ApplicationAdapter from 'reedito-admin/adapters/application';
import SlugUrl from 'reedito-admin/utils/slug-url';

export default class Tag extends ApplicationAdapter {
    buildURL(_modelName, _id, _snapshot, _requestType, query) {
        const url = super.buildURL(...arguments);

        return SlugUrl(url, query);
    }
}
