# @reedito/adapter-base-scheduling

Base class for Reedito scheduling adapters. A scheduling adapter is responsible
for firing Reedito's time-based jobs — publishing scheduled posts, sending
scheduled newsletters, automations, gift reminders — by calling back into
Reedito's API at the requested time.

See the upstream [Ghost adapters documentation](https://docs.ghost.org/config#adapters)
for the source configuration model. Reedito-specific documentation is not yet published.

## Usage

This workspace package is not published to npm. In a complete Reedito checkout,
use pnpm from the repository root to install workspace dependencies:

```bash
pnpm bootstrap
```

Extend `SchedulingBase` and implement every method listed in `requiredFns`:
`run`, `schedule`, and `unschedule`. `register` and `rescheduleAll` are
inherited from the base class.

Each job has a `time` (unix timestamp), a `url` to call back (carrying a
JWT-signed admin token), and an `extra` object holding the `httpMethod` to use.
At `time`, the adapter fires the HTTP request described by the job.

```js
const {SchedulingBase} = require('@reedito/adapter-base-scheduling');

class MyScheduler extends SchedulingBase {
    constructor(options) {
        super();
        // `options` is the settings block from your Reedito config
    }

    // Called on boot. Fire any jobs whose time has already passed and start
    // watching for upcoming ones.
    run() { /* ... */ }

    // Queue `job` to fire at job.time via job.extra.httpMethod against job.url.
    schedule(job) { /* ... */ }

    // Remove a previously-scheduled job.
    unschedule(job, options) { /* ... */ }
}

module.exports = MyScheduler;
```

### Installing and activating

Place the adapter at `content/adapters/scheduling/MyScheduler/index.js` and
activate it in your Reedito config:

```json
{
    "scheduling": {
        "active": "MyScheduler",
        "MyScheduler": {}
    }
}
```

## Develop

This is a workspace package in the Reedito monorepo. From the repo root:

```bash
pnpm --filter @reedito/adapter-base-scheduling build   # compile to build/ with tsc (ESM)
pnpm --filter @reedito/adapter-base-scheduling test    # type-check + unit tests
pnpm --filter @reedito/adapter-base-scheduling dev     # rebuild on change
```

This package is ESM-only and compiled with `tsc` (`module: nodenext`). Relative
imports in `src/` must carry an explicit extension; write the real `.ts` one —
`import {x} from './x.ts'` — and `tsc` rewrites it to `.js` on emit
(`rewriteRelativeImportExtensions`).

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](https://github.com/TryGhost/Ghost/blob/main/LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.
