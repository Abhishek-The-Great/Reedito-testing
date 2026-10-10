"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASYNC_EXPORT_COMPONENTS = exports.SYNC_EXPORT_COMPONENTS = void 0;
exports.SYNC_EXPORT_COMPONENTS = [
    'members',
    'analytics',
    'content',
    'themes',
    'routes',
];
// Media assets are only available in the async export as they can be quite large
exports.ASYNC_EXPORT_COMPONENTS = [...exports.SYNC_EXPORT_COMPONENTS, 'media'];
