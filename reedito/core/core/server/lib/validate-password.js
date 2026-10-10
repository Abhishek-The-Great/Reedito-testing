"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePassword = validatePassword;
const tpl_1 = __importDefault(require("@tryghost/tpl"));
// @ts-expect-error This module lacks type definitions.
const validator_1 = __importDefault(require("@tryghost/validator"));
// @ts-expect-error This module lacks type definitions.
const settings_cache_1 = __importDefault(require("../../shared/settings-cache"));
const url_utils_1 = __importDefault(require("../../shared/url-utils"));
const messages = {
    passwordTooShort: 'Your password must be at least {minLength} characters long.',
    passwordTooLong: 'Your password is too long.',
    passwordDoesNotComplySecurity: 'Sorry, you cannot use an insecure password.',
};
/**
 * Counts repeated characters in a string. When 50% or more characters are the same,
 * we return false and therefore invalidate the string.
 */
function characterOccurrence(stringToTest) {
    const limit = stringToTest.length / 2;
    const counts = new Map();
    for (let i = 0; i < stringToTest.length; i++) {
        const char = stringToTest[i];
        const count = (counts.get(char) || 0) + 1;
        if (count >= limit) {
            return false;
        }
        counts.set(char, count);
    }
    return true;
}
/** Validation against simple password rules. */
function validatePassword(password, email, siteTitle) {
    // password cannot be longer than 256 code units, for performance
    if (password.length > 256) {
        return { isValid: false, message: (0, tpl_1.default)(messages.passwordTooLong) };
    }
    // password must be longer than 10 characters
    if (!validator_1.default.isLength(password, 10)) {
        return { isValid: false, message: (0, tpl_1.default)(messages.passwordTooShort, { minLength: 10 }) };
    }
    const invalidValidationResult = {
        isValid: false,
        message: (0, tpl_1.default)(messages.passwordDoesNotComplySecurity),
    };
    // password must not match with users' email
    if (email && email.toLowerCase() === password.toLowerCase()) {
        return invalidValidationResult;
    }
    // password must not match with site title
    siteTitle = siteTitle || settings_cache_1.default.get('title');
    if (siteTitle && siteTitle.toLowerCase() === password.toLowerCase()) {
        return invalidValidationResult;
    }
    // password must not match with site URL (without protocol, with or without trailing slash)
    let siteUrl = url_utils_1.default.urlFor('home', true);
    siteUrl = siteUrl.replace(/^http(s?):\/\//, '');
    if (siteUrl &&
        (siteUrl.toLowerCase() === password.toLowerCase() ||
            siteUrl.toLowerCase().replace(/\/$/, '') === password.toLowerCase())) {
        return invalidValidationResult;
    }
    // disallow password from badPasswords list (e. g. '1234567890')
    const badPasswords = [
        '1234567890',
        'qwertyuiop',
        'qwertzuiop',
        'asdfghjkl;',
        'abcdefghij',
        '0987654321',
        '1q2w3e4r5t',
        '12345asdfg',
    ];
    if (badPasswords.includes(password)) {
        return invalidValidationResult;
    }
    // password must not contain the words 'reedito', 'password', or 'passw0rd'
    const disallowedPasswords = ['password', 'reedito', 'passw0rd'];
    for (const disallowedPassword of disallowedPasswords) {
        if (password.toLowerCase().includes(disallowedPassword)) {
            return invalidValidationResult;
        }
    }
    // dissallow passwords where 50% or more of characters are the same
    if (!characterOccurrence(password)) {
        return invalidValidationResult;
    }
    return { isValid: true };
}
