"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContentFileHandlers = createContentFileHandlers;
exports.createContentFileImporters = createContentFileImporters;
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
// Keep adapter loading on the existing CommonJS path so the configured adapter
// and its base class share the same module instance during the legacy /db/ import.
const adapterManager = require('../../services/adapter-manager').default;
const ImageHandler = require('./handlers/image');
const ImporterContentFileHandler = require('./handlers/importer-content-file-handler');
const ContentFileImporter = require('./importers/content-file-importer');
function createContentFileHandlers() {
    const mediaStorage = adapterManager.getAdapter('storage:media');
    const fileStorage = adapterManager.getAdapter('storage:files');
    return [
        ImageHandler,
        new ImporterContentFileHandler({
            type: 'media',
            // These broad directory names preserve the existing /db/ archive behavior.
            directories: ['media', 'content'],
            ignoreRootFolderFiles: true,
            extensions: config_1.default.get('uploads').media.extensions,
            contentTypes: config_1.default.get('uploads').media.contentTypes,
            urlUtils: url_utils_1.default,
            storage: mediaStorage,
        }),
        new ImporterContentFileHandler({
            type: 'files',
            directories: ['files', 'content'],
            ignoreRootFolderFiles: true,
            extensions: config_1.default.get('uploads').files.extensions,
            contentTypes: config_1.default.get('uploads').files.contentTypes,
            urlUtils: url_utils_1.default,
            storage: fileStorage,
        }),
    ];
}
function createContentFileImporters() {
    return [
        new ContentFileImporter({
            type: 'images',
            store: adapterManager.getAdapter('storage:images'),
        }),
        new ContentFileImporter({
            type: 'media',
            store: adapterManager.getAdapter('storage:media'),
        }),
        new ContentFileImporter({
            type: 'files',
            store: adapterManager.getAdapter('storage:files'),
        }),
    ];
}
