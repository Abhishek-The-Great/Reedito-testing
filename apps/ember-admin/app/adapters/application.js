import EmbeddedRelationAdapter from 'reedito-admin/adapters/embedded-relation-adapter';

export default class Application extends EmbeddedRelationAdapter {
    shouldBackgroundReloadRecord() {
        return false;
    }
}
