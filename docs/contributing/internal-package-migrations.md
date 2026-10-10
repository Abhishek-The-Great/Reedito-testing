# Internal package migrations

This checkout has no Reedito-owned Git remote or repository administrators.
Do not run the upstream Git history import workflow from this fork: its PR and
merge steps target the canonical Ghost repository and cannot be completed here.

For Reedito-only package work, keep the code within this checkout and use the
existing `@reedito/*` workspace scope. External dependencies under `@tryghost/*`
remain upstream dependencies. If a future Reedito repository is established,
its maintainers must define and test a package-history migration process there.

For the upstream Ghost workflow, use the official
[Ghost repository](https://github.com/TryGhost/Ghost) and its current
contribution guidance.
