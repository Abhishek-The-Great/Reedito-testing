"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = readMemberRows;
const csv_1 = require("../csv");
const row_1 = require("./row");
// Each accepted CSV header (the key) maps to the member field it fills (the value):
// a "subscribed_to_emails" column fills the "subscribed" field, and so on.
const FIELD_BY_HEADER = {
    email: 'email',
    name: 'name',
    note: 'note',
    subscribed_to_emails: 'subscribed',
    created_at: 'created_at',
    complimentary_plan: 'complimentary_plan',
    stripe_customer_id: 'stripe_customer_id',
    labels: 'labels',
    import_tier: 'import_tier',
    gift_id: 'gift_id',
};
// Resolve a caller mapping's target to the member field it fills. The target is usually
// a field already, but a caller may name a default header (e.g. "subscribed_to_emails"),
// which resolves to its field. hasOwn keeps a prototype name from matching a method.
function toMemberField(target) {
    return Object.hasOwn(FIELD_BY_HEADER, target) ? FIELD_BY_HEADER[target] : target;
}
async function readMemberRows(path, mapping) {
    const headerToField = mapping
        ? Object.fromEntries(Object.entries(mapping).map(([header, target]) => [
            header,
            toMemberField(target),
        ]))
        : FIELD_BY_HEADER;
    const rows = await (0, csv_1.parse)(path, headerToField);
    return rows.map((row) => row_1.memberImportRowSchema.parse(row));
}
