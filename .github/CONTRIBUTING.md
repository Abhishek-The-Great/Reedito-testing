# Contributing to Reedito

Reedito is an independent derivative of the Ghost publishing platform. It is
not affiliated with Ghost Foundation. The source is distributed under the MIT
license in [`../LICENSE`](../LICENSE); preserve its copyright and license
notices when redistributing changes.

Start with the [development setup](../docs/contributing/development-setup.md),
then follow the [contribution workflow](../docs/contributing/workflow.md).
Those guides cover the pnpm/Nx workspace, code style, tests, changesets, and
pull requests. Run `pnpm check` after bootstrapping a full Git checkout.

First-party packages use the `@reedito/*` scope. Some external dependencies
still use `@tryghost/*`, and established Ghost import/export formats and theme
APIs are kept for compatibility. Do not rename those interfaces without a
versioned migration plan.

Before proposing a larger feature, explain the user problem and intended
behavior in an issue or pull request. Do not include secrets or private user
data in reports. Contribution terms are governed by the repository license;
this project does not require the upstream Ghost Foundation contributor
agreement.
