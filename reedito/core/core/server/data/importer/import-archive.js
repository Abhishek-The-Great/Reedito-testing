"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const glob_1 = require("glob");
const { extract } = require('@tryghost/zip');
const tpl = require('@tryghost/tpl');
const errors = require('@tryghost/errors');
const messages = {
    noContentToImport: 'Zip did not include any content to import.',
    invalidZipStructure: 'Invalid zip file structure.',
    invalidZipFileBaseDirectory: 'Invalid zip file: base directory read failed',
    invalidZipFileNameEncoding: 'The uploaded zip could not be read',
    invalidZipFileNameEncodingContext: 'The filename was too long or contained invalid characters',
    invalidZipFileNameEncodingHelp: 'Remove any special characters from the file name, or alternatively try another archiving tool if using MacOS Archive Utility',
};
const ROOT_ONLY = 0;
const ROOT_OR_SINGLE_DIR = 1;
const ALL_DIRS = 2;
class ImportArchive {
    extensions;
    directories;
    extractArchive;
    constructor({ extensions, directories }, { extract: extractArchive = extract } = {}) {
        this.extensions = extensions;
        this.directories = directories;
        this.extractArchive = extractArchive;
    }
    getGlobPattern(items) {
        return `+(${items.join('|')})`;
    }
    getExtensionGlob(extensions, level) {
        const prefix = level === ALL_DIRS ? '**/*' : level === ROOT_OR_SINGLE_DIR ? '{*/*,*}' : '*';
        return prefix + this.getGlobPattern(extensions);
    }
    getDirectoryGlob(directories, level) {
        const prefix = level === ALL_DIRS ? '**/' : level === ROOT_OR_SINGLE_DIR ? '{*/,}' : '';
        return prefix + this.getGlobPattern(directories);
    }
    isValid(directory) {
        const extMatchesBase = (0, glob_1.globSync)(this.getExtensionGlob(this.extensions, ROOT_OR_SINGLE_DIR), {
            cwd: directory,
            nocase: true,
        });
        const extMatchesAll = (0, glob_1.globSync)(this.getExtensionGlob(this.extensions, ALL_DIRS), {
            cwd: directory,
            nocase: true,
        });
        const dirMatches = this.directories.length
            ? (0, glob_1.globSync)(this.getDirectoryGlob(this.directories, ROOT_OR_SINGLE_DIR), {
                cwd: directory,
            })
            : [];
        if (extMatchesBase.length > 0 || (dirMatches.length > 0 && extMatchesAll.length > 0)) {
            return true;
        }
        if (extMatchesAll.length < 1) {
            throw new errors.UnsupportedMediaTypeError({ message: tpl(messages.noContentToImport) });
        }
        throw new errors.UnsupportedMediaTypeError({ message: tpl(messages.invalidZipStructure) });
    }
    getBaseDirectory(directory) {
        const extMatches = (0, glob_1.globSync)(this.getExtensionGlob(this.extensions, ROOT_ONLY), {
            cwd: directory,
            nocase: true,
        });
        const dirMatches = this.directories.length
            ? (0, glob_1.globSync)(this.getDirectoryGlob(this.directories, ROOT_ONLY), {
                cwd: directory,
                nocase: true,
            })
            : [];
        if (extMatches.length > 0 || dirMatches.length > 0) {
            return;
        }
        const extMatchesAll = (0, glob_1.globSync)(this.getExtensionGlob(this.extensions, ALL_DIRS), {
            cwd: directory,
            nocase: true,
        });
        const firstMatch = extMatchesAll[0];
        if (!firstMatch) {
            throw new errors.ValidationError({ message: tpl(messages.invalidZipFileBaseDirectory) });
        }
        return firstMatch.split('/')[0];
    }
    getFiles(directory, extensions) {
        const globPattern = this.getExtensionGlob(extensions, ALL_DIRS);
        return (0, glob_1.globSync)(globPattern, { cwd: directory, nocase: true }).map((file) => ({
            name: file,
            path: node_path_1.default.join(directory, file),
        }));
    }
    async extract(filePath) {
        const tmpDir = node_path_1.default.join(node_os_1.default.tmpdir(), node_crypto_1.default.randomUUID());
        try {
            await this.extractArchive(filePath, tmpDir);
            const files = (0, glob_1.globSync)('**/*', { cwd: tmpDir, nodir: true });
            await Promise.all(files.map((file) => fs_extra_1.default.chmod(node_path_1.default.join(tmpDir, file), 0o644)));
        }
        catch (error) {
            await fs_extra_1.default.remove(tmpDir).catch(() => { });
            const message = messageOf(error);
            if (message.startsWith('ENAMETOOLONG:')) {
                throw new errors.UnsupportedMediaTypeError({
                    message: tpl(messages.invalidZipFileNameEncoding),
                    context: tpl(messages.invalidZipFileNameEncodingContext),
                    help: tpl(messages.invalidZipFileNameEncodingHelp),
                    code: 'INVALID_ZIP_FILE_NAME_ENCODING',
                });
            }
            if (message.includes('end of central directory record signature not found') ||
                message.includes('invalid comment length')) {
                throw new errors.UnsupportedMediaTypeError({
                    message: tpl(messages.invalidZipFileNameEncoding),
                    code: 'INVALID_ZIP_FILE',
                });
            }
            throw error;
        }
        return tmpDir;
    }
}
exports.default = ImportArchive;
function messageOf(error) {
    return error instanceof Error ? error.message : '';
}
