# Reedito

Reedito is an independent derivative of the Ghost open-source publishing platform. This repository contains the Reedito-branded source changes; it is not an official Ghost release and is not affiliated with Ghost Foundation.

Reedito is intended to grow into a creator-publishing product like Substack or
Medium. The current code is a self-hosted CMS for one publication: staff authors
publish articles and pages, while readers can sign up as members, receive
newsletters, search, and comment. It does not yet provide a separate publication
or author workspace to every public user, so it is not yet a multi-creator
platform. The intended canonical brand domain is **Reedito.com**; production
DNS and hosting are not configured in this repository.

## What it includes

- Publishing Admin and a server-rendered public site
- Theme rendering, staff publishing, passwordless member sign-in, newsletters,
  comments (including likes/dislikes), search, and optional ActivityPub
  federation
- Content and Admin APIs
- Current source has no active payment checkout. Free member features remain; historical payment records and dormant Stripe-coupled compatibility code remain.

The repository includes a self-hosted production Compose setup and deployment
runbook, but it does not provision a domain, VPS, or provider accounts. No live
deployment has been configured. Payment features remain future work; API keys
alone will not activate the dormant flows.

The production Compose deployment serves the Portal, comments, search, signup,
announcement, and Admin toolbar bundles from Reedito's own origin. Build them
with `pnpm build:production`; no public npm package is required for that setup.

## Run locally

Use a full Git checkout with its pinned submodules. The supplied source archive has no `.git` metadata and omits Casper/Source submodule contents; the production Dockerfile requires Casper, so the archive is not a directly buildable production image and `pnpm bootstrap` cannot run inside it.

Prerequisites: Git, Node.js `22.23.1`, Corepack with pnpm `12.4.2`, and Docker with Compose v2.

```bash
corepack enable pnpm
pnpm bootstrap
pnpm dev
```

On first run, create the owner account in Admin. The default development stack runs the site and Admin at `http://localhost:2368`, Admin at `http://localhost:2368/reedito/`, and Mailpit at `http://localhost:8025`. MySQL and Redis run in Docker. No API key is needed for the default local setup.

The Admin “What’s new?” panel makes no external request unless `REEDITO_CHANGELOG_URL` is set at build time to a Reedito-owned JSON changelog feed. The feed uses the `{ "posts": [], "changelogUrl": "" }` format; without a configured feed, the panel shows an empty state.

The legacy Ember migration iframe is disabled by default. It can be enabled only by explicitly setting `REEDITO_MIGRATION_URL`; doing so sends an Admin API key and owner email to that external migration service.

See [`docs/contributing/development-setup.md`](docs/contributing/development-setup.md) for prerequisites, optional development modes, ports, and troubleshooting.

For production deployment options and DNS, VPS, HTTPS, and AWS setup, see
[`deploy.md`](deploy.md). See [`version.md`](version.md) for the product feature
ledger and [`agent.md`](agent.md) for product intent and current feature status.

## Paths and compatibility

Reedito's Admin and default API paths use `/reedito/` and `/reedito/api/`. Existing Ghost API clients can continue using `/ghost/api/`; old `/ghost/` Admin links redirect to `/reedito/`. Public theme helpers such as `{{ghost_head}}` and `{{ghost_foot}}`, Ghost export fields, and historical database keys remain available where changing them would break existing content or themes.

## License and attribution

The source is licensed under the MIT License in [`LICENSE`](LICENSE). Keep its copyright and license notice. Ghost and the Ghost logo are trademarks of Ghost Foundation Ltd; Reedito is an independent derivative and must not be presented as an official Ghost product.

The [codebase guide](docs/README.md) documents the source layout, authentication, APIs, configuration, local development, and the current payment state.
