"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const members_metafields_1 = require("../../services/members-metafields");
const controller = {
    // The Admin resource's name, so the response Portal reads is the one Admin's
    // serializer already produces. Only who may ask differs, and that is the route's
    // business rather than the response's.
    docName: 'members_metafields',
    browse: {
        headers: { cacheInvalidate: false },
        options: ['namespace'],
        validation: { options: { namespace: { required: true } } },
        permissions: false,
        query(frame) {
            // No `filter`, which Admin offers: whether a field is archived is a
            // publisher's business, and a member is only ever shown what they can still
            // fill in.
            return members_metafields_1.definitions.browse({ namespace: frame.options.namespace }, members_metafields_1.MEMBERS);
        },
    },
};
exports.default = controller;
module.exports = controller;
