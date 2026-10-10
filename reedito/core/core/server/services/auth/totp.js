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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
exports.verify = verify;
const otplib = __importStar(require("otplib"));
const totp = otplib.totp.clone({
    digits: 6,
    step: 60,
    window: [10, 10],
});
/**
 * Generate a TOTP token for a user
 * @param userId The user's ID
 * @param secret The admin session secret
 * @param [context] Optional session-specific context to bind the token
 * @returns The generated 6-digit token
 */
function generate(userId, secret, context = '') {
    return totp.generate(`${secret}${userId}${context}`);
}
/**
 * Verify a TOTP token for a user
 * @param userId The user's ID
 * @param token The token to verify
 * @param secret The admin session secret
 * @param [context] Optional session-specific context to bind the token
 * @returns Whether the token is valid
 */
function verify(userId, token, secret, context = '') {
    return totp.check(token, `${secret}${userId}${context}`);
}
