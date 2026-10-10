"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberImportRowSchema = void 0;
const zod_1 = require("zod");
function splitLabels(cell) {
    return cell ? cell.split(',').map((name) => ({ name })) : [];
}
// An empty cell (or the literal 'undefined') reads as absent, not as a value -- so an
// empty created_at is a missing date, not the invalid empty string.
const optionalCell = zod_1.z
    .string()
    .transform((cell) => (cell === '' || cell === 'undefined' ? undefined : cell))
    .optional();
// Present cells are lenient in opposite directions: subscribed unless the cell reads
// 'false', comped only when it reads 'true'. An absent column stays undefined (optional,
// not defaulted), so a CSV lacking these columns leaves the member's state untouched.
const isSubscribed = (cell) => cell.toLowerCase() !== 'false';
const isComplimentary = (cell) => cell.toLowerCase() === 'true';
exports.memberImportRowSchema = zod_1.z
    .object({
    id: optionalCell,
    email: optionalCell,
    name: optionalCell,
    note: optionalCell,
    subscribed: zod_1.z.string().transform(isSubscribed).optional(),
    complimentary_plan: zod_1.z.string().transform(isComplimentary).optional(),
    stripe_customer_id: optionalCell,
    created_at: optionalCell,
    import_tier: optionalCell,
    gift_id: optionalCell,
    labels: zod_1.z.string().default('').transform(splitLabels),
})
    .loose();
