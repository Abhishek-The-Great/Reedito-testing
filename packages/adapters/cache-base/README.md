# @reedito/adapter-base-cache

Base class for Reedito cache adapters. A cache adapter backs one of Reedito's
internal caches (settings, image sizes, gscan results, ...) with a store of
your choice — an in-process map, Redis, Memcached, etc.

See the upstream [Ghost adapters documentation](https://docs.ghost.org/config#adapters)
for the source configuration model. Reedito-specific documentation is not yet published.

## Usage

This workspace package is not published to npm. In a complete Reedito checkout,
use pnpm from the repository root to install workspace dependencies:

```bash
pnpm bootstrap
```

Extend `CacheBase` and implement every method listed in `requiredFns`:
`get`, `set`, `reset`, and `keys`. Each may be synchronous or return a
`Promise`.

```js
const {CacheBase} = require('@reedito/adapter-base-cache');

class MyCache extends CacheBase {
    constructor(config) {
        super();
        // `config` is the settings block from your Reedito config (see below)
        this.store = new Map();
    }

    get(key) {
        return this.store.get(key);
    }

    set(key, value) {
        this.store.set(key, value);
    }

    reset() {
        this.store.clear();
    }

    // Deprecated — may be removed in a future version. Returns all cache keys.
    keys() {
        return [...this.store.keys()];
    }
}

module.exports = MyCache;
```

### Installing and activating

Place the adapter at `content/adapters/cache/MyCache/index.js` and activate it
in your Reedito config. `active` names the adapter; the matching block is passed
to its constructor:

```json
{
    "adapters": {
        "cache": {
            "active": "MyCache",
            "MyCache": {}
        }
    }
}
```

## Develop

This is a workspace package in the Reedito monorepo. From the repo root:

```bash
pnpm --filter @reedito/adapter-base-cache build   # compile to build/ with tsc (ESM)
pnpm --filter @reedito/adapter-base-cache test    # type-check + unit tests
```

This package is ESM-only and compiled with `tsc` (`module: nodenext`). Relative
imports in `src/` must carry an explicit extension; write the real `.ts` one —
`import {x} from './x.ts'` — and `tsc` rewrites it to `.js` on emit
(`rewriteRelativeImportExtensions`).

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](https://github.com/TryGhost/Ghost/blob/main/LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.
