"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_manager_1 = require("./adapter-manager");
const adapter_paths_1 = require("./adapter-paths");
const base_classes_1 = require("./base-classes");
const config_1 = __importDefault(require("../../../shared/config"));
// A singleton adapter manager, preconfigured with the base classes for every
// known adapter type. `getAdapter` resolves the active adapter and its options
// from config on each call, so runtime config changes are always reflected.
const adapterManager = new adapter_manager_1.AdapterManager({
    loadAdapterFromPath: require,
    config: config_1.default,
    pathsToAdapters: adapter_paths_1.adapterPaths,
    baseClasses: base_classes_1.baseClasses,
});
exports.default = adapterManager;
