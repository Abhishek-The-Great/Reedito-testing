"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERNAL = exports.MEMBERS = exports.ADMIN = exports.MemberAccessSchema = exports.MEMBER_ACCESS = void 0;
exports.readableLevels = readableLevels;
exports.canWrite = canWrite;
const metafield_types_1 = require("@reedito/metafield-types");
Object.defineProperty(exports, "MEMBER_ACCESS", { enumerable: true, get: function () { return metafield_types_1.MEMBER_ACCESS; } });
Object.defineProperty(exports, "MemberAccessSchema", { enumerable: true, get: function () { return metafield_types_1.MemberAccessSchema; } });
const EVERY_LEVEL = [...metafield_types_1.MEMBER_ACCESS_LEVELS];
exports.ADMIN = { entry: 'admin' };
exports.MEMBERS = { entry: 'members' };
exports.INTERNAL = { entry: 'internal' };
// Every audience is spelled out with the levels it may read, staff included, because
// reads narrow on whatever this returns and an audience with no entry gets an empty
// list, which matches no field. Giving staff a way to skip the check instead would
// invert that: an unrecognised audience would then match everything.
const READABLE = {
    admin: EVERY_LEVEL,
    internal: EVERY_LEVEL,
    members: [metafield_types_1.MEMBER_ACCESS.read, metafield_types_1.MEMBER_ACCESS.write],
};
const WRITABLE = {
    admin: EVERY_LEVEL,
    internal: EVERY_LEVEL,
    members: [metafield_types_1.MEMBER_ACCESS.write],
};
// `Object.hasOwn` rather than a plain lookup: an entry naming a property every object
// inherits (`__proto__`, `constructor`, `toString`) would otherwise return that
// inherited value instead of falling through to the empty list.
function levelsFor(table, audience) {
    const entry = audience?.entry;
    return entry !== undefined && Object.hasOwn(table, entry) ? table[entry] : [];
}
function readableLevels(audience) {
    return levelsFor(READABLE, audience);
}
function canWrite(audience, field) {
    return levelsFor(WRITABLE, audience).includes(field.memberAccess);
}
