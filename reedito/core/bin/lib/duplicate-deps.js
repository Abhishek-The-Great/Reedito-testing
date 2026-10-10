"use strict";
// Finds packages loaded twice in one process: once from a custom adapter's own
// `node_modules` and once from Reedito's.
//
// An adapter is installed as a self-contained directory with its own dependency
// tree (managed deployments place them under `/home/reedito/adapters/<type>/<Name>`). Whatever
// it doesn't install itself resolves by walking up to Reedito's `node_modules`, so
// a package it *does* install becomes a second module instance - which breaks
// `instanceof` against a base class (hence the name-based fallbacks in
// `adapter-manager.ts` and `bin/validate-adapters.ts`) and splits module-level
// state, as `@tryghost/metrics` would with no `globalThis` guard to save it.
//
// @NOTE: `collectLoadedFiles` unions two sources because neither contains the
// other. `require.cache` holds no ESM file, neither an ESM adapter's entry point
// nor anything it `import`s - though a CommonJS dependency of one does still go
// through the cache, so the gap is ESM files specifically. The inspector reports
// every script V8 parsed, ESM included, but `.json` and native `.node` modules
// aren't scripts and only the cache lists them. The cache is also the fallback
// when the inspector is unavailable.
//
// @NOTE: this is for the installed tree built into an image, not a local
// checkout. Reedito's copy of a `workspace:*` dependency - every adapter base class
// among them - resolves through a symlink to `packages/<name>`, outside any
// `node_modules`, leaving an adapter's copy with nothing to be compared against.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectLoadedFiles = collectLoadedFiles;
exports.parsePackageFromPath = parsePackageFromPath;
exports.checkDuplicateDependencies = checkDuplicateDependencies;
exports.formatDuplicateReport = formatDuplicateReport;
const node_fs_1 = __importDefault(require("node:fs"));
const node_inspector_1 = __importDefault(require("node:inspector"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const NODE_MODULES = 'node_modules';
/**
 * The files V8 has parsed in this process, whatever their module format.
 *
 * Enabling the `Debugger` domain replays a `scriptParsed` event for every script
 * already parsed, synchronously, so this can run after the adapters have and
 * there is nothing to await. Empty when the inspector is unavailable, e.g. a Node
 * built `--without-inspector`.
 */
function parsedScriptFiles() {
    let session;
    try {
        session = new node_inspector_1.default.Session();
        session.connect();
    }
    catch {
        return [];
    }
    const files = [];
    session.on('Debugger.scriptParsed', ({ params }) => {
        // Nothing with no file behind it - `node:` internals, `eval`, `data:` URLs -
        // can belong to a package.
        if (!params.url.startsWith('file://')) {
            return;
        }
        try {
            files.push((0, node_url_1.fileURLToPath)(params.url));
        }
        catch {
            // Nor anything Node won't convert back to a path.
        }
    });
    session.post('Debugger.enable');
    session.post('Debugger.disable');
    session.disconnect();
    return files;
}
/** Every file this process has loaded, from both of the sources above. */
function collectLoadedFiles(cjsCachedFiles) {
    return [...new Set([...cjsCachedFiles, ...parsedScriptFiles()])];
}
function realpathOrNull(target) {
    try {
        return node_fs_1.default.realpathSync(target);
    }
    catch {
        return null;
    }
}
/** Whether `filePath` sits inside `directory`. Both are expected to be realpaths. */
function isInside(filePath, directory) {
    const relative = node_path_1.default.relative(directory, filePath);
    // Match the first segment exactly, so a name that merely begins with dots
    // isn't taken for traversal the way startsWith('..') would take it.
    const [firstSegment] = relative.split(node_path_1.default.sep);
    return relative !== '' && firstSegment !== '..' && !node_path_1.default.isAbsolute(relative);
}
/** The version a package declares, or `unknown` - better reported than dropped. */
function readVersion(packagePath) {
    try {
        const { version } = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(packagePath, 'package.json'), 'utf8'));
        return typeof version === 'string' ? version : 'unknown';
    }
    catch {
        return 'unknown';
    }
}
/**
 * Attribute a loaded file to the package that physically contains it: whatever
 * the *last* `node_modules` segment of its path names. That holds for any
 * installer's layout, npm's flat `node_modules/<name>` and pnpm's
 * `.pnpm/<name>@<version>/node_modules/<name>` alike. `null` when the file is in
 * no package: Reedito's own source, or an adapter's own `index.js`.
 */
function parsePackageFromPath(filePath) {
    const segments = filePath.split(node_path_1.default.sep);
    const start = segments.lastIndexOf(NODE_MODULES) + 1;
    const first = segments[start];
    // A dot-prefixed entry is an installer's own directory - pnpm's store, `.bin`,
    // a cache - and npm forbids a package name from looking like one.
    if (start === 0 || !first || first.startsWith('.')) {
        return null;
    }
    // Scoped packages take two segments: `@tryghost/logging`.
    const end = start + (first.startsWith('@') ? 2 : 1);
    if (!segments[end - 1]) {
        return null;
    }
    return {
        name: segments.slice(start, end).join('/'),
        path: segments.slice(0, end).join(node_path_1.default.sep),
    };
}
/**
 * Find packages loaded from both an adapter's dependency tree and Reedito's own.
 *
 * Adapters are checked first: `content/adapters` lives inside the Reedito
 * installation, so the two sides are not mutually exclusive.
 */
function checkDuplicateDependencies({ cachedFiles, adapterRoots, reeditoNodeModulesRoots, mustBeSingleCopy, }) {
    // Compare resolved paths on both sides, never specifiers: `require.cache`
    // reports realpaths, and pnpm reaches these roots through symlinks.
    const realAdapterRoots = adapterRoots.map(realpathOrNull).filter((root) => root !== null);
    const realReeditoRoots = reeditoNodeModulesRoots.map(realpathOrNull).filter((root) => root !== null);
    const adapterPackages = new Map();
    const reeditoPackages = new Map();
    for (const cachedFile of cachedFiles) {
        const realFile = realpathOrNull(cachedFile) ?? cachedFile;
        const inAdapter = realAdapterRoots.some((root) => isInside(realFile, root));
        if (!inAdapter && !realReeditoRoots.some((root) => isInside(realFile, root))) {
            continue;
        }
        const location = parsePackageFromPath(realFile);
        if (!location) {
            continue;
        }
        if (!inAdapter) {
            // Reedito's tree can hold more than one copy of a name, and any of them is
            // the other half of the comparison, so the first one seen will do.
            if (!reeditoPackages.has(location.name)) {
                reeditoPackages.set(location.name, location.path);
            }
            continue;
        }
        // Two adapters can each bundle their own copy, so keep every location.
        const packagePaths = adapterPackages.get(location.name) ?? new Set();
        adapterPackages.set(location.name, packagePaths.add(location.path));
    }
    // Reading versions only once both sides are known costs one manifest read per
    // reported copy, rather than one per cached file.
    const duplicates = [];
    for (const [name, packagePaths] of [...adapterPackages].sort(([a], [b]) => a.localeCompare(b))) {
        const reeditoPath = reeditoPackages.get(name);
        if (!reeditoPath) {
            continue;
        }
        const reedito = { version: readVersion(reeditoPath), path: reeditoPath };
        for (const packagePath of packagePaths) {
            duplicates.push({
                name,
                adapter: { version: readVersion(packagePath), path: packagePath },
                reedito,
            });
        }
    }
    const singleCopy = new Set(mustBeSingleCopy);
    return { duplicates, blocking: duplicates.filter(({ name }) => singleCopy.has(name)) };
}
/** Render a report in the same indented style as the adapter results. */
function formatDuplicateReport({ duplicates, blocking }) {
    if (!duplicates.length) {
        return '  ok    no duplicate dependencies\n';
    }
    return [
        `\n${duplicates.length} package(s) loaded from both an adapter and Reedito:\n`,
        ...duplicates.map(({ name, adapter, reedito }) => `- ${name}\n` +
            `    adapter ${adapter.version}  ${adapter.path}\n` +
            `    reedito   ${reedito.version}  ${reedito.path}\n`),
        '\nEach duplicate is loaded into memory twice. Have the adapter declare the\n' +
            'package as a peer dependency of Reedito, or match the version Reedito ships,\n' +
            'so the install can be deduplicated.\n\n',
        blocking.length
            ? `  FAIL  duplicate dependencies: ${blocking.map(({ name }) => name).join(', ')}\n` +
                '        A second copy of these breaks `instanceof` against the base class\n' +
                '        Reedito checks adapters with - they must resolve to a single copy.\n'
            : '  ok    duplicate dependencies (none of them must be a single copy)\n',
    ].join('');
}
