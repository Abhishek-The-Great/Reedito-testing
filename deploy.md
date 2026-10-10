# Deploy and host Reedito

This is a deployment runbook for the current self-hosted source. It does not
claim that Reedito.com is registered, that DNS is configured, or that a server,
payment account, mail provider, or production database already exists.

The source ZIP is not a built production image and cannot build by itself. It
has no Git metadata, its Casper/Source theme directories are empty, and the
archive does not contain the Git submodule commit pins. `.gitmodules` names the
submodule URLs, but that file alone is not enough for `git submodule update` to
recover the intended revisions. Do not initialize a new Git repository from
this ZIP and assume it is a complete deployment checkout. Recover a full
checkout with the correct tracked submodule entries and contents before
building the production image; the Dockerfile requires Casper.

## What production needs

- A complete Git checkout, including submodules, with a Git remote you control.
- A Reedito Docker image built from `Dockerfile.production` using its `full`
  target. The target includes the self-hosted Admin UI and public app bundles.
- A public HTTPS endpoint that reverse-proxies to Reedito on port `2368`.
- MySQL and durable storage for `/home/reedito/content` (uploads, themes, and
  local media). Use an S3-compatible storage adapter instead of local disk when
  running more than one application instance.
- A transactional email transport (SMTP or Mailgun) for sign-in links,
  invitations, digests, and other system email. The built-in bulk newsletter
  pipeline separately requires Mailgun's API integration.
- Automated MySQL and content backups, tested restores, logs, uptime alerts, and
  a documented upgrade path.

`compose.production.yaml` provides a single-VPS deployment with MySQL, Reedito,
Caddy, named persistent volumes, health checks, secret files, and an optional
Restic backup service for Cloudflare R2. This is not a managed AWS/ECS
configuration; use the AWS section below as an infrastructure outline.

## Hostinger VPS quick start

This Compose stack is intended for one Linux VPS. Before starting it, point the
domain to the VPS, open TCP ports 80/443 (and UDP 443 for HTTP/3), install Docker
Engine and Compose v2, and prepare a complete source checkout including
submodules. Do not publish MySQL's port to the internet.

To avoid compiling the monorepo on the VPS, build the app on a trusted machine
or CI worker, push the image to a private registry, and set `REEDITO_IMAGE` to
that immutable image tag. On the VPS, pull that tag and run Compose without the
`build` command. The steps below show the simpler single-machine build path.

1. Build a complete production checkout with Node.js `22.23.1` and the pinned
   Corepack/pnpm `12.4.2`. Confirm `node --version` and `pnpm --version` before
   installing. Run `pnpm bootstrap`, then `pnpm build:production`; this builds
   Core, Admin, and the public-app bundles that the image serves from its own
   origin. `pnpm bootstrap` needs a real Git checkout with the submodule pins;
   it cannot restore them from the source ZIP alone.
2. Copy `.env.production.example` to `.env.production`. Set the real canonical
   domain, database names, sender address, verified Mailgun domain, and
   Cloudflare R2 credentials. The committed file is only a template. Sentry DSNs
   are optional, but configure them and alert routing before public launch. R2
   credentials must be real before starting the backup profile. Protect the real
   file with `chmod 600 .env.production`; do not add credentials to Git or an
   image.
3. Generate the database, Resend, Mailgun, and Restic secret files. Run the
   script as root; it generates database/Restic passwords and securely prompts
   for API keys without echoing them:

   ```bash
   sudo bash scripts/deploy/init-secrets.sh
   ```

   Enter the Resend API key for SMTP and the Mailgun API key. The Mailgun domain
   and R2 credentials are supplied in `.env.production`; configure both
   providers' DNS verification records separately.

4. Validate Compose, then build and start the site from the repository root:

   ```bash
   docker compose --env-file .env.production -f compose.production.yaml config --quiet
   docker compose --env-file .env.production -f compose.production.yaml build
   docker compose --env-file .env.production -f compose.production.yaml up -d
   docker compose --env-file .env.production -f compose.production.yaml --profile backup up -d backup
   ```

Caddy obtains HTTPS certificates when public DNS resolves and inbound ports
80/443 are reachable. The backup service initializes an encrypted Restic
repository in the configured R2 bucket and then runs daily backups (or the
configured interval).

5. Visit `https://reedito.com/reedito/` to complete first-run Owner setup. Test
   sign-in email, newsletter delivery, uploads, search, a restart, Sentry
   events, and an actual backup restore before inviting readers.

The server retains one named MySQL volume, one media/content volume, and Caddy's
certificate state. Restic applies 7 daily, 5 weekly, and 6 monthly snapshots.
The R2 bucket should be private and its credentials restricted to that bucket.
The backup is not considered verified until an operator restores it in a
separate environment. Docker Compose's local file secrets are mounted from the
private `secrets/` directory created by the script; keep that directory
restricted and include its credentials in a secure recovery plan.

`.env.production` configures the production container and providers; it does not
contain real credentials in the repository. `secrets/` holds sensitive
password/API key files and is ignored by Git. Use a secrets manager instead if
you move to an orchestrator that supports managed secrets.

## Pick an operating model

| Option                     | Good for                                  | What you operate                                                                                                                                                                          |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hostinger VPS              | A low-complexity first self-hosted launch | Linux host, Docker, reverse proxy/TLS, database, backups, firewall, patching, and monitoring.                                                                                             |
| AWS Lightsail or EC2       | A familiar VPS model inside AWS           | Linux host, networking, Docker, reverse proxy/TLS, database, storage, backups, and patching. Attach a stable/static IP before pointing DNS.                                               |
| AWS ECS/Fargate + RDS + S3 | A managed, multi-service production setup | Container image, ECS service, private RDS MySQL, S3-backed media, load balancer + ACM certificate, secrets, monitoring, and backups. This repo has no ready-made AWS infrastructure code. |

For a first deployment, use one Reedito app instance, managed or separately
backed-up MySQL, persistent media storage, a transactional mail transport, and
Mailgun API configuration if you will send built-in newsletters. A
single VPS is simpler but places the app, database, and media failure domains
on one server. ECS/Fargate is a more scalable design, but needs AWS expertise
and additional infrastructure work.

### Choose a provider for each job

| Job                 | Practical choice                                                                                            | Reedito-specific note                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain registration | Any established registrar                                                                                   | Registration and hosting are separate. Keep the registrar account protected with MFA and renewal alerts.                                                                                              |
| DNS                 | Registrar DNS, Hostinger DNS, Cloudflare DNS, or Route 53                                                   | Add root and `www` records without replacing email records.                                                                                                                                           |
| Application hosting | Hostinger VPS for a managed-feeling VPS; Lightsail for a simple AWS VPS; ECS/Fargate for managed containers | The operator still builds and deploys the Reedito image.                                                                                                                                              |
| Database            | MySQL-compatible managed DB or a privately networked MySQL server                                           | Production config uses MySQL. Supabase provides PostgreSQL and is not a drop-in database for this source.                                                                                             |
| Authentication      | Reedito's built-in staff and member authentication                                                          | No separate Supabase Auth or OAuth provider is required for the current login flows. Member magic-link email does require working SMTP.                                                               |
| Email delivery      | SMTP for transactional mail; Mailgun API for built-in newsletters                                           | The newsletter batch service is wired to Mailgun's API. Resend SMTP can send sign-in and digest mail, but does not replace this API integration. Verify SPF, DKIM, and DMARC for each sending domain. |
| Upload storage      | Persistent content volume for one server, or S3-compatible storage for replaceable/scaled tasks             | Back up local media, or configure the chosen object-storage adapter and its credentials.                                                                                                              |
| HTTPS               | Caddy on a VPS; ALB + ACM on AWS                                                                            | Reedito itself serves HTTP behind the reverse proxy/load balancer.                                                                                                                                    |
| Payments            | Excluded from this deployment work                                                                          | No payment gateway, payment API key, checkout, or payout flow is configured.                                                                                                                          |

## 1. Register the domain and connect DNS

Register `reedito.com` with the registrar of your choice. The registrar and the
hosting company can be different. This repository does not verify that the
domain is currently available or purchased.

1. Choose your DNS provider (the registrar, Hostinger, Route 53, or another DNS
   provider) and open the DNS zone for `reedito.com`.
2. Reserve a stable public IPv4 address for the VPS or load balancer.
3. Add an `A` record for the root (`@`) pointing to that public address.
4. Add `www` as a `CNAME` to `reedito.com` (or an `A` record to the same static
   IP if your DNS provider requires it).
5. Remove or update conflicting old `A`, `AAAA`, or `CNAME` records for those
   same names. Only add an `AAAA` record if the server is configured to accept
   IPv6 traffic.
6. Keep existing mail records (`MX`, `SPF`, `DKIM`, and `DMARC`) intact. Add
   mail-provider records separately when configuring email.
7. Wait for DNS to propagate, then check both `reedito.com` and `www.reedito.com`.

Point `www` to the root domain or configure an explicit canonical redirect in
the reverse proxy. Reedito's application URL should be one canonical HTTPS URL:
`https://reedito.com`.

## 2. Build the production image

Use a complete Git checkout that includes the correct Git submodule entries and
their pinned Casper/Source commits. This ZIP does not contain those commit pins.
If you use it to create a new repository, recover and add the verified gitlinks
first; do not pick unverified latest theme commits for a production release.
Then clone your complete repository on the build machine or CI worker:

```bash
git clone --recurse-submodules <your-repository-url> reedito
cd reedito
corepack enable pnpm
node --version   # expected: v22.23.1
pnpm --version   # expected: 12.4.2
pnpm bootstrap
pnpm build:production
docker build --target full -f Dockerfile.production -t reedito:<release-tag> .
```

Before building, confirm Git is tracking both theme directories as submodules
(mode `160000`) and that `git submodule status` lists initialized commit IDs.
An empty directory or a `.gitmodules` entry without a tracked gitlink is not a
usable submodule checkout.

`pnpm build:production` builds Core and Admin assets. The Dockerfile's `full`
target requires the Admin build at
`reedito/core/core/built/admin`; it is not a Core-only image. The image listens
on port `2368` and runs `node index.js` as the unprivileged `reedito` user.

Push the finished image to a registry your server can access, such as GHCR,
Docker Hub, or Amazon ECR. This repository does not currently publish a Reedito
image automatically. Store the registry credential as a CI/server secret; do
not embed it in the image or commit it to Git.

## 3. Configure production secrets and services

Reedito reads configuration at process startup. Environment keys match
configuration names; use two underscores for nested values and `_FILE` to load
a secret from a mounted file. The config loader preserves the key's casing.

Set at least these values (provide the real credentials through your host's
secret manager or secret files):

```dotenv
NODE_ENV=production
url=https://reedito.com
server__host=0.0.0.0
server__port=2368
database__client=mysql
database__connection__host=<private-mysql-host>
database__connection__port=3306
database__connection__user=<reedito-db-user>
database__connection__password_FILE=/run/secrets/reedito_db_password
database__connection__database=reedito
paths__contentPath=/home/reedito/content
mail__from=<verified-sender-address>
mail__transport=SMTP
mail__options__host=<smtp-host>
mail__options__port=587
mail__options__secure=false
mail__options__auth__user=<smtp-user>
mail__options__auth__pass_FILE=/run/secrets/reedito_smtp_password
```

The production config defaults database client to MySQL, but its host is
`127.0.0.1`; override it with the reachable database hostname. In a container,
`server.host` must be `0.0.0.0` so the reverse proxy can reach the app.

Configure your database TLS and network allowlists according to your database
provider. Keep MySQL `3306`, Redis `6379`, and Reedito `2368` off the public
internet. Public inbound traffic should normally be limited to `80` and `443`;
restrict SSH (`22`) to trusted source IPs and use SSH keys. Use long, unique DB
credentials and rotate them using the platform secret manager.

The source defaults to local file storage, in-memory cache, and in-memory job
processing. Persist `/home/reedito/content` on a durable volume if local storage
is selected. Configure the storage and job adapters deliberately before adding
multiple app instances; process-local jobs/cache are not shared between
instances. Do not use the local development MySQL/Redis/Mailpit credentials in
production.

There is no payment gateway enabled in this checkout. The current payment-free
state does not support paid checkout just by setting an API key. Payment work
must restore or replace the provider-coupled code, configure and verify
webhooks, and test subscriptions, refunds, cancellations, and email before
accepting real payments. Creator split payouts additionally require a
marketplace-capable provider and creator verification. Keep provider secrets
server-side only.

This deployment intentionally has no payment gateway. It does not enable
checkout, paid entitlements, refunds, or creator payouts.

### Reader community and creator workflows

This source includes migration `6.66` for member follows, article bookmarks and
reactions, creator updates, reports, and creator blocks, plus migration `6.67`
for the `reader_digest_preferences` table used by weekly digest opt-ins. Back
up the database before deployment, run the Core build through Reedito's
supported database migration process, and verify both migrations in its logs
before opening the site to readers. Do not manually rerun a migration the
migrator has already recorded.

No new third-party API key is required for the community actions. Reader feed,
follow, bookmark, reaction, report, and block routes use the existing signed-in
member session. Authors and Contributors use their existing Admin session to
submit short updates and see their own analytics; Owner/Admin users review
reports and approve updates. Readers open the Portal at
`https://reedito.com/#/portal/community/`; writers use Admin `/community`.
Production transactional email remains necessary for creator setup and digest
emails; SMTP is one supported transport. Built-in bulk newsletters separately
need Mailgun API settings, so Resend SMTP alone will not send creator
newsletters. The existing Content API key is only needed to show Reedito's publication
recommendation cards; the member feed still works without them. The optional
Tinybird web analytics integration supplies read counts; without it, other
creator metrics remain available and reads are shown as unavailable.

## 4. Hostinger VPS route

1. Provision an Ubuntu VPS with enough memory and disk for the app, MySQL, and
   media; reserve its stable IPv4 address. Hostinger offers VPS and Docker
   management options, but this repo still requires its own Reedito image and
   production services.
2. Use SSH keys, update Ubuntu, install Docker Engine and Docker Compose v2, and
   enable the host firewall. Allow SSH only from your IP and open `80`/`443`.
3. Set the domain records from step 1 in Hostinger DNS or at the existing DNS
   provider. Do not change nameservers unless you intend to move the whole DNS
   zone.
4. Deploy the Reedito image with MySQL, a durable content volume or S3 storage,
   and secret values. Do not expose the app or database ports publicly.
5. Run a reverse proxy such as Caddy. A minimal Caddyfile for an app container
   on the same Docker network is:

   ```caddyfile
   reedito.com, www.reedito.com {
       reverse_proxy reedito:2368
   }
   ```

   Make ports `80` and `443` reachable from the internet. Caddy can obtain and
   renew certificates automatically after DNS resolves to the VPS and those
   ports are open. Configure a redirect from `www` to the canonical root URL if
   that is the preferred brand URL.

6. Start Reedito, finish first-run setup, send a test sign-in email, upload an
   image, publish and read an article, and test that the upload persists after
   replacing/restarting the app container.
7. Schedule database and media backups, test a restore on a separate environment,
   and configure external uptime and disk-space alerts.

## 5. AWS routes

### Lightsail or EC2 VPS

Use a stable/static IPv4 address, Linux, Docker, a reverse proxy, and the same
Reedito runtime configuration as the Hostinger route. On Lightsail, attach a
static IP before adding the domain's root `A` record. On EC2, associate an
Elastic IP or point the domain at a load balancer; a changing instance address
is not a stable DNS target. Keep the database private, use a security group
allowing only required app-to-database traffic, and back up the database and
content separately.

### ECS/Fargate managed path

This repository does not include a task definition or Terraform/CDK stack. An
operator needs to create the AWS resources and wire them together:

1. Build and push the `full` image to ECR.
2. Create a VPC with public subnets for an Application Load Balancer and private
   subnets for the Reedito task and RDS MySQL.
3. Configure an ECS/Fargate task with port `2368`, health checks, CPU/memory,
   `/home/reedito/content` storage strategy, and runtime environment/secrets.
4. Create RDS MySQL in private subnets, with encryption and backups enabled.
   Permit port `3306` from the Reedito task's security group only.
5. Store DB and SMTP secrets in Secrets Manager and reference them from the task
   definition. Use S3 plus the compatible storage adapter for uploaded media if
   tasks can be replaced or scaled.
6. Terminate HTTPS at the load balancer with an ACM certificate for
   `reedito.com` and `www.reedito.com`; use Route 53 aliases or the DNS
   provider's A/ALIAS/CNAME records to route both names to the load balancer.
7. Add CloudWatch logs/alarms, RDS backups, image-versioned deployments, and a
   restore runbook. Keep RDS and task subnets private; do not place DB
   credentials in an image or source file.

## 6. Error pages and error reporting

Reedito now has a self-contained branded fallback page for missing pages and
application errors. It includes its own CSS, so it does not depend on the site's
stylesheet loading. The page hides server exception text and theme-validation
details. A missing path such as `/users/ygy78378c` returns an actual HTTP 404
with a recovery link. If the active theme defines an `error-404.hbs`, `error-5xx.hbs`,
or `error.hbs`, its custom template remains in control; otherwise Reedito uses
the built-in page.

If a custom error template fails to render, Reedito logs that exception on the
server and returns a static, safe 500 page. It also reports the rendering error
to Sentry when configured.

This handles errors returned by the Reedito process. The included Caddy config
also serves `deploy/caddy/unavailable.html` when the upstream returns a 5xx or
cannot be reached. It cannot render if the VPS, Caddy, DNS, or network is down;
use provider-level monitoring for those cases.

### Sentry application monitoring

Core already includes Sentry's Node integration. It can send unexpected backend
errors (including HTTP 500s) to your Sentry project; expected 404s are not sent
as application errors. Add the DSN as a server-side setting through your host's
secret/config manager:

```dotenv
sentry__dsn=<SENTRY_PROJECT_DSN>
```

The config loader maps double underscores to nested settings, so this creates
`sentry.dsn`. Restart Reedito after adding it. Sentry initializes only when the
`sentry` setting exists and is not disabled. Set up Sentry issue alerts to send
email or another notification when new production errors arrive. Do not put a
Sentry auth token in browser code; the DSN is an ingestion endpoint/key and the
SDK uses it to send events. Sentry documents automatic Node/Express error
capture and DSN setup in its [Node.js guide](https://docs.sentry.io/platforms/javascript/guides/node/),
[Express guide](https://docs.sentry.io/platforms/javascript/guides/express/), and
[DSN explanation](https://docs.sentry.io/concepts/key-terms/dsn-explainer/).

An optional `client_sentry__dsn` setting is made available to Reedito client
apps that read the public configuration, including Admin/Portal error hooks.
The legacy Admin initializes the browser SDK from this setting. React Admin
also reports handled API errors and repeated request failures through the active
Sentry client, even though its static entrypoint has no build-time DSN. This
does not capture every console warning or a silent UI logic bug; those require
an explicit capture call or user feedback. It is not a guarantee that arbitrary
JavaScript in a custom public theme is instrumented; add a browser SDK to that
theme if you want reader-page JavaScript exceptions reported.
`VITE_SENTRY_AUTH_TOKEN` is only needed in CI when uploading browser source maps;
it is not needed for runtime error events. Keep it as a CI secret.

### Uptime checks

To keep monitoring in the selected Sentry service, create a Sentry Uptime
Monitor for `https://reedito.com/` (and a safe health-check URL if available).
Sentry checks URLs from outside the host, so it can detect DNS, TLS, proxy, or
server outages that in-app error capture cannot report when Reedito never
receives the request. Configure a Sentry issue alert/workflow for uptime issues
so it notifies your chosen destination; creating a monitor alone does not
configure the notification route. See Sentry's
[Uptime Monitoring guide](https://docs.sentry.io/product/monitors-and-alerts/monitors/uptime-monitoring/)
and [uptime alert setup](https://docs.sentry.io/product/alerts/create-alerts/uptime-alert-config/).

## 7. First-run checks and upgrades

- On the build/admin host, run `node --test scripts/deploy/backup-loop.test.js`.
  This checks that failed database dumps are rejected and that a successful
  database dump, content backup, and retention pass execute in sequence. It
  uses stub commands; it does not replace a live R2 backup-and-restore test.
- Complete first-run owner account setup in `/reedito/`.
- Set the canonical URL to `https://reedito.com`; verify Admin and public links
  do not send users to a provider hostname or an alternate Reedito TLD.
- Verify certificate issuance, HTTP-to-HTTPS redirect, sign-in email, invite
  email, newsletter delivery, image upload, search, backups, and a restore.
- Confirm Portal, comments, search, signup, announcement, and Admin toolbar
  JavaScript/CSS load from `reedito.com/reedito/assets/` without requests to
  jsDelivr or an unpublished npm package.
- Stop Reedito temporarily in a staging environment and request the public site;
  confirm Caddy returns the branded outage page with a 503 response. Restart the
  app immediately after this check.
- Verify migrations `6.66` and `6.67` appear in the Core migration logs, all
  seven community tables exist, and `reader_digest_preferences` exists before
  testing reader actions or weekly digests.
- Sign in as a reader and test follows, article saves, likes/claps, reports,
  and blocking at `#/portal/community/`. Sign in as an Author/Contributor and
  submit a short update; confirm it stays out of the feed until Owner/Admin
  approves it in the moderation queue. Confirm an author can see only their
  own post analytics and that reads are marked unavailable if Tinybird is not
  configured.
- Confirm the database and content volumes survive an app restart and a new
  image deployment.
- Trigger a harmless 404 such as `/users/not-a-real-creator` and verify the
  friendly error page and HTTP 404 status. Trigger a test exception in a
  non-production environment to verify Sentry delivery and its alert channel.
- Verify Sentry's uptime monitor alerts when the site is unavailable, then
  confirm the issue clears when Reedito is healthy again.
- Back up the database and content before every release. Apply supported DB
  migrations through the release process; do not roll back a schema migration
  without a tested backup/restore plan.
- Pin images to immutable release tags. Keep the prior working image available
  for rollback.
- Use the local workflow in
  [`docs/contributing/development-setup.md`](docs/contributing/development-setup.md)
  for development. `compose.dev.yaml` is not a production deployment file.

## Provider references

- [Hostinger: point a domain to a VPS](https://www.hostinger.com/tutorials/how-to-point-domain-to-vps)
- [Hostinger: manage DNS records](https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/)
- [AWS Lightsail: attach a static IP](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)
- [AWS Lightsail: route a domain to an instance](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-routing-to-instance.html)
- [AWS Lightsail: create a DNS zone](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-create-dns-entry.html)
- [Caddy: automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy: reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html)
- [Amazon RDS for MySQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_MySQL.html)
- [Sentry Node.js error monitoring](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry uptime monitoring](https://docs.sentry.io/product/monitors-and-alerts/monitors/uptime-monitoring/)
