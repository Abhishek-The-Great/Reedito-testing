"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSignedJob = buildSignedJob;
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const utils_1 = require("./utils");
function buildSignedJob({ apiUrl, path, time, key, extra, getIdempotencyKey, }) {
    const signedAdminToken = (0, utils_1.getSignedAdminToken)({
        publishedAt: new Date(time).toISOString(),
        apiUrl,
        key,
    });
    const url = new URL(url_utils_1.default.urlJoin(apiUrl, ...path));
    url.searchParams.set('token', signedAdminToken);
    const jobExtra = { httpMethod: 'PUT', ...extra };
    if (getIdempotencyKey) {
        jobExtra.idempotencyKey = getIdempotencyKey(url);
    }
    return { time, url: url.toString(), extra: jobExtra };
}
