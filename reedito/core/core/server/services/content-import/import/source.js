"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareImportSource = prepareImportSource;
exports.isDataFile = isDataFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const import_archive_1 = __importDefault(require("../../../data/importer/import-archive"));
const assets_1 = require("./assets");
const errors = require('@tryghost/errors');
const DATA_EXTENSIONS = new Set(['.csv', '.json', '.md', '.markdown']);
const noCleanup = async () => { };
async function prepareImportSource(request) {
    const extension = path_1.default.extname(request.fileName).toLowerCase();
    if (extension === '.csv') {
        return { filePath: request.filePath, cleanup: noCleanup };
    }
    if (extension !== '.zip') {
        throw new errors.ValidationError({ message: 'Please select a valid CSV or ZIP file.' });
    }
    const archive = new import_archive_1.default({
        extensions: [...DATA_EXTENSIONS],
        directories: [],
    });
    const directory = await archive.extract(request.filePath);
    let cleaned = false;
    const cleanup = async () => {
        if (!cleaned) {
            cleaned = true;
            await fs_extra_1.default.remove(directory);
        }
    };
    try {
        archive.isValid(directory);
        const baseDirectory = archive.getBaseDirectory(directory);
        const entries = (0, glob_1.globSync)('**/*', { cwd: directory, nodir: true, dot: true });
        const dataFiles = entries.filter(isDataFile);
        const csvFiles = dataFiles.filter((file) => extensionOf(file) === '.csv');
        if (csvFiles.length === 0) {
            throw new errors.ValidationError({
                message: 'ZIP files uploaded here must contain one CSV file.',
            });
        }
        if (csvFiles.length > 1) {
            throw new errors.ValidationError({
                message: 'ZIP files can contain only one CSV file. Remove the extra CSV files and try again.',
            });
        }
        if (dataFiles.length > 1 || entries.some(isUnsupportedCompetingDataFile)) {
            throw new errors.ValidationError({
                message: 'ZIP files cannot contain CSV, JSON, or Markdown import files together. Keep only the CSV file and try again.',
            });
        }
        validateWrapper(entries, csvFiles[0]);
        const csvParts = csvFiles[0].split('/').filter(Boolean);
        const csvBaseDirectory = csvParts.length === 2 ? csvParts[0] : undefined;
        if (csvBaseDirectory !== baseDirectory) {
            throw new errors.ValidationError({ message: 'Invalid ZIP file structure.' });
        }
        return {
            filePath: path_1.default.join(directory, csvFiles[0]),
            assets: await (0, assets_1.prepareAssetBatch)(archive, directory, baseDirectory),
            cleanup,
        };
    }
    catch (error) {
        await cleanup();
        throw error;
    }
}
function validateWrapper(entries, csvFile) {
    const csvParts = csvFile.split('/').filter(Boolean);
    if (csvParts.length !== 2) {
        return;
    }
    const wrapper = csvParts[0];
    const outsideWrapper = entries.some((entry) => {
        const parts = entry.split('/').filter(Boolean);
        return !isMetadata(parts) && parts[0] !== wrapper;
    });
    if (outsideWrapper) {
        throw new errors.ValidationError({ message: 'Invalid ZIP file structure.' });
    }
}
function isDataFile(fileName) {
    const parts = fileName.split('/').filter(Boolean);
    if (parts.length === 0 || isMetadata(parts)) {
        return false;
    }
    const extension = extensionOf(fileName);
    if (!DATA_EXTENSIONS.has(extension)) {
        return false;
    }
    if (parts.length === 1) {
        return true;
    }
    return parts.length === 2;
}
function extensionOf(fileName) {
    return path_1.default.posix.extname(fileName).toLowerCase();
}
function isUnsupportedCompetingDataFile(fileName) {
    const extension = extensionOf(fileName);
    if (extension === '.csv' || !DATA_EXTENSIONS.has(extension)) {
        return false;
    }
    const parts = fileName.split('/').filter(Boolean);
    if (parts.length === 0 || isMetadata(parts) || isFileAttachment(parts)) {
        return false;
    }
    return !isDataFile(fileName);
}
function isFileAttachment(parts) {
    const assetParts = ['content', 'files'].includes(parts[0]) ? [...parts] : parts.slice(1);
    if (assetParts[0] === 'content') {
        assetParts.shift();
    }
    return assetParts.length > 1 && assetParts[0] === 'files';
}
function isMetadata(parts) {
    return (parts[0] === '__MACOSX' || parts.some((part) => part.startsWith('._') || part === '.DS_Store'));
}
