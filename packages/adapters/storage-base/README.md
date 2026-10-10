# reedito-storage-base

Base class for Reedito storage adapters. A storage adapter
decides where uploaded images, media, and files are stored and how they're
served — the local filesystem, S3, Google Cloud Storage, etc.

See the upstream [Ghost adapters documentation](https://docs.ghost.org/config#adapters)
for the source configuration model. Reedito-specific documentation is not yet published.

## Usage

This workspace package is not published to npm. In a complete Reedito checkout,
use pnpm from the repository root to install workspace dependencies:

```bash
pnpm bootstrap
```

Extend `StorageBase` and implement every method listed in `requiredFns`:
`exists`, `save`, `serve`, `delete`, and `read`. TypeScript adapters must also
implement the declared `saveRaw(buffer, targetPath)` and `urlToPath(url)`
methods.

```js
const {StorageBase} = require('reedito-storage-base');

class MyStorage extends StorageBase {
    // Resolve to true if a file already exists at targetDir/fileName.
    exists(fileName, targetDir) { /* ... */ }
    // Persist `file` and resolve to the public URL/path it's served at.
    save(file, targetDir) { /* ... */ }
    // Return an Express middleware that serves stored files.
    serve() { /* ... */ }
    // Remove a stored file.
    delete(fileName, targetDir) { /* ... */ }
    // Resolve to a Buffer of the file at options.path.
    read(options) { /* ... */ }
}

module.exports = MyStorage;
```

The base class supplies these helpers:

- `getTargetDir(baseDir)` returns a `YYYY/MM` path, optionally inside `baseDir`.
- `getSanitizedFileName(fileName)` replaces unsupported filename characters with `-`.
- `getUniqueFileName(file, targetDir)` and `generateUnique(dir, name, ext, i)`
  call `this.exists(...)` until they find a free filename (`exists` must return
  a `Promise<boolean>`).

### Installing and activating

Place the adapter at `content/adapters/storage/MyStorage/index.js` and activate
it in your Reedito config. Storage has three separate feature keys — `active`
(images), `media`, and `files` — and the block named after the adapter is
passed to its constructor:

```json
{
    "storage": {
        "active": "MyStorage",
        "MyStorage": {}
    }
}
```

## Develop

This is a workspace package in the Reedito monorepo. From the repo root:

```bash
pnpm --filter reedito-storage-base build   # compile to build/ with tsc (ESM)
pnpm --filter reedito-storage-base test    # type-check + unit tests
```

This package is ESM-only and compiled with `tsc` (`module: nodenext`). Relative
imports in `src/` must carry an explicit extension; write the real `.ts` one —
`import {x} from './x.ts'` — and `tsc` rewrites it to `.js` on emit
(`rewriteRelativeImportExtensions`).

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](https://github.com/TryGhost/Ghost/blob/main/LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.
