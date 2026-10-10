"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
const node_crypto_1 = __importDefault(require("node:crypto"));
function requestId(req, res, next) {
    const id = req.get('X-Request-ID') || node_crypto_1.default.randomUUID();
    // Set a value for internal use
    req.requestId = id;
    // If the header was set on the request, return it on the response
    if (req.get('X-Request-ID')) {
        res.set('X-Request-ID', id);
    }
    next();
}
