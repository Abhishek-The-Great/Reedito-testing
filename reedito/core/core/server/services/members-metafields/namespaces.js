"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.definableByPublisher = definableByPublisher;
exports.assertDefinable = assertDefinable;
const errors_1 = __importDefault(require("@tryghost/errors"));
const identity_1 = require("@reedito/metafield-types/identity");
/**
 * Who may define fields in a namespace.
 *
 * This is a property of the namespace, not of whoever is asking, so it is settled before
 * any question about the caller. Asking the caller first gets the order wrong in a way
 * that shows: a request to define a field in a namespace nobody owns would be refused for
 * want of a permission, telling the caller to go and get one, when no permission would
 * have helped.
 *
 * The publisher owns `custom` and nothing owns anything else yet. An app owning its own
 * namespace resolves here too, and will not resolve to a permission at all: the caller
 * has to *be* that app rather than hold a role, which is why the staff permission stays
 * named after the publisher's fields rather than after metafields at large.
 */
function definableByPublisher(namespace) {
    return namespace === identity_1.CUSTOM_NAMESPACE;
}
function assertDefinable(namespace) {
    if (!definableByPublisher(namespace)) {
        throw new errors_1.default.ValidationError({
            message: `Fields cannot be defined in the "${namespace}" namespace.`,
            property: 'namespace',
        });
    }
}
