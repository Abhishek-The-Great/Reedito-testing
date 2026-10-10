"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// # Local File System Image Storage module
// The (default) module for storing images, using the local file system
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const LocalStorageBase_1 = __importDefault(require("./LocalStorageBase"));
const messages = {
    notFound: 'Image not found',
    notFoundWithRef: 'Image not found: {file}',
    cannotRead: 'Could not read image: {file}',
};
class LocalImagesStorage extends LocalStorageBase_1.default {
    constructor() {
        super({
            storagePath: config_1.default.getContentPath('images'),
            staticFileURLPrefix: url_utils_1.default.STATIC_IMAGE_URL_PREFIX,
            siteUrl: config_1.default.getSiteUrl(),
            errorMessages: messages,
        });
    }
}
exports.default = LocalImagesStorage;
