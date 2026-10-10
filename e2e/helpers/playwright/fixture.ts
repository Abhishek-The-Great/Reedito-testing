import baseDebug from '@tryghost/debug';
import { AnalyticsOverviewPage } from '@/helpers/pages';
import { AssignableStaffRoleName, StaffAccount, createStaffAccountFactory } from '@/data-factory';
import {
  Browser,
  BrowserContext,
  Page,
  Request,
  Response,
  TestInfo,
  test as base,
} from '@playwright/test';
import {
  EGRESS_ENFORCE,
  EGRESS_MOCK_RESPONSE_HEADER,
  EGRESS_MONITOR_ENABLED,
} from '@/helpers/environment/constants';
import { EmailClient, MailPit } from '@/helpers/services/email/mail-pit';
import { FakeMailgunServer, MailgunTestService } from '@/helpers/services/mailgun';
import { ReeditoInstance, getEnvironmentManager, isAllowedHost } from '@/helpers/environment';
import { SettingsService } from '@/helpers/services/settings/settings-service';
import { extractInviteLink } from '@/helpers/services/email/utils';
import { faker } from '@faker-js/faker';
import { loginToGetAuthenticatedSession } from '@/helpers/playwright/flows/sign-in';
import { setupUser } from '@/helpers/utils';

const debug = baseDebug('e2e:reedito-fixture');

type ResolvedIsolation = 'per-file' | 'per-test';
type LabsFlags = Record<string, boolean>;

/**
 * The subset of fixture options that defines whether a per-file environment can
 * be reused for the next test in the same file.
 *
 * Any new fixture option that changes persistent Reedito state or boot-time config
 * must make an explicit choice:
 * - include it here so it participates in environment reuse, or
 * - force per-test isolation instead of participating in per-file reuse.
 */
interface EnvironmentIdentity {
  config?: ReeditoConfig;
  labs?: LabsFlags;
}

interface PerFileInstanceCache {
  suiteKey: string;
  environmentSignature: string;
  instance: ReeditoInstance;
}

interface PerFileAuthenticatedSessionCache {
  reeditoAccountOwner: User;
  storageState: Awaited<ReturnType<BrowserContext['storageState']>>;
}

interface TestEnvironmentContext {
  holder: ReeditoInstance;
  resolvedIsolation: ResolvedIsolation;
  cycle: () => Promise<void>;
  getResetEnvironmentBlocker: () => string | null;
  markResetEnvironmentBlocker: (fixtureName: string) => void;
}

interface InternalFixtures {
  _testEnvironmentContext: TestEnvironmentContext;
}

interface WorkerFixtures {
  _cleanupPerFileInstance: void;
  _egressSummary: void;
}

let cachedPerFileInstance: PerFileInstanceCache | null = null;
let cachedPerFileReeditoAccountOwner: User | null = null;
let cachedPerFileAuthenticatedSession: PerFileAuthenticatedSessionCache | null = null;

// External hosts requested by the browser, accumulated across a worker so the
// worker teardown can print them (the server-side equivalent comes from the DNS
// sidecar). Worker-scoped, like the caches above.
const workerBrowserEgressHosts = new Set<string>();

export interface User {
  name: string;
  email: string;
  password: string;
}

export interface ReeditoConfig {
  // Any hostSettings path, spelled the way the environment does: double underscores for
  // nesting, so `hostSettings__limits__staff__max`. Open rather than enumerated, because a
  // limit is just configuration and a test wanting a new one should not also need a new
  // field here.
  [key: `hostSettings__${string}`]: string | undefined;
}

export interface ReeditoInstanceFixture {
  reeditoInstance: ReeditoInstance;
  // Opt a file into per-test isolation without relying on Playwright-wide fullyParallel.
  isolation?: 'per-test';
  resolvedIsolation: ResolvedIsolation;
  // Hook-only escape hatch for per-file mode before stateful fixtures are resolved.
  resetEnvironment: () => Promise<void>;
  // Participates in per-file environment identity.
  labs?: LabsFlags;
  // Participates in per-file environment identity.
  config?: ReeditoConfig;
  // Opt a test into the fake Mailgun provider.
  mailgunEnabled?: boolean;
  mailgunServer?: FakeMailgunServer;
  mailgun?: MailgunTestService;
  emailClient: EmailClient;
  reeditoAccountOwner: User;
  reeditoAccountAuthor: StaffAccount;
  reeditoAccountContributor: StaffAccount;
  reeditoAccountEditor: StaffAccount;
  reeditoAccountSuperEditor: StaffAccount;
  reeditoAccountAdministrator: StaffAccount;
  pageWithAuthenticatedUser: {
    page: Page;
    context: BrowserContext;
    reeditoAccountOwner: User;
  };
}

function getStableObjectSignature<T extends object>(values?: T): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(values ?? {}).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
    ),
  );
}

function getEnvironmentSignature(identity: EnvironmentIdentity): string {
  return JSON.stringify({
    config: getStableObjectSignature(identity.config),
    labs: getStableObjectSignature(identity.labs),
  });
}

function getSuiteKey(testInfo: TestInfo): string {
  return `${testInfo.project.name}:${testInfo.file}`;
}

function getResolvedIsolation(testInfo: TestInfo, isolation?: 'per-test'): ResolvedIsolation {
  if (testInfo.config.fullyParallel || isolation === 'per-test') {
    return 'per-test';
  }

  return 'per-file';
}

async function setupNewAuthenticatedPage(
  browser: Browser,
  baseURL: string,
  reeditoAccountOwner: User,
) {
  debug('Setting up authenticated page for Reedito instance:', baseURL);

  // Create browser context with correct baseURL and extra HTTP headers
  const context = await browser.newContext({
    baseURL: baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
    },
  });
  const page = await context.newPage();

  await loginToGetAuthenticatedSession(page, reeditoAccountOwner.email, reeditoAccountOwner.password);
  debug('Authentication completed for Reedito instance');

  return { page, context, reeditoAccountOwner };
}

async function setupAuthenticatedPageFromStorageState(
  browser: Browser,
  baseURL: string,
  authenticatedSession: PerFileAuthenticatedSessionCache,
) {
  debug('Reusing authenticated storage state for Reedito instance:', baseURL);

  const context = await browser.newContext({
    baseURL: baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
    },
    storageState: authenticatedSession.storageState,
  });
  const page = await context.newPage();
  await page.goto('/reedito/#/');

  const analyticsPage = new AnalyticsOverviewPage(page);
  const billingIframe = page.getByTitle('Billing');
  await Promise.race([
    analyticsPage.header.waitFor({ state: 'visible' }),
    billingIframe.waitFor({ state: 'visible' }),
  ]);

  return {
    page,
    context,
    reeditoAccountOwner: authenticatedSession.reeditoAccountOwner,
  };
}

async function getInvitationToken(emailClient: EmailClient, email: string): Promise<string> {
  let messages;

  try {
    messages = await emailClient.search({ subject: 'has invited you to join', to: email });
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`No staff invitation email found for ${email}${detail}`);
  }

  const message = messages[0];

  if (!message) {
    throw new Error(`No staff invitation email found for ${email}`);
  }

  const detailedMessage = await emailClient.getMessageDetailed(message);
  const inviteUrl = new URL(extractInviteLink(detailedMessage));
  const token = inviteUrl.pathname.split('/').filter(Boolean).at(-1);

  if (!token) {
    throw new Error(`No invitation token found in URL for ${email}`);
  }

  return token;
}

async function createStaffAccount(
  page: Page,
  emailClient: EmailClient,
  role: AssignableStaffRoleName,
): Promise<StaffAccount> {
  const staffAccountFactory = createStaffAccountFactory(page.request, (email) =>
    getInvitationToken(emailClient, email),
  );

  return await staffAccountFactory.create({ role });
}

/**
 * Playwright fixture that provides a unique Reedito instance for each test
 * Each instance gets its own database, runs on a unique port, and includes authentication
 *
 * Uses the unified E2E environment manager:
 * - Dev mode (default): Worker-scoped containers with per-test database cloning
 * - Build mode: Same isolation model, but Reedito runs from a prebuilt image
 *
 * Optionally allows setting labs flags via test.use({labs: {featureName: true}})
 */
export const test = base.extend<ReeditoInstanceFixture & InternalFixtures, WorkerFixtures>({
  _cleanupPerFileInstance: [
    async ({}, use) => {
      await use();

      if (!cachedPerFileInstance) {
        return;
      }

      const environmentManager = await getEnvironmentManager();
      await environmentManager.perTestTeardown(cachedPerFileInstance.instance);
      cachedPerFileInstance = null;
      cachedPerFileReeditoAccountOwner = null;
      cachedPerFileAuthenticatedSession = null;
    },
    {
      scope: 'worker',
      auto: true,
    },
  ],

  // At the end of each worker, sweep the external hosts the suite reached and —
  // when E2E_EGRESS_ENFORCE=1 — fail the worker if any were off the allowlist.
  //
  // The check runs ONCE here, not per test: the server-side DNS log is read with
  // a brief settle (EgressMonitor.collectSettled) to catch fire-and-forget
  // lookups, so we don't pay that cost on every test, and a late or boot-time
  // lookup can't be misattributed to — and fail — an unrelated test. The DNS
  // sidecar sees everything Reedito resolved; the per-test browser listener (page
  // fixture) feeds workerBrowserEgressHosts for the layer it can't see. Printed
  // hosts are what you read out of CI logs to build up EGRESS_ALLOWLIST.
  _egressSummary: [
    async ({}, use, workerInfo) => {
      await use();

      if (!EGRESS_MONITOR_ENABLED) {
        return;
      }

      const print = (label: string, hosts: string[]) => {
        if (hosts.length === 0) {
          return;
        }
        // eslint-disable-next-line no-console
        console.log(
          `\n[egress] external hosts ${label} (worker ${workerInfo.workerIndex}):\n` +
            hosts.map((host) => `  - ${host}`).join('\n') +
            '\n',
        );
      };

      let serverHosts: string[] = [];
      try {
        const monitor = (await getEnvironmentManager()).getEgressMonitor();
        if (monitor) {
          serverHosts = await monitor.unexpectedHosts();
        }
      } catch {
        // Best-effort: never fail teardown over a monitor read error.
      }
      const browserHosts = [...workerBrowserEgressHosts].sort();

      print('resolved by Reedito', serverHosts);
      print('requested by the browser', browserHosts);

      const unexpected = [...new Set([...serverHosts, ...browserHosts])].sort();
      if (EGRESS_ENFORCE && unexpected.length > 0) {
        throw new Error(
          `Unexpected external egress in worker ${workerInfo.workerIndex}: ${unexpected.join(', ')}\n\n` +
            `Host(s) not on the egress allowlist were contacted during this worker's tests.\n` +
            `If this is expected, add them to EGRESS_ALLOWLIST in helpers/environment/constants.ts.`,
        );
      }
    },
    {
      scope: 'worker',
      auto: true,
    },
  ],

  _testEnvironmentContext: async (
    { config, isolation, labs, mailgunEnabled, mailgunServer },
    use,
    testInfo: TestInfo,
  ) => {
    const environmentManager = await getEnvironmentManager();
    const requestedIsolation = getResolvedIsolation(testInfo, isolation);
    const resolvedIsolation = requestedIsolation;
    const suiteKey = getSuiteKey(testInfo);
    const mailgunConfig =
      mailgunEnabled && mailgunServer
        ? {
            bulkEmail__mailgun__apiKey: 'fake-mailgun-api-key',
            bulkEmail__mailgun__domain: 'fake.mailgun.test',
            bulkEmail__mailgun__baseUrl: `http://host.docker.internal:${mailgunServer.port}/v3`,
          }
        : {};
    const mergedConfig = { ...(config || {}), ...mailgunConfig };
    const environmentIdentity: EnvironmentIdentity = {
      config: mergedConfig,
      labs,
    };
    const environmentSignature = getEnvironmentSignature(environmentIdentity);
    const resetEnvironmentGuard = {
      blocker: null as string | null,
    };

    if (resolvedIsolation === 'per-test') {
      const perTestInstance = await environmentManager.perTestSetup({
        config: mergedConfig,
      });
      const previousPerFileInstance = cachedPerFileInstance?.instance;
      cachedPerFileInstance = null;
      cachedPerFileReeditoAccountOwner = null;
      cachedPerFileAuthenticatedSession = null;

      if (previousPerFileInstance) {
        await environmentManager.perTestTeardown(previousPerFileInstance);
      }

      await use({
        holder: perTestInstance,
        resolvedIsolation,
        cycle: async () => {
          debug('resetEnvironment() is a no-op in per-test isolation mode');
        },
        getResetEnvironmentBlocker: () => resetEnvironmentGuard.blocker,
        markResetEnvironmentBlocker: (fixtureName: string) => {
          resetEnvironmentGuard.blocker ??= fixtureName;
        },
      });

      await environmentManager.perTestTeardown(perTestInstance);
      return;
    }

    const mustRecyclePerFileInstance =
      !cachedPerFileInstance ||
      cachedPerFileInstance.suiteKey !== suiteKey ||
      cachedPerFileInstance.environmentSignature !== environmentSignature;

    if (mustRecyclePerFileInstance) {
      const previousPerFileInstance = cachedPerFileInstance?.instance;
      const nextPerFileInstance = await environmentManager.perTestSetup({
        config: mergedConfig,
      });
      cachedPerFileInstance = {
        suiteKey,
        environmentSignature,
        instance: nextPerFileInstance,
      };
      cachedPerFileReeditoAccountOwner = null;
      cachedPerFileAuthenticatedSession = null;

      if (previousPerFileInstance) {
        await environmentManager.perTestTeardown(previousPerFileInstance);
      }
    }

    const activePerFileInstance = cachedPerFileInstance;
    if (!activePerFileInstance) {
      throw new Error('[e2e fixture] Failed to initialize per-file Reedito instance.');
    }

    const holder = { ...activePerFileInstance.instance };
    const cycle = async () => {
      const previousInstance = cachedPerFileInstance?.instance;
      const nextInstance = await environmentManager.perTestSetup({
        config: mergedConfig,
      });

      if (previousInstance) {
        await environmentManager.perTestTeardown(previousInstance);
      }

      cachedPerFileInstance = {
        suiteKey,
        environmentSignature,
        instance: nextInstance,
      };
      cachedPerFileReeditoAccountOwner = null;
      cachedPerFileAuthenticatedSession = null;

      Object.assign(holder, nextInstance);
    };

    await use({
      holder,
      resolvedIsolation,
      cycle,
      getResetEnvironmentBlocker: () => resetEnvironmentGuard.blocker,
      markResetEnvironmentBlocker: (fixtureName: string) => {
        resetEnvironmentGuard.blocker ??= fixtureName;
      },
    });
  },

  // Define options that can be set per test or describe block
  config: [undefined, { option: true }],
  isolation: [undefined, { option: true }],
  labs: [undefined, { option: true }],
  mailgunEnabled: [false, { option: true }],

  mailgunServer: async ({ mailgunEnabled }, use) => {
    if (!mailgunEnabled) {
      await use(undefined);
      return;
    }

    const server = new FakeMailgunServer();
    await server.start();
    debug('Fake Mailgun server started on port', server.port);

    await use(server);

    await server.stop();
    debug('Fake Mailgun server stopped');
  },

  mailgun: async ({ mailgunEnabled, mailgunServer }, use) => {
    if (!mailgunEnabled || !mailgunServer) {
      await use(undefined);
      return;
    }

    const service = new MailgunTestService(mailgunServer);
    await use(service);
  },

  emailClient: async ({}, use) => {
    await use(new MailPit());
  },

  reeditoInstance: async ({ _testEnvironmentContext }, use, testInfo: TestInfo) => {
    debug('Using Reedito instance for test:', {
      testTitle: testInfo.title,
      resolvedIsolation: _testEnvironmentContext.resolvedIsolation,
      ..._testEnvironmentContext.holder,
    });
    await use(_testEnvironmentContext.holder);
  },

  resolvedIsolation: async ({ _testEnvironmentContext }, use) => {
    await use(_testEnvironmentContext.resolvedIsolation);
  },

  resetEnvironment: async ({ _testEnvironmentContext }, use) => {
    await use(async () => {
      if (_testEnvironmentContext.resolvedIsolation === 'per-test') {
        debug('resetEnvironment() is a no-op in per-test isolation mode');
        return;
      }

      // Only support resetEnvironment() before stateful fixtures such as the
      // baseURL, authenticated user session, or page have been materialized.
      const blocker = _testEnvironmentContext.getResetEnvironmentBlocker();
      if (blocker) {
        throw new Error(
          `[e2e fixture] resetEnvironment() must be called before resolving ` +
            `"${blocker}". Use it in a beforeEach hook that only depends on ` +
            'resetEnvironment and fixtures that remain valid after a recycle.',
        );
      }

      await _testEnvironmentContext.cycle();
    });
  },

  baseURL: async ({ reeditoInstance, _testEnvironmentContext }, use) => {
    _testEnvironmentContext.markResetEnvironmentBlocker('baseURL');
    await use(reeditoInstance.baseUrl);
  },

  // Create user credentials only (no authentication)
  reeditoAccountOwner: async ({ reeditoInstance, _testEnvironmentContext }, use) => {
    if (!reeditoInstance.baseUrl) {
      throw new Error('baseURL is not defined');
    }

    _testEnvironmentContext.markResetEnvironmentBlocker('reeditoAccountOwner');

    if (
      _testEnvironmentContext.resolvedIsolation === 'per-file' &&
      cachedPerFileReeditoAccountOwner
    ) {
      await use(cachedPerFileReeditoAccountOwner);
      return;
    }

    // Create user in this Reedito instance
    const reeditoAccountOwner: User = {
      name: 'Test User',
      email: `test${faker.string.uuid()}@example.com`,
      password: 'test@123@test',
    };
    await setupUser(reeditoInstance.baseUrl, reeditoAccountOwner);

    if (_testEnvironmentContext.resolvedIsolation === 'per-file') {
      cachedPerFileReeditoAccountOwner = reeditoAccountOwner;
    }

    await use(reeditoAccountOwner);
  },

  reeditoAccountAuthor: async ({ pageWithAuthenticatedUser, emailClient }, use) => {
    await use(await createStaffAccount(pageWithAuthenticatedUser.page, emailClient, 'Author'));
  },

  reeditoAccountContributor: async ({ pageWithAuthenticatedUser, emailClient }, use) => {
    await use(await createStaffAccount(pageWithAuthenticatedUser.page, emailClient, 'Contributor'));
  },

  reeditoAccountEditor: async ({ pageWithAuthenticatedUser, emailClient }, use) => {
    await use(await createStaffAccount(pageWithAuthenticatedUser.page, emailClient, 'Editor'));
  },

  reeditoAccountSuperEditor: async ({ pageWithAuthenticatedUser, emailClient }, use) => {
    await use(
      await createStaffAccount(pageWithAuthenticatedUser.page, emailClient, 'Super Editor'),
    );
  },

  reeditoAccountAdministrator: async ({ pageWithAuthenticatedUser, emailClient }, use) => {
    await use(
      await createStaffAccount(pageWithAuthenticatedUser.page, emailClient, 'Administrator'),
    );
  },

  // Intermediate fixture that sets up the page and returns all setup data
  pageWithAuthenticatedUser: async (
    { browser, reeditoInstance, reeditoAccountOwner, _testEnvironmentContext },
    use,
  ) => {
    if (!reeditoInstance.baseUrl) {
      throw new Error('baseURL is not defined');
    }

    _testEnvironmentContext.markResetEnvironmentBlocker('pageWithAuthenticatedUser');

    const pageWithAuthenticatedUser =
      _testEnvironmentContext.resolvedIsolation === 'per-file' && cachedPerFileAuthenticatedSession
        ? await setupAuthenticatedPageFromStorageState(
            browser,
            reeditoInstance.baseUrl,
            cachedPerFileAuthenticatedSession,
          )
        : await setupNewAuthenticatedPage(browser, reeditoInstance.baseUrl, reeditoAccountOwner);

    if (
      _testEnvironmentContext.resolvedIsolation === 'per-file' &&
      !cachedPerFileAuthenticatedSession
    ) {
      cachedPerFileAuthenticatedSession = {
        reeditoAccountOwner: pageWithAuthenticatedUser.reeditoAccountOwner,
        storageState: await pageWithAuthenticatedUser.context.storageState(),
      };
    }

    await use(pageWithAuthenticatedUser);
    await pageWithAuthenticatedUser.context.close();
  },

  // Extract the page from pageWithAuthenticatedUser and apply labs settings
  page: async ({ pageWithAuthenticatedUser, labs, _testEnvironmentContext }, use) => {
    _testEnvironmentContext.markResetEnvironmentBlocker('page');

    const page = pageWithAuthenticatedUser.page;

    // Browser-side egress monitoring (complements the server-side DNS monitor):
    // the Reedito container's resolver can't see requests the browser makes itself
    // (changelog.json, embeds, avatar services, …), so we watch them here and
    // hand off-allowlist hosts to the worker-level sweep (_egressSummary).
    const browserEgressRequests = new Map<Request, string>();
    const onRequest = (request: Request) => {
      let host: string;
      try {
        const url = new URL(request.url());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return;
        }
        host = url.hostname;
      } catch {
        return;
      }
      if (!isAllowedHost(host)) {
        browserEgressRequests.set(request, host);
      }
    };
    const onResponse = (response: Response) => {
      if (response.headers()[EGRESS_MOCK_RESPONSE_HEADER] === '1') {
        browserEgressRequests.delete(response.request());
      }
    };
    if (EGRESS_MONITOR_ENABLED) {
      page.on('request', onRequest);
      page.on('response', onResponse);
    }

    const labsFlagsSpecified = labs && Object.keys(labs).length > 0;
    if (labsFlagsSpecified) {
      const settingsService = new SettingsService(page.request);
      debug('Updating labs settings:', labs);
      await settingsService.updateLabsSettings(labs);
    }

    const needsReload = labsFlagsSpecified;
    if (needsReload) {
      await page.reload({ waitUntil: 'load' });
      debug('Settings applied and page reloaded');
    }

    await use(page);

    if (EGRESS_MONITOR_ENABLED) {
      page.off('request', onRequest);
      page.off('response', onResponse);
      for (const host of browserEgressRequests.values()) {
        workerBrowserEgressHosts.add(host);
      }
    }
  },
});

export { expect } from '@playwright/test';
