"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const serializers_1 = require("../../../../../services/members-metafields/serializers");
const serializeOne = (field, _apiConfig, frame) => {
    frame.response = serializers_1.toMetafieldsResponse.parse([field]);
};
const serializeMany = (fields, _apiConfig, frame) => {
    frame.response = serializers_1.toMetafieldsResponse.parse(fields);
};
// The API framework loads this file with `require()`, so it exports CommonJS-style;
// `export default` would not be picked up.
module.exports = {
    browse: serializeMany,
    read: serializeOne,
    add: serializeMany,
    reorder: serializeMany,
    edit: serializeOne,
};
