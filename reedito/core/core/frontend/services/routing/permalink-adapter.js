"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExpressNotation = toExpressNotation;
/**
 * Convert a domain-model permalink into Express / URL-service notation.
 *
 * @example toExpressNotation('/{slug}/')               // => '/:slug/'
 * @example toExpressNotation('/{primary_tag}/{slug}/') // => '/:primary_tag/:slug/'
 * @example toExpressNotation('/:slug/')                // => '/:slug/' (idempotent)
 */
function toExpressNotation(permalink) {
    return permalink.replace(/{(\w+)}/g, ':$1');
}
