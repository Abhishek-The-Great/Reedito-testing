"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalImagesStoragePath = getLocalImagesStoragePath;
exports.isLocalImage = isLocalImage;
exports.isInternalImage = isInternalImage;
const config_1 = __importDefault(require("../../../shared/config"));
const url_utils_1 = __importDefault(require("../../../shared/url-utils"));
/**
 * @TODO: move `events.js` to here - e.g. storageUtils.getStorage
 */
/**
 * Sanitizes a given URL or path for an image to be readable by the local file
 * storage, as storage needs the path without the `/content/images/` prefix.
 *
 * Takes a url or filepath and returns a filepath which is readable for the
 * local file storage.
 */
function getLocalImagesStoragePath(imagePath) {
    // The '/' in urlJoin is necessary to add the '/' to `content/images`, if no subdirectory is setup
    const urlRegExp = new RegExp(`^${url_utils_1.default.urlJoin(url_utils_1.default.urlFor('home', true), url_utils_1.default.getSubdir(), '/', url_utils_1.default.STATIC_IMAGE_URL_PREFIX)}`);
    const filePathRegExp = new RegExp(`^${url_utils_1.default.urlJoin(url_utils_1.default.getSubdir(), '/', url_utils_1.default.STATIC_IMAGE_URL_PREFIX)}`);
    if (imagePath.match(urlRegExp)) {
        return imagePath.replace(urlRegExp, '');
    }
    else if (imagePath.match(filePathRegExp)) {
        return imagePath.replace(filePathRegExp, '');
    }
    else {
        return imagePath;
    }
}
/**
 * Compares the imagePath with a regex that reflects our local file storage
 *
 * @param imagePath as URL or filepath
 */
function isLocalImage(imagePath) {
    return getLocalImagesStoragePath(imagePath) !== imagePath;
}
/**
 * Checks whether the image is managed by Reedito storage (local or CDN)
 *
 * @param imagePath as URL or filepath
 */
function isInternalImage(imagePath) {
    if (isLocalImage(imagePath)) {
        return true;
    }
    const imageBaseUrl = (config_1.default.get('urls:image') || '').replace(/\/+$/, '');
    return !!(imageBaseUrl && imagePath.startsWith(imageBaseUrl + '/'));
}
