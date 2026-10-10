"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const file_type_utils_1 = require("../../services/files/file-type-utils");
const LocalStorageBase_1 = __importDefault(require("./LocalStorageBase"));
const messages = {
    notFound: 'File not found',
    notFoundWithRef: 'File not found: {file}',
    cannotRead: 'Could not read File: {file}',
};
class LocalFilesStorage extends LocalStorageBase_1.default {
    constructor() {
        super({
            storagePath: config_1.default.getContentPath('files'),
            siteUrl: config_1.default.getSiteUrl(),
            staticFileURLPrefix: url_utils_1.default.STATIC_FILES_URL_PREFIX,
            errorMessages: messages,
        });
    }
    /**
     * The files upload endpoint resolves an inert content type for each file
     * (e.g. .html -> text/plain, .svg -> application/octet-stream), which S3
     * stores alongside the object. Local storage has nowhere to keep it, so
     * resolve it again here instead of letting express.static derive a
     * browser-executable type from the extension.
     */
    setServeHeaders(res, filePath) {
        super.setServeHeaders(res, filePath);
        res.setHeader('Content-Type', (0, file_type_utils_1.getStorageContentType)(filePath));
    }
}
exports.default = LocalFilesStorage;
