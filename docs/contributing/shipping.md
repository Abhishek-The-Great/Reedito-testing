# Reedito releases and hosting

This checkout is an independent Reedito derivative of Ghost. It has no
Reedito-owned Git remote, npm release, published container, hosted service, or
production domain configured. The source tree contains inherited CI, build, and
release workflows; their repository ownership, credentials, and external
infrastructure must be reviewed before they are used for Reedito.

## Current deployment state

- Local development uses the Docker Compose setup in `compose.dev.yaml`.
- No Reedito production deployment is configured. The inherited workflows still
  refer to upstream Ghost services and require project-owned settings.
- Do not publish this code as `reedito` on npm or publish a Docker image until
  the package metadata, legal review, release process, registry ownership, and
  domain/support details are finalized.

## Upstream source project

The original Ghost project manages its own releases, npm packages, Docker
images, hosting service, and release cadence. Those workflows are documented in
the [Ghost repository](https://github.com/TryGhost/Ghost) and
[Ghost documentation](https://docs.ghost.org/). They are useful as upstream
reference material but are not Reedito infrastructure.

## Preparing a Reedito release

Before making a public release, establish and verify the following:

1. A Reedito-owned source repository and maintainer access.
2. Final package names and registry ownership for any published packages.
3. A versioning, changelog, build, signing, and rollback process.
4. Maintained container images and deployment configuration, if containers are
   offered.
5. A production domain, support channel, security contact, and privacy policy.
6. A migration and compatibility policy for Ghost data, routes, themes, and
   API clients.

Until those are configured, run the code from a local checkout using the
[development setup](development-setup.md) and treat generated packages as local
build artifacts.
