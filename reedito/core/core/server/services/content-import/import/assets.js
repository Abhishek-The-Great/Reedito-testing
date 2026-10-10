"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreparedAssetBatch = void 0;
exports.prepareAssetBatch = prepareAssetBatch;
exports.belongsToAssetDirectory = belongsToAssetDirectory;
const content_files_1 = require("../../../data/importer/content-files");
class PreparedAssetBatch {
    groups;
    constructor(groups) {
        this.groups = groups;
    }
    get files() {
        return this.groups.flatMap((group) => group.files);
    }
    async store() {
        const results = await Promise.allSettled(this.groups.map((group) => group.importer.doImport(group.files)));
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) {
            const rollbackResults = await Promise.allSettled(results.flatMap((result, index) => result.status === 'fulfilled' ? [this.groups[index].importer.rollback(result.value)] : []));
            const rollbackFailures = rollbackResults.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
            if (rollbackFailures.length > 0) {
                // AggregateError is the native error for preserving storage and rollback
                // failures; unlike GhostError it takes an iterable before its options.
                // eslint-disable-next-line reedito/ghost-custom/ghost-error-usage
                throw new AggregateError([failure.reason, ...rollbackFailures], 'Asset storage failed and rollback was incomplete.', { cause: failure.reason });
            }
            throw failure.reason;
        }
    }
    rewriteRows(rows) {
        const importData = {
            data: { data: { posts: rows, tags: [], users: [] } },
        };
        for (const group of this.groups) {
            importData[group.type] = group.files;
            group.importer.preProcess(importData);
        }
    }
}
exports.PreparedAssetBatch = PreparedAssetBatch;
async function prepareAssetBatch(archive, directory, baseDirectory, deps = {}) {
    const handlers = deps.handlers ?? (0, content_files_1.createContentFileHandlers)();
    const importers = deps.importers ?? (0, content_files_1.createContentFileImporters)();
    const importerByType = new Map(importers.map((importer) => [importer.type, importer]));
    const groups = await Promise.all(handlers.map(async (handler) => {
        const files = archive
            .getFiles(directory, handler.extensions)
            .filter((file) => belongsToAssetDirectory(file.name, handler.type, baseDirectory));
        if (files.length === 0) {
            return;
        }
        const importer = importerByType.get(handler.type);
        if (!importer) {
            return;
        }
        return {
            type: handler.type,
            files: await handler.loadFile(files, baseDirectory),
            importer,
        };
    }));
    const presentGroups = groups.filter((group) => group !== undefined);
    return presentGroups.length > 0 ? new PreparedAssetBatch(presentGroups) : undefined;
}
function belongsToAssetDirectory(fileName, type, baseDirectory) {
    const parts = fileName.split('/').filter(Boolean);
    if (baseDirectory && parts[0] === baseDirectory) {
        parts.shift();
    }
    if (parts[0] === 'content') {
        parts.shift();
    }
    return parts.length > 1 && parts[0] === type;
}
