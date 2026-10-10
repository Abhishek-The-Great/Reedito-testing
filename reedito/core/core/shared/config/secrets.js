"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecretsFromEnv = loadSecretsFromEnv;
exports.isSecretFileRef = isSecretFileRef;
const node_fs_1 = __importDefault(require("node:fs"));
const lodash_1 = require("lodash");
const SUFFIX = '_file';
/**
 * Whether an env var name is a reference to a secret file rather than a config value itself.
 */
function isSecretFileRef(name, separator = '__') {
    if (!name.toLowerCase().endsWith(SUFFIX)) {
        return false;
    }
    const keyPath = name.slice(0, -SUFFIX.length).split(separator);
    // the key must be nested, which keeps unrelated env vars such as SSL_CERT_FILE out
    return keyPath.length >= 2 && keyPath.every((segment) => !!segment);
}
/**
 * Resolve `<config_key>_FILE` env vars into config values by reading the file they point at,
 * so secrets can be mounted (Docker/Swarm secrets, k8s projected volumes, systemd LoadCredential)
 * instead of being passed as plaintext env vars.
 *
 *   database__connection__password_FILE=/run/secrets/db_password
 *
 * The suffix is matched case-insensitively.
 *
 * Returns a plain object suitable for an nconf `literal` store.
 */
function loadSecretsFromEnv(env = process.env, separator = '__') {
    const store = {};
    const seen = new Map();
    for (const [name, filePath] of Object.entries(env)) {
        if (!isSecretFileRef(name, separator) || !filePath) {
            continue;
        }
        const varName = name.slice(0, -SUFFIX.length);
        if (env[varName] !== undefined) {
            // new Error is allowed here, as we do not want config to depend on @tryghost/error
            // eslint-disable-next-line reedito/ghost-custom/no-native-error
            throw new Error(`Cannot set both ${varName} and ${name} - use one or the other.`);
        }
        const duplicate = seen.get(varName);
        if (duplicate) {
            // env var names are case-sensitive on POSIX, so the same key can be set twice —
            // only a conflict if they disagree about which file to read
            if (duplicate.filePath !== filePath) {
                // eslint-disable-next-line reedito/ghost-custom/no-native-error
                throw new Error(`Cannot set both ${duplicate.name} and ${name} to different files - they resolve to the same config key.`);
            }
            continue;
        }
        seen.set(varName, { name, filePath });
        let contents;
        try {
            contents = node_fs_1.default.readFileSync(filePath, 'utf8');
        }
        catch (err) {
            // eslint-disable-next-line reedito/ghost-custom/no-native-error
            throw new Error(`Could not read the secret file referenced by ${name}: ${filePath}`, {
                cause: err,
            });
        }
        // strip a single trailing newline, matching `$(cat file)` behaviour, but leave
        // any other surrounding whitespace alone in case it is part of the secret
        // setWith with Object keeps numeric key segments as plain objects rather than arrays
        (0, lodash_1.setWith)(store, varName.split(separator), contents.replace(/\r?\n$/, ''), Object);
    }
    return store;
}
