import ApplicationSerializer from 'reedito-admin/serializers/application';

export default class ActionSerializer extends ApplicationSerializer {
    attrs = {
        createdAtUTC: {key: 'created_at'}
    };
}
