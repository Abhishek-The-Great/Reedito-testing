# Reedito Codebase Documentation

These guides describe this independent Reedito derivative. Links to `ghost.org`,
Ghost documentation, or Ghost community services are upstream references; they
may describe features that differ from the current Reedito source. Reedito does
not yet have its own hosted documentation or community forum.

Reedito.com is the selected canonical brand domain, but this repository does
not configure production DNS or hosting. The current install serves one
publication; invited staff authors publish there, and public readers cannot
create independent publications. See the root [`deploy.md`](../deploy.md) for
production deployment steps and [`version.md`](../version.md) for feature status.

## Product features

- [Article series and reader digests](features/series-and-reader-digests.md)

## Quick Start

With the [prerequisites](contributing/development-setup.md#prerequisites)
installed:

Start from a complete Git checkout with its submodules. No Reedito-owned clone
URL is configured in this source archive. In the checkout root:

```bash
corepack enable pnpm
pnpm bootstrap
pnpm dev
```

Reedito will be available at:

- **Main site**: [http://localhost:2368](http://localhost:2368)
- **Admin panel**: [http://localhost:2368/reedito/](http://localhost:2368/reedito/)
- **Development email**: [http://localhost:8025](http://localhost:8025)

`pnpm dev` also starts the supporting MySQL and Redis containers, plus Admin and
Portal development watchers.

For more detail, see the
[development setup guide](contributing/development-setup.md) including first-run
setup, development variants, and troubleshooting.

## Repository Structure

```text
Reedito/
├── apps/              # Admin and public frontend apps
│   ├── admin/          # React Admin
│   ├── ember-admin/    # Legacy Ember Admin
│   ├── portal/         # Member Portal
│   ├── comments-ui/    # Comments
│   ├── activitypub/    # Federated social app
│   └── shade/          # Admin design system
├── reedito/core/        # Reedito server and frontend rendering
│   ├── core/server/    # APIs, models, and services
│   ├── core/frontend/  # Theme rendering and helpers
│   ├── content/        # Default themes, adapters, and local content
│   └── test/           # Server tests
├── koenig/            # Editor and content-format packages
├── packages/          # Shared libraries and adapter contracts
├── configs/           # Shared build, lint, test, and TypeScript config
├── e2e/               # Browser end-to-end tests
├── docker/            # Local development containers and services
└── scripts/           # Repository tooling
```

pnpm links the workspaces and Nx runs their tasks in dependency order. For more
detail, see the [monorepo structure guide](codebase/monorepo-structure.md). The
[configuration guide](codebase/configuration.md) explains how Reedito Core loads
defaults, local overrides, environment variables, and secrets. The
[authentication guide](codebase/authentication.md) maps staff, integration, and
member authentication to the current codebase.

## Contributing a change

Before contributing, please read:

1. [Contributing Guide](../.github/CONTRIBUTING.md) - Guidelines for contributions
2. [Code of Conduct](../.github/CODE_OF_CONDUCT.md) - Community standards

To contribute or add translations, see
[Translating Reedito](contributing/translating-reedito.md). For more detail on
adding translatable product copy, see the
[internationalization guide](practices/internationalization.md).

## Guides

Codebase guides explain how the main systems fit together:

- [Codebase direction](codebase/direction.md)
- [Runtime architecture](codebase/runtime-architecture.md)
- [Authentication](codebase/authentication.md)
- [Configuration](codebase/configuration.md)
- [Database structure](codebase/database.md)
- [Internal caching](codebase/internal-caching.md)
- [Jobs system](codebase/jobs.md)
- [Post analytics](codebase/post-analytics.md)
- [Site UUID](codebase/site-uuid.md)
- [Payment-free build](codebase/payment-free-build.md)
- [Theme compatibility](codebase/theme-compatibility.md)

Practice and contributor guides explain how to make and verify changes:

- [API design](practices/api-design.md)
- [Database migrations](practices/database-migrations.md)
- [Browser E2E testing](contributing/e2e-testing.md)
- [Codebase documentation](contributing/documentation.md)
- [Email testing](contributing/testing-email.md)
- [Error handling](practices/error-handling.md)
- [Feature flags](practices/feature-flags.md)
- [Internationalization](practices/internationalization.md)
- [Internal package migrations](contributing/internal-package-migrations.md)
- [Performance testing](contributing/performance-testing.md)
- [Test data](contributing/test-data.md)
- [Testing development URLs and devices](contributing/testing-development-urls.md)

Reference guides provide tables and other information to look up while working
on Reedito:

- [Node.js compatibility](reference/node-compatibility.md)

### Finding Issues to Work On

This source archive does not have a Reedito-owned issue tracker configured.
When working from a hosted copy, check the issue tracker for that repository.
The [upstream Ghost issue tracker](https://github.com/TryGhost/Ghost/issues)
covers the original project and may not include Reedito-specific changes.

### Development Workflow

1. **Clone** the repository
2. **Create a branch** for your changes
3. **Make your changes** and write tests
4. **Run `pnpm check`** to ensure everything works
5. **Commit** following our commit message conventions
6. **Submit a pull request** to the `main` branch

For more detail, see the [contribution workflow](contributing/workflow.md).

### Testing

Use `pnpm check` as the default one-stop command for formatting checks, linting,
and testing. Add tests at the closest layer to the behavior you changed. Browser
end-to-end tests and Ember Admin tests run separately from `pnpm check`.

For more detail, see the [testing guide](contributing/testing.md) including how
to choose a test suite, run focused tests, and use the separate browser and
Ember Admin test lanes.

### Shipping

The [upstream shipping guide](contributing/shipping.md) describes the Ghost
release pipeline; Reedito has no configured release or hosting pipeline yet.
For an operator-managed VPS or AWS deployment, follow the root
[`deploy.md`](../deploy.md).

## Additional Resources

- **[Ghost documentation (upstream)](https://docs.ghost.org/)** - Source-product user and developer docs
- **[Ghost community forum (upstream)](https://forum.ghost.org/)** - Source-product discussions
- **[Ghost API docs (upstream)](https://docs.ghost.org/content-api/)** - Content and Admin API reference
- **[Ghost theme docs (upstream)](https://docs.ghost.org/themes/)** - Theme development

## Getting Help

Reedito has no configured support forum, security inbox, or issue tracker yet.
The legacy migration screen also connects to the upstream Ghost migration service
when a user opens that feature; Reedito does not operate that service.
For upstream Ghost behavior, see the [Ghost community forum](https://forum.ghost.org/)
and [upstream issue tracker](https://github.com/TryGhost/Ghost/issues).

## License

This derivative is distributed under the [MIT License](../LICENSE), with the
upstream copyright and license notices retained. Ghost and the Ghost logo are
trademarks of Ghost Foundation Ltd; Reedito is independent and unaffiliated.
