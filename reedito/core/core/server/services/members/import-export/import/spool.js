"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRowSpool = createRowSpool;
const node_crypto_1 = __importDefault(require("node:crypto"));
// Spools import rows to a JSON file in the imports storage adapter, so a deferred
// import can hand them to a background job and read them back after the request has
// already returned. The rows go in and come out as MemberImportRow, so nothing but
// the import's own row shape crosses this boundary.
function createRowSpool(storage) {
    return {
        async write(rows) {
            const key = `members-import-${node_crypto_1.default.randomUUID()}.json`;
            await storage.saveRaw(Buffer.from(JSON.stringify(rows)), key);
            return key;
        },
        async read(key) {
            return JSON.parse((await storage.read({ path: key })).toString('utf8'));
        },
        async remove(key) {
            await storage.delete(key);
        },
    };
}
