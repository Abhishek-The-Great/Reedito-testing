# Contribution workflow

This guide covers local changes to the Reedito source tree. This archive has no
configured Reedito Git remote or official support community. Some automation and
reference links still connect to upstream Ghost services and need project-owned
replacement before Reedito can publish releases or offer support.

## Start from a checkout

Use the repository checkout supplied to you, or clone the repository URL you
have been given. Before changing code, initialize dependencies and submodules:

```bash
pnpm bootstrap
```

Create a branch if your checkout is connected to a Git remote:

```bash
git switch -c concise-change-name
```

## Make and validate the change

Read the nearest `AGENTS.md`, `CLAUDE.md`, and package README before editing a
subsystem. Add or update tests when behavior changes. Run the focused checks for
the code you touched, then run the repository checks when dependencies are
installed:

```bash
pnpm check
```

`pnpm check` runs formatting checks, linting, and tests. Browser E2E and Ember
Admin tests run separately; see the [testing guide](testing.md) and
[E2E guide](e2e-testing.md).

## Package changes

Workspace packages use the `@reedito/*` scope. External upstream dependencies
under `@tryghost/*` remain unchanged where required for compatibility. If a
publishable package is prepared for release, add a changeset and follow the
release policy established for that package. Reedito currently has no configured
public package registry or release process; do not assume that a package is
ready to publish merely because it builds locally.

## Sharing changes

Until a Reedito remote and release process are configured, keep changes in the
provided checkout or share a patch through the channel that supplied it. Do not
open pull requests against upstream Ghost for Reedito-only changes. For changes
that belong in upstream Ghost, use its own contribution process and repository.

When a Reedito repository is established, its maintainers should document the
canonical branch, review path, release intent, and security-reporting channel.
