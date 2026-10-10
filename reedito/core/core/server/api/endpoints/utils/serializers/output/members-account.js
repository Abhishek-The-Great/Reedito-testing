"use strict";
const { formattedMemberResponse } = require('../../../../../services/members/utils');
/**
 * A member's own record, as this API has always written one down.
 *
 * The projection itself is unchanged and still lives beside the other member
 * formatting; what changes is that it is now reached the way every other
 * serializer is, by this endpoint's `docName`, rather than being called by hand
 * from a request handler.
 */
const serialize = (member, _apiConfig, frame) => {
    frame.response = formattedMemberResponse(member);
};
// The API framework loads this file with `require()`, so it exports CommonJS-style;
// `export default` would not be picked up.
module.exports = {
    read: serialize,
    update: serialize,
};
