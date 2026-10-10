"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// # Local File Base Storage module
// The (default) module for storing files using the local file system
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const reedito_storage_base_1 = require("reedito-storage-base");
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
const errify_1 = require("../../../shared/errify");
const serveStatic = require('../../../shared/express').static;
const messages = {
    notFound: 'File not found',
    notFoundWithRef: 'File not found: {file}',
    cannotRead: 'Could not read file: {file}',
    invalidUrlParameter: `The URL "{url}" is not a valid URL for this site.`,
    invalidPathParameter: 'The path "{path}" is not valid for this storage.',
};
class LocalStorageBase extends reedito_storage_base_1.StorageBase {
    staticFileURLPrefix;
    siteUrl;
    staticFileUrl;
    errorMessages;
    constructor({ storagePath, staticFileURLPrefix, siteUrl, errorMessages, }) {
        super();
        this.storagePath = storagePath ?? os_1.default.tmpdir();
        this.staticFileURLPrefix = staticFileURLPrefix;
        this.siteUrl = siteUrl;
        this.staticFileUrl = `${siteUrl}${staticFileURLPrefix}`;
        this.errorMessages = errorMessages || messages;
    }
    /**
     * Normalizes a relative storage path and rejects traversal outside the storage root.
     */
    _normalizeStorageRelativePath(filePath) {
        const normalized = path_1.default.posix.normalize(String(filePath || '')
            .replaceAll('\\', '/')
            .replace(/^\/+/, '')
            .replace(/\/+$/, ''));
        if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
            throw new errors_1.default.IncorrectUsageError({
                message: (0, tpl_1.default)(messages.invalidPathParameter, { path: filePath }),
            });
        }
        return normalized;
    }
    /**
     * Resolves a target directory and optional file name into a full path,
     * validating the result is inside the storage root.
     *
     * Supports relative paths (preferred) and absolute paths (legacy).
     * TODO: remove absolute path support once all callers pass relative paths
     *
     * @param targetDir absolute or relative directory
     * @param fileName file name to normalize and append
     * @param allowRoot whether storagePath itself is a valid result
     * @returns resolved absolute path inside storagePath, or storagePath when explicitly allowed
     */
    _resolveAndValidateStoragePath(targetDir, fileName, allowRoot = false) {
        const resolvedRoot = path_1.default.resolve(this.storagePath);
        // Resolve targetDir: if already inside storage root use as-is, otherwise treat as relative
        let resolvedBase;
        if (targetDir) {
            const resolvedTargetDir = path_1.default.resolve(targetDir);
            const relToRoot = path_1.default.relative(resolvedRoot, resolvedTargetDir);
            if (relToRoot === '' || (!relToRoot.startsWith('..') && !path_1.default.isAbsolute(relToRoot))) {
                resolvedBase = resolvedTargetDir;
            }
            else {
                resolvedBase = path_1.default.resolve(this.storagePath, targetDir);
            }
        }
        else {
            resolvedBase = resolvedRoot;
        }
        // If fileName provided, normalize and resolve
        let resolvedPath;
        if (fileName) {
            const normalizedFileName = this._normalizeStorageRelativePath(fileName);
            resolvedPath = path_1.default.resolve(resolvedBase, normalizedFileName);
        }
        else {
            resolvedPath = resolvedBase;
        }
        // Validate the resolved path is inside the storage root. Callers which operate on files
        // keep the stricter default; save() may target the root because the generated filename is
        // validated separately before anything is written.
        const relative = path_1.default.relative(resolvedRoot, resolvedPath);
        if ((!allowRoot && relative === '') ||
            relative === '..' ||
            relative.startsWith('..' + path_1.default.sep) ||
            path_1.default.isAbsolute(relative)) {
            throw new errors_1.default.IncorrectUsageError({
                message: (0, tpl_1.default)(messages.invalidPathParameter, { path: fileName || targetDir || '' }),
            });
        }
        return resolvedPath;
    }
    /**
     * Saves the file to storage (the file system)
     * - returns a promise which ultimately returns the full url to the uploaded file
     */
    async save(file, targetDir) {
        targetDir = targetDir
            ? this._resolveAndValidateStoragePath(targetDir, undefined, true)
            : this.getTargetDir(this.storagePath);
        const targetFilename = await this.getUniqueFileName(file, targetDir);
        // Verify that we are saving directly under `targetDir` and not outside of it.
        const expectedPrefix = path_1.default.join(path_1.default.resolve(targetDir), '/');
        if (!path_1.default.resolve(targetFilename).startsWith(expectedPrefix)) {
            throw new errors_1.default.BadRequestError({ message: 'Cannot save to the given filename' });
        }
        await fs_extra_1.default.mkdirs(targetDir);
        try {
            await fs_extra_1.default.copy(file.path, targetFilename);
        }
        catch (err) {
            if (err.code === 'ENAMETOOLONG') {
                throw new errors_1.default.BadRequestError({ err: (0, errify_1.errify)(err) });
            }
            throw err;
        }
        // The src for the image must be in URI format, not a file system path, which in Windows uses \
        // For local file system storage can use relative path so add a slash
        const fullUrl = url_utils_1.default
            .urlJoin('/', url_utils_1.default.getSubdir(), this.staticFileURLPrefix, path_1.default.relative(this.storagePath, targetFilename))
            .replace(new RegExp(`\\${path_1.default.sep}`, 'g'), '/');
        return fullUrl;
    }
    /**
     * Saves a buffer in the targetPath
     *
     * @param buffer is an instance of Buffer
     * @param targetPath relative path NOT including storage path to which the buffer should be written
     * @returns a URL to retrieve the data
     */
    async saveRaw(buffer, targetPath) {
        const storagePath = path_1.default.join(this.storagePath, this._normalizeStorageRelativePath(targetPath));
        const targetDir = path_1.default.dirname(storagePath);
        await fs_extra_1.default.mkdirs(targetDir);
        await fs_extra_1.default.writeFile(storagePath, buffer);
        // For local file system storage can use relative path so add a slash
        const fullUrl = url_utils_1.default
            .urlJoin('/', url_utils_1.default.getSubdir(), this.staticFileURLPrefix, targetPath)
            .replace(new RegExp(`\\${path_1.default.sep}`, 'g'), '/');
        return fullUrl;
    }
    /**
     * @param url full url under which the stored content is served, result of save method
     * @returns relative path under which the content is stored
     */
    urlToPath(url) {
        let relativePath;
        const prefix = url_utils_1.default.urlJoin('/', url_utils_1.default.getSubdir(), this.staticFileURLPrefix);
        if (url.startsWith(this.staticFileUrl)) {
            // CASE: full path that includes the site url
            relativePath = url.replace(this.staticFileUrl, '');
        }
        else if (url.startsWith(prefix)) {
            // CASE: The result of the save method doesn't include the site url. So we need to handle this case.
            relativePath = url.replace(prefix, '');
        }
        else {
            throw new errors_1.default.IncorrectUsageError({
                message: (0, tpl_1.default)(messages.invalidUrlParameter, { url }),
            });
        }
        try {
            return this._normalizeStorageRelativePath(relativePath);
        }
        catch (err) {
            throw new errors_1.default.IncorrectUsageError({
                message: (0, tpl_1.default)(messages.invalidUrlParameter, { url }),
            });
        }
    }
    async exists(fileName, targetDir) {
        let filePath;
        try {
            filePath = this._resolveAndValidateStoragePath(targetDir, fileName);
        }
        catch (err) {
            if (err instanceof errors_1.default.IncorrectUsageError) {
                return false;
            }
            throw err;
        }
        try {
            await fs_extra_1.default.stat(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Sets response headers for a file about to be served from local storage.
     * `send` only derives Content-Type from the extension when it hasn't been
     * set yet, so subclasses can override this to enforce their own type.
     *
     * `nosniff` stops browsers from second-guessing the declared Content-Type
     * based on the file's contents.
     */
    setServeHeaders(res, _filePath) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    /**
     * For some reason send divides the max age number by 1000
     * Fallthrough: false ensures that if an image isn't found, it automatically 404s
     * Wrap server static errors
     */
    serve() {
        const { storagePath, errorMessages } = this;
        const setHeaders = (res, filePath) => this.setServeHeaders(res, filePath);
        return function serveStaticContent(req, res, next) {
            return serveStatic(storagePath, {
                maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in ms
                fallthrough: false,
                setHeaders,
            })(req, res, (err) => {
                if (err) {
                    if (err.statusCode === 404) {
                        return next(new errors_1.default.NotFoundError({
                            message: (0, tpl_1.default)(errorMessages.notFound),
                            code: 'STATIC_FILE_NOT_FOUND',
                            property: err.path,
                        }));
                    }
                    if (err.statusCode === 400) {
                        return next(new errors_1.default.BadRequestError({ err: err }));
                    }
                    if (err.statusCode === 403) {
                        return next(new errors_1.default.NoPermissionError({ err: err }));
                    }
                    if (err.name === 'RangeNotSatisfiableError') {
                        return next(new errors_1.default.RangeNotSatisfiableError({ err }));
                    }
                    return next(new errors_1.default.InternalServerError({ err: err }));
                }
                next();
            });
        };
    }
    async delete(fileName, targetDir) {
        const filePath = this._resolveAndValidateStoragePath(targetDir, fileName);
        return await fs_extra_1.default.remove(filePath);
    }
    /**
     * Reads bytes from disk for a target file
     * - path of target file (without content path!)
     */
    async read(options) {
        options = options || {};
        const normalizedPath = this._normalizeStorageRelativePath(options.path);
        const targetPath = path_1.default.join(this.storagePath, normalizedPath);
        try {
            return await fs_extra_1.default.readFile(targetPath);
        }
        catch (rawError) {
            const err = (0, errify_1.errify)(rawError);
            const code = rawError.code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                throw new errors_1.default.NotFoundError({
                    err: err,
                    message: (0, tpl_1.default)(this.errorMessages.notFoundWithRef, { file: options.path }),
                });
            }
            if (code === 'ENAMETOOLONG') {
                throw new errors_1.default.BadRequestError({ err: err });
            }
            if (code === 'EACCES') {
                throw new errors_1.default.NoPermissionError({ err: err });
            }
            throw new errors_1.default.InternalServerError({
                err: err,
                message: (0, tpl_1.default)(this.errorMessages.cannotRead, { file: options.path }),
            });
        }
    }
}
exports.default = LocalStorageBase;
