import ApplicationSerializer from 'reedito-admin/serializers/application';

export default class NotificationSerializer extends ApplicationSerializer {
    attrs = {
        key: {key: 'location'}
    };
}
