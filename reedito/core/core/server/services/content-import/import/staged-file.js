"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImportFileStager = createImportFileStager;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_path_1 = __importDefault(require("node:path"));
// Stages uploads at the root of the imports storage adapter. The job reads the staged
// file from its path, so the adapter is the local store storage:imports defaults to.
function createImportFileStager(getStorage) {
    return {
        async stage({ filePath, fileName }) {
            const storage = getStorage();
            const name = `content-csv-import-${node_crypto_1.default.randomUUID()}`;
            try {
                const url = await storage.save({ name, path: filePath }, storage.storagePath);
                return { path: node_path_1.default.join(storage.storagePath, storage.urlToPath(url)), name: fileName };
            }
            catch (error) {
                await storage.delete(name).catch(() => { });
                throw error;
            }
        },
        async remove(file) {
            await getStorage().delete(node_path_1.default.basename(file.path));
        },
    };
}
