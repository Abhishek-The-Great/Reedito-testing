"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLlmsDiscovery = createLlmsDiscovery;
const on_headers_1 = __importDefault(require("on-headers"));
function appendHeaderValue(existingValue, newValue) {
    if (!existingValue) {
        return newValue;
    }
    const raw = Array.isArray(existingValue) ? existingValue : [String(existingValue)];
    const values = raw.flatMap((value) => value.split(',').map((part) => part.trim()));
    if (values.includes(newValue)) {
        return raw.join(', ');
    }
    return raw.concat(newValue).join(', ');
}
function createLlmsDiscovery({ settingsCache }) {
    function isDiscoveryEnabled() {
        return !settingsCache.get('is_private') && settingsCache.get('llms_enabled') !== false;
    }
    return function llmsDiscovery(req, res, next) {
        if (!isDiscoveryEnabled()) {
            return next();
        }
        (0, on_headers_1.default)(res, function addLlmsDiscoveryHeaders() {
            if (!isDiscoveryEnabled()) {
                return;
            }
            const linkHeader = appendHeaderValue(this.getHeader('Link'), '</llms.txt>; rel="llms-txt"');
            this.setHeader('Link', appendHeaderValue(linkHeader, '</llms-full.txt>; rel="llms-full-txt"'));
            if (!this.getHeader('X-Llms-Txt')) {
                this.setHeader('X-Llms-Txt', '/llms.txt');
            }
        });
        next();
    };
}
