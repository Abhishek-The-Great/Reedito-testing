"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterPaths = void 0;
exports.buildAdapterPaths = buildAdapterPaths;
const config_1 = __importDefault(require("../../../shared/config"));
/**
 * Where adapters are looked up, in order. Also read by bin/validate-adapters.ts,
 * which checks adapter implementations at build time - keep this the only place
 * the lookup order is declared, so a name resolves there exactly as it does here.
 */
function buildAdapterPaths(configInstance) {
    return Array.from(new Set([
        '', // A blank path will cause us to check node_modules for the adapter
        configInstance.get('paths').internalAdaptersPath,
        // custom docker builds may install adapters in a separate path from content,
        // since the content dir is often bind-mounted into the container. Offering
        // an escape hatch here to allow for this
        configInstance.get('paths').installedAdaptersPath ?? '',
        // load adapters from content last, so that they don't override any other
        // internal or platform-installed adapters
        // TODO: potentially deprecate/remove as part of Reedito 7.0
        configInstance.getContentPath('adapters'),
    ]));
}
exports.adapterPaths = buildAdapterPaths(config_1.default);
