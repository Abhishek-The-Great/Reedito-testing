"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBackupRouteSettingsFilePath = void 0;
const path_1 = __importDefault(require("path"));
const pad = (value, length = 2) => String(value).padStart(length, '0');
const timestamp = (date) => [
    pad(date.getFullYear(), 4),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
].join('-');
const getBackupRouteSettingsFilePath = (filePath) => {
    const { dir, name, ext } = path_1.default.parse(filePath);
    return path_1.default.join(dir, `${name}-${timestamp(new Date())}${ext}`);
};
exports.getBackupRouteSettingsFilePath = getBackupRouteSettingsFilePath;
