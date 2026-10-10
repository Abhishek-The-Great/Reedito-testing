import baseDebug from '@tryghost/debug';
import logging from '@tryghost/logging';
import { MySQLManager, ReeditoInstance } from './service-managers';
import { ReeditoManager } from './service-managers/reedito-manager';
import { randomUUID } from 'crypto';
import type { EgressMonitor } from './service-managers/egress-monitor';
import type { ReeditoConfig } from '@/helpers/playwright/fixture';

const debug = baseDebug('e2e:EnvironmentManager');

/**
 * Environment modes for E2E testing.
 *
 * - dev: Uses dev infrastructure with hot-reloading dev servers
 * - build: Uses pre-built image (local or registry, controlled by REEDITO_E2E_IMAGE)
 */
export type EnvironmentMode = 'dev' | 'build';
type ReeditoEnvOverrides = ReeditoConfig | Record<string, string>;

/**
 * Orchestrates e2e test environment.
 *
 * Supports two modes controlled by REEDITO_E2E_MODE environment variable:
 * - dev: Uses dev infrastructure with hot-reloading
 * - build: Uses pre-built image (set REEDITO_E2E_IMAGE for registry images)
 *
 * All modes use the same core infrastructure (MySQL, Redis, Mailpit) started
 * via docker compose. Analytics/Tinybird services are optional. Reedito and
 * gateway containers are created dynamically per-worker for test isolation.
 */
export class EnvironmentManager {
  private readonly mode: EnvironmentMode;
  private readonly workerIndex: number;
  private readonly mysql: MySQLManager;
  private readonly reedito: ReeditoManager;
  private initialized = false;

  constructor() {
    this.mode = this.detectMode();
    this.workerIndex = parseInt(process.env.TEST_PARALLEL_INDEX || '0', 10);

    this.mysql = new MySQLManager();
    this.reedito = new ReeditoManager({
      workerIndex: this.workerIndex,
      mode: this.mode,
    });
  }

  /**
   * Detect environment mode from REEDITO_E2E_MODE environment variable.
   */
  private detectMode(): EnvironmentMode {
    const envMode = process.env.REEDITO_E2E_MODE;
    if (envMode === 'build' || envMode === 'dev') {
      return envMode;
    }

    logging.warn(
      'REEDITO_E2E_MODE is not set; defaulting to build mode. Use the e2e shell entrypoints for automatic mode resolution.',
    );
    return 'build';
  }

  /**
   * Global setup - creates database snapshot for test isolation.
   *
   * Creates the worker 0 containers (Reedito + Gateway) and waits for Reedito to
   * become healthy. Reedito automatically runs migrations on startup. Once healthy,
   * we snapshot the database for test isolation.
   */
  async globalSetup(): Promise<void> {
    logging.info(`Starting ${this.mode} environment global setup...`);

    await this.cleanupResources();

    // Create base database
    await this.mysql.recreateBaseDatabase('reedito_e2e_base');

    // Create containers and wait for Reedito to be healthy (runs migrations)
    await this.reedito.setup('reedito_e2e_base');
    await this.reedito.waitForReady();
    this.initialized = true;

    // Snapshot the migrated database for test isolation
    await this.mysql.createSnapshot('reedito_e2e_base');

    logging.info(`${this.mode} environment global setup complete`);
  }

  /**
   * Global teardown - cleanup resources.
   */
  async globalTeardown(): Promise<void> {
    if (this.shouldPreserveEnvironment()) {
      logging.info('PRESERVE_ENV is set - skipping teardown');
      return;
    }

    logging.info(`Starting ${this.mode} environment global teardown...`);
    await this.cleanupResources();
    logging.info(`${this.mode} environment global teardown complete`);
  }

  /**
   * Per-test setup - creates containers on first call, then clones database and restarts Reedito.
   */
  async perTestSetup(
    options: {
      config?: ReeditoEnvOverrides;
    } = {},
  ): Promise<ReeditoInstance> {
    // Lazy initialization of Reedito containers (once per worker)
    if (!this.initialized) {
      debug('Initializing Reedito containers for worker', this.workerIndex, 'in mode', this.mode);
      await this.reedito.setup();
      this.initialized = true;
    }

    const siteUuid = randomUUID();
    const instanceId = `reedito_e2e_${siteUuid.replace(/-/g, '_')}`;

    // Setup database
    await this.mysql.setupTestDatabase(instanceId, siteUuid);

    // Restart Reedito with new database
    await this.reedito.restartWithDatabase(instanceId, options.config);
    await this.reedito.waitForReady();

    const port = this.reedito.getGatewayPort();

    return {
      containerId: this.reedito.reeditoContainerId!,
      instanceId,
      database: instanceId,
      port,
      baseUrl: `http://localhost:${port}`,
      siteUuid,
    };
  }

  /**
   * Per-test teardown - drops test database.
   */
  async perTestTeardown(instance: ReeditoInstance): Promise<void> {
    await this.mysql.cleanupTestDatabase(instance.database);
  }

  /**
   * Egress monitor for this worker, or null when disabled / unavailable.
   * Records external hostnames the Reedito container resolves.
   */
  getEgressMonitor(): EgressMonitor | null {
    return this.reedito.getEgressMonitor();
  }

  private async cleanupResources(): Promise<void> {
    logging.info('Cleaning up e2e resources...');
    await this.reedito.cleanupAllContainers();
    await this.mysql.dropAllTestDatabases();
    await this.mysql.deleteSnapshot();
    logging.info('E2E resources cleaned up');
  }

  private shouldPreserveEnvironment(): boolean {
    return process.env.PRESERVE_ENV === 'true';
  }
}
