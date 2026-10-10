# Reedito End-To-End Test Suite

This top-level workspace is Reedito's browser end-to-end test suite. It runs
automated browser tests against a complete, running Reedito instance to verify
critical user journeys across packages and applications. A package's own
Playwright suite is an _acceptance_ suite, not an E2E one — see the
[testing guide](../docs/contributing/testing.md) for how the layers differ.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js installed (pnpm is managed via corepack — run `corepack enable pnpm` first)

### Running Tests

To run the test, within this `e2e` folder run:

```bash
# Install dependencies
pnpm

# All tests
pnpm test
```

### Dev Environment Mode (Recommended for Development)

If `REEDITO_E2E_MODE` is unset, the e2e shell entrypoints auto-select:

- `dev` when the local admin dev server is reachable on `http://127.0.0.1:5174`
- `build` otherwise

To use dev mode, start `pnpm dev` before running tests:

```bash
# Terminal 1: Start dev environment (from repository root)
pnpm dev

# Terminal 2: Run e2e tests (from e2e folder)
pnpm test
```

If infra is already running, `pnpm infra:up` is safe to run again.
For dev-mode test runs, `infra:up` also ensures required local Reedito/gateway dev images exist.
If you want to force a mode, set `REEDITO_E2E_MODE=dev` or `REEDITO_E2E_MODE=build` explicitly.

### Analytics Development Flow

When working on analytics locally, use:

```bash
# Terminal 1 (repo root)
pnpm dev:analytics

# Terminal 2
pnpm test:analytics
```

E2E test scripts automatically sync Tinybird tokens when Tinybird is running.

### Build Mode (Prebuilt Image)

Use build mode when you don’t want to run dev servers. It uses a prebuilt Reedito image and serves public assets from `/reedito/assets`.

```bash
# From repository root
pnpm build
pnpm --filter @reedito/e2e build:apps
REEDITO_E2E_BASE_IMAGE=<reedito-image> pnpm --filter @reedito/e2e build:docker
REEDITO_E2E_MODE=build pnpm --filter @reedito/e2e infra:up

# Run tests
REEDITO_E2E_MODE=build REEDITO_E2E_IMAGE=reedito-e2e:local pnpm --filter @reedito/e2e test
```

Build-mode E2E infra uses tmpfs-backed MySQL storage by default so database
snapshot restore cycles stay fast and isolated from local development data.
Set `REEDITO_E2E_MYSQL_TMPFS=false` to use the normal Docker volume instead, or
`REEDITO_E2E_MYSQL_TMPFS_SIZE=4g` to adjust the tmpfs size.

Set `REEDITO_E2E_TINYBIRD_SLIM=true` and provide
`REEDITO_E2E_TINYBIRD_SLIM_IMAGE` to use a privately published slim Tinybird
image: about 0.7GB pulled and 2.4GB on disk, compared with about 2.1GB and 6.9GB
for the upstream image. CI uses it only when the repository variable
`REEDITO_TINYBIRD_SLIM_IMAGE` is configured. Local dev
(`compose.dev.analytics.yaml`) uses the upstream image.

The slim image's GHCR package is internal, so a pull can legitimately fail — most
often on a PR from a public fork, whose token cannot read it. `infra-up.sh` warns
and falls back to the upstream image rather than failing the run. CI leaves the
flag off for cross-repo PRs so those runs skip the doomed pull entirely.

For a CI-like local preflight (pulls Playwright + gateway images and starts infra), run:

```bash
pnpm --filter @reedito/e2e preflight:build
```

### Running Specific Tests

```bash
# Run the Admin sign-in test
pnpm test tests/admin/signin.test.ts

# Matching a pattern
pnpm test --grep "homepage"

# With browser visible (for debugging)
pnpm test --debug
```

## Tests Development

See [Writing Browser E2E Tests](../docs/contributing/e2e-testing.md) for the
canonical conventions, Page Object pattern, locator priority, waiting patterns,
and worked examples. This README covers the local workspace, infrastructure,
fixtures, and commands.

The test suite is organized into separate directories for different areas/functions:

### **Current Test Suites**

- `tests/public/` - Public-facing site tests (homepage, posts, etc.)
- `tests/admin/` - Reedito admin panel tests (login, content creation, settings)
- `tests/portal/` - Portal member journey tests

We can decide whether to add additional sub-folders as we add more tests.

Project folder structure can be seen below:

```text
e2e/
├── tests/                      # All the tests
│   ├── public/                 # Public site tests
│   │   └── member-signup.test.ts
│   ├── admin/                  # Admin site tests
│   │   └── signin.test.ts
│   ├── portal/                 # Portal tests
│   ├── global.setup.ts         # Global setup script
│   └── global.teardown.ts      # Global teardown script
├── helpers/                    # All helpers that support the tests, utilities, fixtures, page objects etc.
│   ├── playwright/             # Playwright specific helpers
│   │   └── fixture.ts          # Playwright fixtures
│   ├── pages/                  # Page Object Models, grouped by area
│   │   ├── base-page.ts        # Base class for all page objects
│   │   └── admin/              # e.g. login-page.ts, admin-page.ts
│   ├── environment/            # Reedito container/database lifecycle
│   ├── services/               # Test doubles (Mailgun, etc.)
│   └── utils/                  # Shared utilities
├── data-factory/               # Test data factories (see its own README)
├── visual-regression/          # Screenshot baseline suite (separate config)
├── scripts/                    # Infra and runner shell scripts
├── playwright.config.mjs       # Playwright configuration
├── eslint.config.js            # Lint config for the workspace
├── package.json                # Dependencies and scripts
└── tsconfig.json               # TypeScript configuration and path aliases
```

### Global Setup and Teardown

Tests use [Project Dependencies](https://playwright.dev/docs/test-global-setup-teardown#option-1-project-dependencies) to define special tests as global setup and teardown tests:

- Global Setup: `tests/global.setup.ts` - runs once before all tests
- Global Teardown: `tests/global.teardown.ts` - runs once after all tests

### Playwright Fixtures

[Playwright Fixtures](https://playwright.dev/docs/test-fixtures) are defined in `helpers/playwright/fixture.ts` and provide reusable test setup/teardown logic.

The fixtures a test usually reaches for:

- `page` - browser page against this test's Reedito instance
- `pageWithAuthenticatedUser` - the same, already signed in to Reedito Admin
- `reeditoAccountOwner` - the owner account's credentials
- `reeditoInstance` - the running instance: `baseUrl`, `database`, `port`, `siteUuid`, `containerId`, `instanceId`
- `resolvedIsolation` - `'per-file' | 'per-test'` for the current test
- `resetEnvironment()` - force an environment recycle (see the escape hatch below)

The fixture resolves isolation mode per test file:

- Default: per-file isolation (one Reedito environment cycle per file)
- Opt-in per-test: call `usePerTestIsolation()` from `@/helpers/playwright/isolation` at the root of the file
- Forced per-test: any run with `fullyParallel: true`

### Test Isolation

Test isolation is still automatic, but no longer always per-test.

Infrastructure (MySQL, Redis, Mailpit, Tinybird) must already be running before tests start. Use `pnpm dev` or `pnpm --filter @reedito/e2e infra:up`.

Global setup (`tests/global.setup.ts`) does:

- Cleans up e2e containers and test databases
- Creates a base database, starts Reedito, waits for health, snapshots the DB

Per-file mode (`helpers/playwright/fixture.ts`) does:

- Clones a new database from snapshot at file boundary
- Restarts Reedito with the new database and waits for readiness
- Reuses that environment for tests in the file

Per-test mode (`helpers/playwright/fixture.ts`) does:

- Clones a new database from snapshot for each test
- Restarts Reedito with the new database and waits for readiness

Environment identity for per-file reuse:

- `config` participates in the environment identity.
- `labs` participates in the environment identity.
- If either changes between tests in the same file, the shared per-file Reedito environment is recycled before reuse.

Fixture option behavior:

- `config`: use for boot-time Reedito config that should get a fresh environment when it changes.
- `labs`: use for labs flags that should get a fresh environment when they change.

Escape hatch:

- `resetEnvironment()` is supported only in `beforeEach` hooks for per-file tests.
- Use it only before resolving stateful fixtures such as `baseURL`, `page`, `pageWithAuthenticatedUser`, or `reeditoAccountOwner`.
- Safe hook pattern: `test.beforeEach(async ({resetEnvironment}) => { ... })`
- Unsupported pattern: calling `resetEnvironment()` after `page` or an authenticated session has already been created.
- ESLint catches the obvious misuse cases, but the runtime guard in the fixture remains the hard safety check.

Opting into per-test isolation:

- Use `usePerTestIsolation()` from `@/helpers/playwright/isolation` at the root of the file.
- This configures both Playwright parallel mode and the fixture isolation in one call.

Global teardown (`tests/global.teardown.ts`) does:

- Cleans up e2e containers and test databases (infra services stay running)

Modes:

- Dev mode: Reedito mounts source code and proxies assets to host dev servers
- Build mode: Reedito uses a prebuilt image and serves assets from `/reedito/assets`

### Best Practices

1. **Use Page Objects for reusable UI structure and interactions.** Direct semantic locators are fine for small, one-off assertions where a Page Object would not improve reuse or readability.
2. **Add meaningful assertions** beyond just page loads. Keep assertions in tests.
3. **Prefer semantic locators**, such as `getByRole()` and `getByLabel()`. Use stable test IDs when semantic locators are unavailable. Avoid selectors coupled to styling or DOM position.
4. **Clean up test data** when tests modify Reedito state
5. **Group related tests** in describe blocks
6. **Do not use should to describe test scenarios**

## CI Integration

Tests run automatically in GitHub Actions on every PR and commit to `main`.

### CI Process

1. **Setup**: Ubuntu runner with Node.js and Docker
2. **Build Assets**: Build server/admin assets and public app UMD bundles
3. **Build E2E Image**: `pnpm --filter @reedito/e2e build:docker` (layers public apps into Reedito's built admin assets, served from `/reedito/assets`)
4. **Prepare E2E Runtime**: Pull Playwright/gateway images in parallel, start infra, and sync Tinybird state (`pnpm --filter @reedito/e2e preflight:build`)
5. **Test Execution**: Run Playwright E2E tests inside the official Playwright container
6. **Artifacts**: Upload Playwright traces and reports on failure

## Available Scripts

Within the e2e directory:

```bash
# Run all tests
pnpm test

# Start/stop test infra (MySQL/Redis/Mailpit/Tinybird)
pnpm infra:up
pnpm infra:down

# CI-like preflight for build mode (pulls images + starts infra)
pnpm preflight:build

# Debug failed tests (keeps containers)
PRESERVE_ENV=true pnpm test

# Run TypeScript type checking
pnpm test:types

# Lint code and tests
pnpm lint

# Build (for utilities)
pnpm build
pnpm dev           # Watch mode for TypeScript compilation
```

Payment-provider checkout, billing, and webhooks are disabled in this fork. Historical
provider data remains in the database for upgrade compatibility; see the
[payment-free build notes](../docs/codebase/payment-free-build.md).

## Resolving issues

### Test Failures

1. **Screenshots**: Playwright captures screenshots on failure
2. **Traces**: Available in `test-results/` directory
3. **Debug Mode**: Run with `pnpm test --debug` or `pnpm test --ui` to see browser
4. **Verbose Logging**: Check CI logs for detailed error information
