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
exports.cacheControl = void 0;
const errors = __importStar(require("@tryghost/errors"));
const cacheControl = (...args) => {
    const [profile, options] = args;
    let value;
    switch (profile) {
        case 'public':
            value = `public, max-age=${options?.maxAge ?? 0}`;
            break;
        case 'private':
            value =
                'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0';
            break;
        case 'noCache':
            value =
                'no-cache, max-age=0, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0';
            break;
        default: {
            const exhaustiveCheck = profile;
            throw new errors.IncorrectUsageError({
                message: `Invalid cache control profile: ${exhaustiveCheck}`,
            });
        }
    }
    return function cacheControlHeaders(_req, res, next) {
        res.setHeader('Cache-Control', value);
        next();
    };
};
exports.cacheControl = cacheControl;
