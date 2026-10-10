# Reedito: agent context

Read this before making product-facing changes. Follow the repository workflow
and subsystem guidance in [`AGENTS.md`](AGENTS.md); this file records the
product intent, current scope, and decisions that should shape future work.

## Product intent

Reedito is intended to become a creator-publishing product in the space of
Substack and Medium. Creators should publish articles; readers should discover,
read, follow, and discuss them. The chosen canonical brand domain is
**Reedito.com**. The repository has no production DNS or hosting configuration.
Earlier domain research reported Reedito.com available at a standard
non-premium price, but no purchase was made during that research. Do not claim
the domain is currently owned, available, or live without checking.

The selected Reedito mark is a text-free folded-page R in cobalt blue and
coral. Use the shared mark for Admin, Portal, signup, loading, and default
favicon surfaces. Do not restore Ghost logo assets; uploaded publication icons
remain site-owner content and take precedence over the default icon.

## Current implementation versus the goal

This codebase is an independent derivative of the Ghost publishing platform.
Today it is a self-hosted publishing CMS for **one publication/site**. The
user's current direction is public reader access and creator onboarding without
a personal invitation. Reader signup defaults to public access. The Admin now
exposes `/reedito/join` for creator self-registration: a creator requests an
email setup link and receives the least-privileged Contributor role, which can
draft articles for publication review. Reader signup and creator publishing
access are separate:

- Staff authors create, edit, schedule, and publish posts in the Admin.
- The public site renders posts and pages through compatible themes. Authors,
  tags, RSS, search, and SEO metadata support publishing and discovery.
- Reader members can sign up and sign in by email, receive newsletters, and
  comment. Comments support likes, dislikes, reporting, and moderation. The
  separate ActivityPub app includes federated profiles, feeds, follows,
  short-form social posts, and post interactions.
- The Admin has post/site analytics. Publication recommendations are already
  implemented; build on them for reader discovery instead of creating another
  recommendations service.
- Themes and integrations can use Content and Admin APIs.
- The payment-free build has no active checkout or payment-provider flows.

It is **not yet** a multi-tenant creator network. Public member signup does not
give each reader a separate publication or an author workspace. Reader access
defaults to public (`members_signup_access=all`), but the owner can change it.
Staff author profiles and invitations work inside the one publication; public
creator signup creates a Contributor in that same publication. Public reader
signup does not grant publishing privileges.

First-party community features now include a signed-in reader feed, follows for
creators/topics, article bookmarks and like/clap reactions, moderated creator
updates, article/update reports, creator blocking, a report/update review
queue, private per-creator analytics, and opt-in weekly email digests for
followed creators/topics. Comment submission and report routes also use
configurable IP/member rate limits; this is request-rate abuse control, not
automated content classification. Public article series use a
`Series: <title>` public tag and its tag archive as the series landing page.
Reader tools live in the Portal at
`#/portal/community/`; the creator dashboard and moderation tools live in Admin
at `/community`. See [`version.md`](version.md) for the feature ledger and
[`action.md`](action.md) for implementation and verification details.

These features serve one shared publication. They do not create separate
creator publications, databases, or tenant isolation. Analytics show each
creator's latest 25 published articles, with referral sources for the newest
five. Existing Tinybird web analytics is needed for read counts. Community
actions use member cookies and Admin sessions and require no new API key.
ActivityPub remains a separate optional federated feature.

## Authentication and runtime

- Staff sign in to Admin with email/password and server-side sessions; device
  verification is part of the staff sign-in flow.
- Members use passwordless email sign-in links or one-time codes.
- Reader community actions require a signed-in member session. Creator updates
  and private analytics require an Author/Contributor Admin session; report
  review requires Owner/Admin access, enforced by both the Admin UI and the
  server endpoints. Comment-browse permission alone is not enough to moderate
  community reports or creator updates.
- Integrations authenticate to the Admin API with credentials that sign
  short-lived JWTs. Content API keys are used for public read access.
- `reedito/core` is the Node.js server. The monorepo uses pnpm and Nx. The
  default local stack uses Docker Compose, MySQL, Redis, and Mailpit. Some local
  and test modes support SQLite.
- The default local setup needs no API key. Production email delivery,
  external object storage, analytics, and other optional services need their
  own configuration and credentials.

See [`action.md`](action.md) for the change history, local setup, API/auth
details, feature state, size estimate, and validation limits. See
[`docs/README.md`](docs/README.md) for the codebase guides.

## Error handling and monitoring

- Core renders a self-contained Reedito error page for unknown routes and other
  application errors when the active theme has no matching error template. The
  fallback uses inline CSS, hides internal exception and theme-validation
  details, and returns a real 404 for unknown paths such as `/users/<slug>`.
- Theme-provided `error-404.hbs`, `error-5xx.hbs`, and `error.hbs` templates
  remain supported and take precedence when present. A rendering failure gets a
  static safe 500 response; the template exception is logged and captured if
  Sentry is configured.
- Core and Admin Sentry integrations are inactive until the operator provides
  `sentry__dsn` and `client_sentry__dsn` and configures Sentry issue alerts.
  Client DSNs do not automatically instrument arbitrary public theme JavaScript.
- Sentry Uptime Monitoring can check public Reedito URLs; it is not configured
  in this source tree and needs a dashboard monitor and alert workflow. An
  in-app page cannot replace a host/proxy error page when requests never reach
  Reedito; configure an edge fallback if a branded outage page is needed.
- See [`deploy.md`](deploy.md) for the monitoring setup and hosting boundaries.

## Decisions and boundaries

- Keep **Reedito.com** as the intended first-party public domain. Do not add
  alternate public Reedito domains. Reserved test hosts, `localhost`, and
  upstream Ghost URLs may remain when they serve a test or compatibility
  purpose.
- Do not invent a Reedito support inbox, hosted service, repository, or live
  domain. Only document services that are actually configured.
- The current request explicitly excludes payment gateways. Checkout, billing,
  tips, paid memberships, offers, payment webhooks, and payouts remain disabled
  or unimplemented. Old Stripe-coupled paths do not become active by entering
  API keys. Keep the current payment-free state unless the user separately asks
  for a provider implementation. Creator split payouts require tenant safety,
  provider onboarding/KYC, refunds, and accounting. See [`version.md`](version.md)
  and [`docs/codebase/payment-free-build.md`](docs/codebase/payment-free-build.md).
- This source is MIT-licensed, not public domain. Preserve the root license and
  upstream copyright notices. Reedito is independent and must not be presented
  as an official Ghost release. Retain Ghost API paths, theme helpers, import
  formats, and dependency names where needed for compatibility; do not perform
  a blind global replacement of `Ghost`.
- Preserve external package API symbols even when their names contain `Ghost`. For
  example, `@tryghost/errors` exports `errors.utils.isGhostError` and a type-only
  `GhostError`; `@tryghost/metrics` exposes the `GhostMetrics` type. Use the
  constructors actually exported by those packages (such as `MigrationError`)
  and verify changed imports with typechecks and runtime tests.
- Keep secrets in environment/configuration, never in source or client bundles.
  Do not configure external integrations with credentials unless the task
  requires them.

## Suggested roadmap

1. **Prepare production:** follow [`deploy.md`](deploy.md) for Reedito.com DNS,
   HTTPS, MySQL, durable uploads, email, monitoring, backups, and tested
   deployment/restore. No provider or live deployment is configured.
2. **Tune safety controls:** monitor creator signups, reports, and update rate
   limits; add stronger account protections based on production traffic.
3. **Expand feed and analytics:** add feed pagination and extend dashboards
   beyond the current latest-25 article window.
4. **Keep payments deferred:** a provider is outside the current request and
   must be chosen and implemented separately before checkout is enabled.
5. **Add separate creator publications only with tenant isolation:** scope
   every article, member relationship, moderation action, analytics row,
   billing record, and storage path to a publication. Public authors on the
   current shared publication do not by themselves require separate tenants,
   but do require role boundaries, spam controls, moderation, and support
   operations.

## Local start

Use a full Git checkout with submodules. Requirements and troubleshooting are
in [`docs/contributing/development-setup.md`](docs/contributing/development-setup.md).

```bash
corepack enable pnpm
pnpm bootstrap
pnpm dev
```

The local site is `http://localhost:2368`, Admin is
`http://localhost:2368/reedito/`, and captured development email is at
`http://localhost:8025`. Create the owner account on first Admin visit.
