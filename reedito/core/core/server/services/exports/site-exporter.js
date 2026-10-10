"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteExporter = void 0;
const errors = __importStar(require("@tryghost/errors"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const export_components_1 = require("./export-components");
/**
 * Composes a site export zip from the same services the individual export
 * endpoints call, streamed while it is being built. A component that fails
 * to acquire is skipped and logged rather than failing the request: the
 * response headers are typically already sent, so a mid-flight HTTP error
 * is impossible and a bundle missing one piece beats a broken download.
 */
class SiteExporter {
    #deps;
    constructor(deps) {
        this.#deps = deps;
    }
    /**
     * Builds a zip stream of the selected components; the caller pipes it to
     * the response while it fills. Deflate-compressed — the nested theme zips
     * opt out per-entry since they are already compressed.
     */
    createArchive(components) {
        // Lazy-loaded off the boot hotpath: archiver pulls in zlib/streams and is
        // only needed once an export request actually builds an archive.
        const { ZipArchive } = require('archiver');
        const archive = new ZipArchive();
        const cleanups = [];
        // 'close' fires on normal end and on destroy (client disconnect),
        // so temp files are removed on every path
        archive.once('close', () => {
            for (const cleanup of cleanups) {
                cleanup().catch(() => { });
            }
        });
        this.#populate(archive, new Set(components), cleanups).catch((err) => {
            archive.destroy(err instanceof Error ? err : new errors.InternalServerError({ message: String(err) }));
        });
        return archive;
    }
    async #populate(archive, components, cleanups) {
        for (const component of export_components_1.SYNC_EXPORT_COMPONENTS) {
            if (archive.destroyed) {
                return;
            }
            if (!components.has(component)) {
                continue;
            }
            await this.#appendComponent(archive, component, cleanups);
        }
        if (archive.destroyed) {
            return;
        }
        await archive.finalize();
    }
    async #appendComponent(archive, component, cleanups) {
        try {
            switch (component) {
                case 'content': {
                    const data = await this.#deps.exportContent();
                    archive.append(JSON.stringify(data), { name: 'export.json' });
                    break;
                }
                case 'members':
                    this.#appendStream(archive, await this.#deps.exportMembersCSV(), 'members.csv');
                    break;
                case 'analytics':
                    this.#appendStream(archive, await this.#deps.exportPostAnalyticsCSV(), 'post-analytics.csv');
                    break;
                case 'themes':
                    await this.#appendThemes(archive, cleanups);
                    break;
                case 'routes':
                    await this.#appendYamlFiles(archive);
                    break;
            }
        }
        catch (err) {
            logging_1.default.error(new errors.InternalServerError({
                message: `Site export: the ${component} component failed and was skipped`,
                err: err instanceof Error ? err : undefined,
            }));
        }
    }
    /**
     * Ties a streaming entry's lifecycle to the archive in both directions:
     * a source error destroys the archive — archiver wraps sources with
     * `.pipe()`, which never propagates errors, so the response would
     * otherwise hang forever — and a closed archive destroys the source, so
     * a paused row stream releases its DB connection.
     */
    #appendStream(archive, source, name) {
        const destroyable = source;
        // Closed while the source was being acquired — a 'close' listener
        // registered now would never fire
        if (archive.destroyed) {
            destroyable.destroy?.();
            return;
        }
        source.on('error', (err) => {
            archive.destroy(err);
        });
        archive.once('close', () => {
            destroyable.destroy?.();
        });
        archive.append(source, { name });
    }
    /**
     * One nested zip per theme — the exact artifact the theme upload UI
     * restores from — staged as temp files and streamed off disk rather than
     * buffered. A theme that fails to zip is skipped so the rest still make
     * it into the bundle.
     */
    async #appendThemes(archive, cleanups) {
        for (const name of this.#deps.listThemes()) {
            if (archive.destroyed) {
                return;
            }
            try {
                const { zipPath, cleanup } = await this.#deps.zipTheme(name);
                // Closed while this theme was zipping — the close handler has
                // already run the cleanups, so remove the temp file directly
                if (archive.destroyed) {
                    cleanup().catch(() => { });
                    return;
                }
                cleanups.push(cleanup);
                archive.file(zipPath, { name: `themes/${name}.zip`, store: true });
            }
            catch (err) {
                logging_1.default.error(new errors.InternalServerError({
                    message: `Site export: the ${name} theme failed to zip and was skipped`,
                    err: err instanceof Error ? err : undefined,
                }));
            }
        }
    }
    async #appendYamlFiles(archive) {
        const files = [
            ['routes.yaml', () => this.#deps.exportRoutesYaml()],
            ['redirects.yaml', () => this.#deps.exportRedirectsYaml()],
        ];
        for (const [filename, getContents] of files) {
            try {
                archive.append(await getContents(), { name: filename });
            }
            catch (err) {
                logging_1.default.error(new errors.InternalServerError({
                    message: `Site export: ${filename} failed and was skipped`,
                    err: err instanceof Error ? err : undefined,
                }));
            }
        }
    }
}
exports.SiteExporter = SiteExporter;
