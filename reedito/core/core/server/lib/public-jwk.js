"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicKeyInfo = getPublicKeyInfo;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors = __importStar(require("@tryghost/errors"));
// Parsing a PEM and thumbprinting it costs real CPU, so results are shared
// across every consumer of the same key. Keyed by digest so the cache never
// holds another reference to private key material.
const cache = new Map();
async function parse(privateKeyPem) {
    // jose 6 is ESM-only. tsc emits this as `require('jose')` under module: commonjs,
    // which resolves via Node's require(esm) - available on every Node in `engines`.
    const { calculateJwkThumbprint } = await Promise.resolve().then(() => __importStar(require('jose')));
    // Node handles both PKCS#1 and PKCS#8 PEMs, and exports public fields only.
    const publicKey = node_crypto_1.default.createPublicKey(node_crypto_1.default.createPrivateKey(privateKeyPem));
    const { kty, n, e } = publicKey.export({ format: 'jwk' });
    if (kty !== 'RSA' || !n || !e) {
        throw new errors.IncorrectUsageError({
            message: 'Expected an RSA private key',
        });
    }
    const jwk = { kty, n, e };
    return { kid: await calculateJwkThumbprint(jwk, 'sha256'), jwk };
}
/**
 * Public JWK and `kid` for a PEM-encoded RSA private key. Never returns private
 * parameters.
 */
function getPublicKeyInfo(privateKeyPem) {
    const digest = node_crypto_1.default.createHash('sha256').update(privateKeyPem).digest('hex');
    let info = cache.get(digest);
    if (!info) {
        info = parse(privateKeyPem).catch((err) => {
            // Don't pin a failure forever - a later caller should retry.
            cache.delete(digest);
            throw err;
        });
        cache.set(digest, info);
    }
    return info;
}
