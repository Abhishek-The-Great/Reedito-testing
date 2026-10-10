"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const membersService = require('../../services/members');
const memberOf = (frame) => frame.options?.context?.member ?? null;
const controller = {
    docName: 'members_account',
    read: {
        headers: { cacheInvalidate: false },
        permissions: false,
        query(frame) {
            return membersService.api.account.read(memberOf(frame).id);
        },
    },
    /**
     * Let Reedito email this member again.
     *
     * Under the account rather than as a resource of its own: being emailable is a
     * fact about a member, and the only person who can restore it here is the member
     * themselves.
     */
    destroySuppression: {
        statusCode: 204,
        headers: { cacheInvalidate: false },
        permissions: false,
        query(frame) {
            const member = memberOf(frame);
            return membersService.api.account.allowEmail(member.id, member.email);
        },
    },
    // `update` rather than `edit`: the framework reserves `edit` for the Admin API's
    // enveloped bodies, and this request has always carried a bare one. The
    // members-facing gift endpoints name their own verbs for the same reason.
    update: {
        headers: { cacheInvalidate: false },
        permissions: false,
        query(frame) {
            return membersService.api.account.edit(frame.data, memberOf(frame).id);
        },
    },
};
exports.default = controller;
module.exports = controller;
