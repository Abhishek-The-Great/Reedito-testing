# @reedito/adapter-base-sso

Base class for Reedito SSO adapters. An SSO adapter lets an external identity
provider sign users in to Reedito admin: it reads credentials off the incoming
request, resolves them to an identity, and maps that identity to a Reedito user.

See the upstream [Ghost adapters documentation](https://docs.ghost.org/config#adapters)
for the source configuration model. Reedito-specific documentation is not yet published.

## Usage

This workspace package is not published to npm. In a complete Reedito checkout,
use pnpm from the repository root to install workspace dependencies:

```bash
pnpm bootstrap
```

Extend `SSOBase` and implement every method listed in `requiredFns`:

- `getRequestCredentials(request)` — pull the credentials (token, cookie, ...)
  off the incoming Express request, or return `null` if none are present.
- `getIdentityFromCredentials(credentials)` — validate the credentials and
  resolve them to an identity, or `null`.
- `getUserForIdentity(identity)` — map the identity to a Reedito user, or `null`.

Reedito injects a user repository after constructing the adapter, exposed through
the protected `getUserByEmail(email)` and `getOwnerUser()` helpers — use these
to resolve Reedito users without reaching into Reedito's model layer directly.

```js
const {SSOBase} = require('@reedito/adapter-base-sso');

class MySSO extends SSOBase {
    async getRequestCredentials(request) {
        const token = request.get('authorization');
        return token ?? null;
    }

    async getIdentityFromCredentials(token) {
        return this.verify(token); // your validation → identity, or null
    }

    async getUserForIdentity(identity) {
        // `getUserByEmail` is provided by the base class
        return this.getUserByEmail(identity.email);
    }
}

module.exports = MySSO;
```

### Installing and activating

Place the adapter at `content/adapters/sso/MySSO/index.js` and activate it in
your Reedito config:

```json
{
    "adapters": {
        "sso": {
            "active": "MySSO",
            "MySSO": {}
        }
    }
}
```

## Develop

This is a workspace package in the Reedito monorepo. From the repo root:

```bash
pnpm --filter @reedito/adapter-base-sso build   # compile to build/ with tsc (ESM)
pnpm --filter @reedito/adapter-base-sso test    # type-check + unit tests
pnpm --filter @reedito/adapter-base-sso dev     # rebuild on change
```

This package is ESM-only and compiled with `tsc` (`module: nodenext`). Relative
imports in `src/` must carry an explicit extension; write the real `.ts` one —
`import {x} from './x.ts'` — and `tsc` rewrites it to `.js` on emit
(`rewriteRelativeImportExtensions`).

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](https://github.com/TryGhost/Ghost/blob/main/LICENSE). Ghost and the Ghost Logo are trademarks of Ghost Foundation Ltd. Please see our [trademark policy](https://ghost.org/trademark/) for info on acceptable usage.
