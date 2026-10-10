# Reedito project and action log

Updated: 2026-09-29 11:57:11 UTC

## Original goal and requests

The initial goal was: “use open source repo / download them / edit that code / add my payment gateway / host it / earn and boom ✺”. The user referenced [Open Source Alternative](https://www.opensourcealternative.to/), asked for a license-free repository, then asked to inspect and modify this repository. The project was confirmed to be based on Ghost, licensed under MIT; it is not license-free or public domain. Later requests asked to fix a bug, remove payment integrations, document the project and local setup, research names and hosting/domain providers, and rename the whole codebase to Reedito.

## Source, license, and branding

Reedito is an independent derivative of Ghost's open-source publishing platform. It is not an official Ghost release and is not affiliated with Ghost Foundation. The root `LICENSE` is MIT; retain its copyright/license notice. Ghost and the Ghost logo remain trademarks of Ghost Foundation Ltd. **Reedito.com is the chosen canonical brand domain.** Earlier research reported it available at a standard, non-premium price, but no purchase was made during that research. This source tree contains no production DNS, Reedito-owned Git remote, hosting, or deployment configuration; do not claim the domain is currently live or available without checking.

## Changes made

### Production-readiness follow-up — 2026-09-29

- Fixed a backup reliability bug: the POSIX shell pipeline could treat a failed
  `mysqldump` as successful when Restic exited successfully. The backup job now
  writes the SQL dump to a private temporary file, verifies each dump/upload/
  content/retention command, and cleans up the temporary dump. Added
  `scripts/deploy/backup-loop.test.js` to exercise failed and successful paths.
- Removed an undefined `stubStripeToken()` call from the host-limits E2E test.
  Core's combined application/test TypeScript check now passes.
- Portal suite passes (746 tests, 1 skipped); Portal lint and typecheck pass.
  Backup-loop tests pass (2); the changed Core test passes ESLint and Oxfmt.
- Core unit tests still run no assertions: Node's `uv_interface_addresses`
  call is denied in this execution environment, then Vitest fails while parsing
  the resulting sourcemap stack. Docker and Compose are unavailable here.
- After the user authorized the build's external requests, all configured
  `pnpm run build:production` targets completed: Core TypeScript, Core assets,
  Admin, and six public apps. Nx Cloud remote-cache connections timed out, but
  the targets continued locally and reported success. Admin emitted bundle
  warnings for externalized Node modules, a mixed dynamic import, and chunks
  over 500 kB. This is a successful source build, not a Docker image or live
  deployment.
- The supplied archives still lack Git metadata and the pinned Casper/Source
  submodules. This work updates source and instructions; it does not create a
  verified image or deploy a live site.

### Pinned-toolchain production verification — 2026-09-29 11:57 UTC

- Verified the frozen lockfile with the declared toolchain: Corepack pnpm
  `12.4.2` selected Node.js `22.23.1`; all 4,278 lockfile entries were already
  current and no dependency resolution changes were made.
- Dependency lifecycle setup hit an environment limit while the `re2` native
  fallback tried to extract Node headers (`fchown` returned `EINVAL`). This
  does not establish that the native build will work on the production builder.
- With the pinned toolchain, Core TypeScript, Core assets, and Admin production
  build completed. The public-app build was stopped by automatic review before
  it ran because the request would contact Google Cloud Storage and send
  repository/build metadata. No alternate or indirect build was attempted.
- The ZIP has no `.git` metadata, and Casper/Source are empty directories with
  no recorded gitlink commit pins. As a result, `pnpm bootstrap` cannot recover
  the exact submodules and `Dockerfile.production` cannot produce its intended
  full image from this ZIP alone. `deploy.md` now makes this a hard prerequisite.
- The earlier full source build under Node.js `24.19.0` and pnpm `11.25.0` did
  finish, but those versions do not match the pinned release toolchain; it is
  not a substitute for the blocked pinned-toolchain public-app build.
- Compose YAML and port exposure, deploy shell syntax, and the backup-loop
  regression tests were checked. VPS/Docker startup, TLS, real email delivery,
  Sentry alert delivery, R2 backup/restore, and a live deployment remain
  untested. This ZIP is a source package, not a production image or a confirmed
  deploy-ready release.

### Production deployment groundwork — 2026-09-27

- Added `compose.production.yaml` for a single VPS: MySQL 8.4, Reedito, Caddy,
  persistent database/content/certificate volumes, health checks, and rotated
  container logs. No ports for the database or app are exposed publicly.
- Added `.env.production.example`; actual credentials are not committed. The
  production `.env.production` and `secrets/` directory are Git-ignored, and
  Docker build context excludes them too. `scripts/deploy/init-secrets.sh`
  generates random DB/Restic secrets and prompts without echo for Resend SMTP
  and Mailgun API keys.
- Configured SMTP sign-in mail with Resend, bulk newsletter API delivery with
  Mailgun, optional server/client Sentry DSNs, and daily encrypted Restic backups
  to a private Cloudflare R2 bucket. Backup retention is 7 daily, 5 weekly, and
  6 monthly snapshots. A restore still needs to be tested by the operator.
- Added a self-contained Caddy outage page for upstream 5xx/unavailable cases.
  Reedito's own fallback page remains responsible for application-level 404 and
  safe 500 responses.
- Added `build:public-apps` and included the Portal, comments, search, signup,
  announcement, and Admin toolbar UMD bundles in the production image. The
  Compose config points these assets to the same Reedito origin, removing the
  unpublished `@reedito/*` jsDelivr package dependency. Source maps are excluded
  from the image.
- Updated the deployment runbook and README. No payment integration was added.
- Not configured here: production provider accounts/credentials, domain DNS,
  VPS, Sentry alert destination, R2 bucket, or a live deployment. No real secret
  value was supplied or added.

### Bug fix

- Fixed the member email-verification threshold calculation for API/Admin-created members. The current member is excluded from the already-stored event count and then counted once, using the full total rather than the current page length.
- Added regression coverage for persisted verification events and pagination/threshold boundaries in `reedito/core/test/unit/server/services/verification-trigger.test.js`.

### Payment-free behavior

- Disabled active Stripe Connect setup and provider-managed checkout, billing portal, subscription changes, payment webhooks, and machine-payment routes.
- Disabled paid-membership, donation, and offer checkout controls and direct access paths in Admin.
- Kept free member signup/sign-in, newsletters, and gift redemption. Reader signup defaults to public access, though the owner can configure invite-only member access. Historical payment/subscription data and dormant import/schema compatibility code remain.
- Removed stale Stripe-key placeholders and an orphaned optional Stripe development dependency. Added `docs/codebase/payment-free-build.md`.
- No new payment gateway was added. Existing provider subscriptions are not canceled by this code; site owners must handle live subscriptions with their provider before switching versions.

### Disabled payment actions — 2026-09-28

- Added a shared “Payments are coming soon” page for paid memberships, plan
  changes, paid offers, tips/donations, and gift purchases while payment
  processing is disabled. Direct links and legacy account actions now lead to
  the same notice instead of silently closing or attempting checkout.
- Kept free member sign-up/sign-in and gift redemption available. Existing paid
  subscribers are directed to contact the site owner for help; an owner must
  still manage any live subscription with its original provider.
- Hid disabled paid sign-up/offer links in the newer editor suggestions and
  legacy editor. Added localized strings and tests for disabled routes and
  actions.
- This is interface behavior only: it does not add a payment gateway, process
  payments, change existing entitlements, or make the app production-deployed.
- The focused payment UX suite passed (72 tests), and Portal lint and Markdown
  lint passed. The full Portal suite passed earlier (746 passed, 1 skipped).
  The monorepo `pnpm build:production` run was blocked by automatic review
  because it was identified as sending repository/build metadata to Google
  Analytics; it was not retried. No live deployment was performed.

## Latest feature request and implementation

The roadmap audit first confirmed that Reedito is one publication with public
creator profiles, creator self-registration, existing publication
recommendations, comment moderation, and an optional ActivityPub app. The user
then asked to implement every suggested feature except payment processing.
This section records the resulting application work.

- **Reader feed and follows:** signed-in readers can browse public articles and
  approved creator updates, follow creators and topics, and see followed
  creators/topics prioritized. Existing publication recommendations appear in
  the same Portal page; no duplicate recommendations service was added.
- **Article saves and reactions:** readers can bookmark articles and apply one
  `like` or `clap` reaction per article, separate from comment reactions and
  ActivityPub interactions.
- **Creator updates:** Authors and Contributors can submit text updates up to
  500 characters in Admin at `/community`. Updates stay pending until approved
  by a publication moderator. Each creator can submit up to five per hour.
- **Reader safety:** signed-in readers can report an article or update and
  block a creator. Reports are limited to five per hour per reader. Blocking
  removes that reader's follow and hides the blocked creator's co-authored
  articles and updates from their feed.
- **Moderation:** Owner/Admin users can review reports, dismiss them or hide
  content, and approve/hide pending creator updates. Moderation records reviewer
  identity and timestamps.
- **Creator analytics:** `/community` shows each creator only their own
  published articles, member sign-ups, reactions, bookmarks, follower count,
  reads when existing Tinybird web analytics is configured, and referral
  sources without raw referrer URLs. The table and totals cover the latest 25
  articles; referral sources cover the five newest.
- **Database and operations:** Core package version is `6.66.0-rc.0`.
  Migration `6.66` adds seven tables for follows, bookmarks, reactions,
  updates, reports, and blocks; all are included in full database backups. The
  features use existing member cookies, Admin sessions, the database, and
  optional analytics. No new third-party API key is required for community
  actions.
- **Payments:** deliberately excluded from this request. Payment checkout,
  billing, tips, offers, webhooks, and payouts remain disabled or
  unimplemented. API keys alone do not enable a gateway.

### Discovery, publishing, retention, insights, and abuse protection — 2026-09-26

- **Verified existing discovery/SEO:** public creator and topic archives, RSS,
  article sitemaps, canonical metadata, and structured article data already
  come from Core. No duplicate SEO subsystem was added. Search engines and AI
  answer tools decide independently whether and how to index/cite pages; code
  cannot guarantee top placement or recommendations.
- **Verified existing publishing tools:** scheduled posts, private draft
  previews, and revision history already exist in Core/Admin.
- **Article series:** use the same public tag `Series: <title>` on every
  installment. Feed cards link to the existing tag archive. It sorts by
  publication date; a separate series editor and manual ordering are not part
  of this implementation.
- **Opt-in digest:** added a member preference API and Portal toggle, a
  `reader_digest_preferences` table, and a weekly background job. The message
  contains up to 20 new public posts from followed creators/topics, excludes
  blocked creators, and is skipped when there are no matches. Delivery uses
  the configured existing email provider; failed deliveries remain eligible
  for the next weekly run. Setup is documented in
  `docs/features/series-and-reader-digests.md`.
- **Abuse protection:** added configurable IP/member-backed throttles for
  comment submission, comment reports, and community reports using the
  existing `brute` storage. Existing community service limits remain active.
  This catches excessive request rates; it is not an ML classifier or a
  content moderation substitute. Moderator report review already existed.
- **Migration/version:** added migration `6.67` and updated Core package version
  to `6.67.0-rc.0`. Updated `version.md`, `agent.md`, and feature docs.
- **Validation:** Portal API tests pass 8/8; Core and Portal TypeScript checks,
  changed Core ESLint, JavaScript syntax, and JSON parsing pass. Core Vitest is
  blocked before completion by invalid sourcemap JSON; a handler suite also
  hit a sandbox `uv_interface_addresses` error. Core test TypeScript checking
  reports the existing undefined `stubStripeToken` in an unrelated E2E API
  test. Portal production build, Oxfmt, and Markdown lint pass. No payments
  were added.

### Deployment email provider clarification — 2026-09-27

- Confirmed in Core that `ReeditoMailer` can use SMTP for transactional mail
  such as sign-in links and reader digests, while `email-service-wrapper.js`
  wires the built-in newsletter batch service directly to `MailgunEmailProvider`
  and Mailgun API events. Resend SMTP alone cannot power the built-in creator
  newsletter pipeline without a new provider adapter.
- Corrected `deploy.md` so production setup distinguishes transactional SMTP
  from Mailgun-backed bulk newsletters. No runtime code changed.

### Follow-up build and audit fixes — 2026-09-26

- Fixed the legacy Admin asset-delivery builder's stale `ghost` package lookup
  so it resolves Reedito's rebranded Core and editor packages.
- Moved ActivityPub's test response fixtures into the `reedito` fixture
  directory expected by its renamed tests; its TypeScript check now passes.
- Restricted community moderation endpoints on the server to publication
  Owners and Administrators. A Super Editor could previously reach the queue
  through the broader comment-browse permission even though the Admin UI hid
  those controls. Added a regression test for this role boundary; the Core
  Vitest runner currently fails before test execution because it cannot parse
  an existing malformed sourcemap.
- Verified the dependency-ordered production build: ActivityPub, Ember Admin,
  Admin, and Portal bundles complete successfully. The build still reports
  existing non-fatal chunk-size and externalized Node-module warnings.
- Re-ran Core TypeScript, ActivityPub TypeScript, changed Core ESLint, changed
  file formatting, Markdown lint, and JavaScript syntax checks successfully.
- Manually exercised the server-side role guard; all three moderation actions
  rejected a Super Editor before calling the moderation service.

This remains one shared publication. It does not create separate creator
publications, member databases, or tenant isolation. Public creator signup is
already available at `/reedito/join`; existing staff invitations remain an
optional workflow, not a requirement for creators to join. ActivityPub remains
a separate optional federated feature.

The workspace install error was caused by the rebrand changing the published
upstream dependency `eslint-plugin-ghost` to nonexistent
`eslint-plugin-reedito`. Restored the upstream package name and rule IDs across
the workspace, then refreshed the pnpm lockfile patch hashes. The npm registry
returns `3.5.0`, and `corepack pnpm install --frozen-lockfile --lockfile-only`
passes with the pinned pnpm `12.4.2`. A frozen install with `--ignore-scripts`
materialized dependencies, but lifecycle scripts were skipped; the native RE2
binding is absent. The normal install lifecycle failed in this environment
during native dependency setup. The public creator API E2E test was not run.

### Codebase audit and fixes — 2026-09-25

A broader static and test audit found additional rebrand regressions and incomplete test scaffolding:

- Restored upstream `@tryghost/errors` API identifiers across Core and its tests. The rebrand had changed `isGhostError` to the nonexistent `isReeditoError`, and changed the `GhostError` type name. These calls are used in error classification across API, auth, migrations, rendering, and database handling; the bad names could break those paths at runtime. Added an explicit dependency-name compatibility rule to `agent.md`.
- Changed the historical member-event migration to throw the exported `MigrationError` class. The upstream package only exposes `GhostError` as a type, so constructing it at runtime was invalid.
- Restored the upstream `GhostMetrics` type from `@tryghost/metrics`; Core TypeScript checking now passes.
- Fixed an Admin build type error by making paid-recipient availability false until configuration data has loaded.
- Fixed Admin test scaffolding with the missing free-welcome-email row selector and replaced stale Ghost social URL expectations with Reedito test data.
- Fixed the E2E Reedito server health check to use the configured Reedito port, and added the missing public-page Stripe-script selector.
- Fixed the Portal data-attribute test location-hash setup, and fixed a missing lodash import in Stripe compatibility code.
- Restored the upstream published ESLint plugin dependency, which the rename had changed to a package that does not exist.

Validation after these repairs: Admin TypeScript build passes; the Admin unit suite passes 3,592 tests across 261 files; focused social URL tests pass 104/104; Core `tsc --noEmit` and full Core ESLint pass; Portal ESLint passes and the Portal unit suite passed 727 tests with one skipped; E2E TypeScript checks pass for both application and scripts configs, and E2E ESLint reports no errors (13 warnings).

The complete Core unit suite remains unverified: Vitest fails before test assertions with an invalid sourcemap JSON error. This workspace also has no compiled `re2` native addon because dependency install scripts did not complete. Browser E2E tests cannot start without Docker and Playwright Chromium. The Nx monorepo lint aggregator reports recursive task invocation, so package linters were run directly. Whole-repository formatting still reports pre-existing formatting issues; the changed files were checked and formatted. Markdown lint passes for the project docs, while the link checker cannot run because this source archive has no Git remote or `.git` metadata.

### Branded error handling and monitoring — 2026-09-26

- Replaced the built-in public error template with a responsive Reedito page for missing pages, access errors, rate limits, and server failures. Its styles are inline, so it does not rely on Reedito CSS loading. The page hides internal exception messages and theme-validation details and links back to `/`.
- An unknown creator-style path such as `/users/ygy78378c` follows Reedito's normal 404 handling and receives a branded page when the active theme does not provide its own error template. Theme-authored error templates remain supported.
- If a theme's error template fails while rendering, Reedito returns a static, branded 500 page instead of exposing the rendering exception. The exception is written to server logs and sent to Sentry when configured.
- Documented optional Sentry configuration (`sentry__dsn` for Core and `client_sentry__dsn` for client apps), external uptime checks, and the hosting boundary: an app cannot render its page when the host/proxy fails before the request reaches Reedito.
- Fixed React Admin's hardcoded Sentry DSN gate. Handled API errors and repeated request failures now report through the Sentry client initialized by the legacy Admin shell, even though the static React bundle loads without a DSN prop.
- Kept monitoring on Sentry: the deployment guide uses Sentry Uptime Monitoring and its issue-alert workflow instead of recommending Better Stack. A Sentry account, DSNs, uptime monitor, and notification route still need operator configuration; no credentials were supplied or added.
- Sentry does not automatically classify every console warning or silent incorrect UI result as an error. Those cases need targeted capture calls or a user feedback flow.
- No Sentry DSN, monitoring account, alert destination, or production host has been configured. Monitoring instructions are in `deploy.md`.
- Added focused regression tests for a missing `/users/...` URL, secret-free 500 output, and error-template rendering failures. Results are recorded in `version.md`.

### Reedito logo and favicon — 2026-09-26

- Replaced first-party Admin, member Portal, signup-form, design-system, demo,
  and default browser-preview marks with the selected blue-and-coral folded-page
  R symbol. The mark has no wordmark text.
- Updated the Admin and public-site ICO favicons, Admin and legacy Admin loading
  displays, the member-portal default logo, and the default icon used in the
  browser preview. Existing user-uploaded site icons still take precedence.
- Removed unused Ghost Pro, Ghost favicon, and Ghost logo image assets, plus
  unreferenced Ghost-themed 404 illustrations and Ghost/Transistor composite
  artwork. Replaced Ghost-orbit loading videos with a static Reedito mark.
- Historical Ghost logo fixtures remain only in tests that exercise legacy
  image/import compatibility; they are not used by the product UI.

### Payment scope — 2026-09-26

The current request explicitly excludes a payment gateway. Do not restore
checkout or payment webhooks as part of reader/community work. Paid memberships,
tips, gifts, trials, discounts, creator payouts, and platform fees are deferred
until a separate provider/security design and user request.

### Creator access direction — 2026-09-25

The user wants creators to be able to join Reedito without a personal invite.
Reader membership signup defaults to public (`members_signup_access=all`,
although owners can select invite-only access); reader signup does not grant
publishing permissions. Public creator self-registration is available through
`/reedito/join`. A creator submits an email address and receives a secure
account setup link.
Completing it creates a Contributor in the same publication; Contributors can
draft, while publication editors retain publish access. The endpoint returns
the same response for new and existing accounts and has the existing global
reset rate limit. Owner/Admin roles remain restricted. This is one shared
Reedito publication; it does not create a separate site for each writer. The
community work adds post/update reports, per-hour limits, creator blocking,
and a moderator queue. Broader signup and account abuse controls still need
production monitoring and tuning.

See [`version.md`](version.md) for the release/feature ledger and
[`deploy.md`](deploy.md) for operator-managed DNS, VPS, and AWS deployment steps.

### Reedito rebrand

- Renamed the root runtime folder from `ghost/` to `reedito/`, the local development container from `docker/ghost-dev` to `docker/reedito-dev`, and first-party workspace packages to `@reedito/*` / `reedito-*`.
- Changed first-party environment prefixes and build variables to `REEDITO_*`, Admin paths to `/reedito/`, default Admin API paths to `/reedito/api/`, and first-party test server helpers to Reedito names.
- Updated Reedito-facing app labels, local paths, favicons, logos, mail copy, docs, and package tooling. Removed the upstream-hosting upsell from Admin while retaining its Feedback action.
- Removed the Ghost Explore Admin page and disabled upstream Explore/update-check phone-home defaults. New installs default `explore_ping` and update checks off; an owner can explicitly configure an update-check URL and enable it. Historical settings and migration IDs remain for upgrade safety.
- Removed false Reedito domain and support-email claims from application code and generated test addresses. Generic test URLs now use reserved `example.com`; upstream Ghost imports and newsletters remain faithful to their source.
- Replaced the Ghost-hosted email badge art/link with plain Reedito text, removed the Ghost logo from the private-site footer, and removed the Ghost destination from the sitemap and oEmbed user-agent.
- Removed false Reedito hosted-plan, support-mailbox, and domain claims; marked upstream docs/feed links as upstream. Admin release links now use the current GitHub repository when available and stay unlinked when no Reedito repository is configured.
- Replaced copied Ghost-owned GHCR namespaces and release destinations with repository-owner-derived image names or configurable repository variables. Release, package publication, container publication, image cleanup, upstream sync, deployment dispatch, Renovate, and issue-maintenance workflows are opt-in. They do not publish to or sync from Ghost infrastructure by default.
- Rewrote `.github/SUPPORT.md` and `.github/CONTRIBUTING.md` to remove the invented Reedito Pro plan, Ghost support forum claims, and the upstream Ghost Foundation contributor agreement. The local license and source attribution remain intact.
- Renamed internal server boot function/debug labels from `bootGhost`/`mountGhost` to Reedito names. Replaced Ghost-branded default analytics fallback icons with a generic globe/mail icon.
- Renamed the Admin accent color token from `ghostaccent` to `reedito-accent`, and the Reedito stats entrypoint from `ghost-stats.js` to `reedito-stats.js`. The latter fixes an asset-minification path that pointed to a missing source file.
- Updated release-note compare links and CI check polling to use `REEDITO_GITHUB_REPOSITORY` or the current `GITHUB_REPOSITORY`; with no configured repository, release notes omit the compare URL. Changed Unsplash attribution tags to `utm_source=reedito`.
- Updated local and E2E Tinybird configuration and test fixtures to use the active Reedito analytics route `/.reedito/analytics/` rather than a stale `/.ghost/analytics/` path.
- Updated first-party test-container labels, E2E/CI database names, image metadata, package authors, and workspace references to Reedito. Third-party `@tryghost/*` dependencies and actual upstream integrations remain unchanged.
- Pointed public-app CDN defaults to the first-party `@reedito/*` npm package scope instead of Ghost's jsDelivr namespace. Those packages must be published under a scope you control before production sites can fetch them from jsDelivr.
- Restored historical Ghost export/import fixtures rather than changing their old product text or schema fields. Added a note to keep future migration fixtures source-accurate.
- Disabled the Ghost-hosted Admin changelog fetch by default; Admin release links now use the optional build-time `REEDITO_CHANGELOG_URL` feed. The “What’s new?” panel shows a Reedito empty state until a feed is configured. Upstream Ghost migration/documentation links are still labeled as upstream where shown.
- Disabled the legacy Ember migration iframe by default. `REEDITO_MIGRATION_URL` is an explicit opt-in; if configured, that external service receives the Admin API key and owner email. Fixed the development Tinybird tracker URL to use Reedito's `/.reedito/analytics/` route.
- Made the Admin API error reader accept both Reedito and legacy Ghost error-code fields while preferring the Reedito field in new Sentry metadata.
- Preserved MIT/license and Ghost trademark attribution; this file and the README state that Reedito is independent and unaffiliated.

## Intentional Ghost compatibility names

Some Ghost names remain because they are established external formats or public APIs. These include `/ghost/api` as a compatibility API route, the redirect from old `/ghost/` Admin links, public theme helpers such as `ghost_head` and `ghost_foot`, `ghostVersion` in content exports/Mobiledoc, legacy settings/migration/database identifiers, old embed data attributes, and the legacy Sentry error-code field. External packages published under `@tryghost/*` remain dependencies, as do true upstream service URLs and source citations. Historical Ghost import/export fixtures are intentionally source-accurate. The `Ghost Foundation` copyright and trademark notices must remain with this MIT-licensed derivative. New first-party workspace packages use `@reedito/*`.

### Optional GitHub automation

The repository contains reusable GitHub workflows, but their external side effects are disabled until repository variables explicitly enable them. The most important switches are `REEDITO_ENABLE_RELEASE`, `REEDITO_ENABLE_PACKAGE_PUBLISH`, `REEDITO_ENABLE_PUBLIC_APP_PUBLISH`, `REEDITO_ENABLE_CONTAINER_PUBLISH`, `REEDITO_ENABLE_GHCR_CLEANUP`, `REEDITO_ENABLE_UPSTREAM_SYNC`, `REEDITO_ENABLE_DEPLOY_DISPATCH`, `REEDITO_ENABLE_DOCKER_LIBRARY_UPDATE`, and `REEDITO_ENABLE_TINYBIRD_DEPLOY`. Configure target-repository variables and provider credentials before enabling any of these. Tinybird image publishing is separately opt-in and must remain in a private registry under the applicable Tinybird license terms.

For a local Admin build, `REEDITO_GITHUB_REPOSITORY=owner/repo` can be set to link version numbers to that repository's releases. GitHub Actions can use its `GITHUB_REPOSITORY` value automatically. With no Reedito remote configured, version links are omitted rather than sent to Ghost's repository.

`REEDITO_CHANGELOG_URL` is optional and is injected at Admin build time. If unset, the application does not call a third-party changelog service. Configure a Reedito-owned JSON feed before using the Admin updates banner and menu. The old Ember migration frame requires `REEDITO_MIGRATION_URL` and must only point at a service you trust with an Admin API key and owner email.

## How the app works

Reedito is a Node.js monorepo managed with pnpm and Nx. `reedito/core` is the server: it renders the public site, serves Admin and the APIs, handles member routes, manages integrations, and runs background jobs. React Admin and legacy Ember Admin share the same server. Handlebars themes render public pages; Portal, comments, search, and other browser apps provide optional reader features. The intended product is a creator-publishing service. The current install serves one publication: reader signup defaults to public access, and creators can request a Contributor account at `/reedito/join` without a personal invitation. Public reader signup still does not grant an author role. The default local stack uses MySQL, Redis, Docker Compose, and Mailpit; SQLite is available for selected local/test configurations. Storage, analytics, and email providers are optional integrations.

### Authentication and APIs

- Staff use email/password and server-side Admin sessions; first run creates an owner account. Email verification may be required for new devices.
- Members use passwordless email links or verification codes. Free sign-up remains enabled.
- Admin API credentials sign short-lived JWTs. Admin API keys and staff access tokens are secrets; Content API keys are for read-only public access.
- Reedito uses `/reedito/api/` by default and retains `/ghost/api/` as a compatibility alias. Authentication and authorization checks still apply to each API.

### Feature state

| Area                                                                    | State                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publishing, editing, themes, Admin, public site                         | Active                                                                                                                                                                                             |
| Staff and member authentication                                         | Active                                                                                                                                                                                             |
| Branded application error fallback                                      | Active in Core when a theme does not supply its own error template; includes 404 and safe 500 responses                                                                                            |
| Automated error alerts                                                  | Sentry Core and Admin hooks exist; inactive until an operator configures DSNs and Sentry alert rules                                                                                               |
| Uptime alerts                                                           | Use Sentry Uptime Monitoring; the operator must create a URL monitor and connect its issues to a Sentry notification workflow                                                                      |
| Content/Admin APIs and theme helpers                                    | Active; legacy Ghost endpoints/helpers retained where needed                                                                                                                                       |
| Free member sign-up/sign-in, newsletters, comments, search              | Active                                                                                                                                                                                             |
| Likes/dislikes, reports, and moderation on comments                     | Active                                                                                                                                                                                             |
| Staff author profiles and invitations                                   | Active existing path; writers join the same publication                                                                                                                                            |
| Public creator registration                                             | Available at `/reedito/join`; email setup link creates a Contributor who can draft for editorial review                                                                                            |
| Publication recommendations                                             | Active; extend this system for discovery                                                                                                                                                           |
| ActivityPub                                                             | Optional federated profiles, feeds, follows, short-form social posts, and interactions                                                                                                             |
| Reader community feed and follows                                       | Active at `#/portal/community/`; requires a signed-in member. Includes public articles, approved short updates, followed creators/topics, explore lists, and existing publication recommendations. |
| Article likes/claps and bookmarks                                       | Active in the reader community feed and saved-article tab; member-only and independent of comment/ActivityPub reactions.                                                                           |
| First-party creator updates                                             | Active in Admin `/community`; Author/Contributor can submit up to five 500-character updates per hour; moderator approval is required before feed display.                                         |
| Per-creator private analytics dashboard                                 | Active in Admin `/community`; each writer sees their own published posts only, with the latest 25 article rows and referrals for the latest five. Tinybird is required for read counts.            |
| Post/update reporting, creator blocking, and moderation queue           | Active; signed-in readers can report or block. Reports are limited to five per hour per reader. Owner/Admin can review reports and pending updates. Existing comment moderation is unchanged.      |
| Independent creator publications and cross-site discovery               | Not implemented; current install serves one publication                                                                                                                                            |
| Payment-provider checkout, billing, donations, offers, payment webhooks | Disabled and excluded from the current feature request                                                                                                                                             |
| Creator split payouts and platform fee                                  | Not implemented; requires marketplace architecture and a supported provider                                                                                                                        |
| Existing payment/subscription records                                   | Preserved for compatibility and intended as history                                                                                                                                                |
| Ghost Explore Admin page and Explore phone-home endpoint                | Removed/disabled                                                                                                                                                                                   |
| Reedito.com production DNS, cloud hosting, deployment                   | Single-VPS Compose/Caddy deployment files and runbook are present; no production DNS, VPS, provider account, or live deployment is configured                                                      |

## API keys, local requirements, and size

The default local development stack and the community actions require no API key. Reader actions use the existing signed-in member cookie; creator and moderator actions use the existing Admin session and role permissions. The existing recommendations widget needs the site's configured Content API access; without it, the feed still works without publication recommendations. Tinybird is optional and supplies read counts. Production requires Resend SMTP credentials for transactional email and a Mailgun API key/domain for built-in newsletters. Sentry DSNs are optional until error reporting is wanted; R2 account/bucket credentials are needed to enable the backup profile. Put these values in the ignored `.env.production` or secret files using the included template/script; never in source or a built image. No payment credentials are configured or required for this deployment work.

`Reedito-deployment-source-2026-09-29.zip` is the updated source bundle. It
includes `.env.production.example` and the current deployment guide, and
excludes real environment files, secret files, installed dependencies, caches,
source maps, and generated build directories. It contains no Git metadata and
omits Casper/Source submodules, so it is not a deployable image. Use a full Git
checkout with pinned submodules for `pnpm bootstrap` and production builds.

## Run locally

Requirements: Git, Node.js `22.23.1`, Corepack/pnpm `12.4.2`, Docker, and Docker Compose v2. Use a Git checkout with submodules; the provided source archive has no `.git` metadata and cannot run `pnpm bootstrap` directly.

```bash
corepack enable pnpm
pnpm bootstrap
pnpm dev
```

Open the site at `http://localhost:2368`, Admin at `http://localhost:2368/reedito/`, and Mailpit at `http://localhost:8025`. The owner account is created on the first Admin visit. Local mail is captured in Mailpit. See `docs/contributing/development-setup.md` for optional modes and ports.

## Validation and limitations

Production work validation: all six public app build targets and their two
dependencies pass with `pnpm build:public-apps`. A full `pnpm build:production`,
Dockerfile build, Compose config validation, container startup, actual email,
Sentry delivery, R2 backup, restore, and browser test are not verified in this
workspace because Docker is unavailable and provider credentials/accounts are
not configured. The Compose stack is a single-VPS starting point; it is not an
AWS ECS/Terraform deployment or a claim of live production readiness.

Earlier feature checks remain recorded above. The latest Portal unit run passes
746 tests (one skipped), and Core app/test typechecks pass after the host-limits
test fix. The Core unit suite currently fails before assertions because this
environment denies network-interface enumeration; Vitest then reports a
sourcemap parsing error. No Docker image, Compose startup, live provider test,
restore, browser E2E, or production deployment was completed.

## Recommended implementation sequence

1. Deploy and operate the features only after applying migrations `6.66` and
   `6.67`, testing
   member/Admin permissions on a staged site, and configuring backups, mail,
   monitoring, and production infrastructure.
2. Add stronger public-creator signup controls, account blocking tools, and
   abuse monitoring based on observed production traffic.
3. Improve feed pagination and analytics coverage beyond the current latest-25
   article window.
4. Consider multi-tenant creator publications only after tenant isolation,
   creator onboarding/KYC, quotas, moderation, and accounting are designed.
5. Treat payment integration as separate deferred work; use a provider only
   after the user chooses one and checkout/webhooks/refunds are tested.
