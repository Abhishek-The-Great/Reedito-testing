"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReeditoServer = void 0;
// # Reedito Server
// Handles the creation of an HTTP Server for Reedito
const debug_1 = __importDefault(require("@tryghost/debug"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const logging_1 = __importDefault(require("@tryghost/logging"));
const metrics_1 = __importDefault(require("@tryghost/metrics"));
// @ts-expect-error This module lacks type definitions.
const notify_1 = __importDefault(require("./notify"));
const errify_1 = require("../shared/errify");
const flush_1 = require("../shared/flush");
const moment_1 = __importDefault(require("moment"));
const stoppable_1 = __importDefault(require("stoppable"));
const node_util_1 = require("node:util");
const node_assert_1 = __importDefault(require("node:assert"));
const debug = (0, debug_1.default)('server');
const messages = {
    cantTouchThis: "Can't touch this",
    reeditoIsRunning: 'Reedito is running...',
    yourBlogIsAvailableOn: 'Your site is now available on {url}',
    ctrlCToShutDown: 'Ctrl+C to shut down',
    reeditoIsRunningIn: 'Reedito is running in {env}...',
    listeningOn: 'Listening on: {host}:{port}',
    urlConfiguredAs: 'Url configured as: {url}',
    reeditoIsShuttingDown: 'Reedito is shutting down',
    reeditoHasShutdown: 'Reedito has shut down',
    yourBlogIsNowOffline: 'Your site is now offline',
    reeditoWasRunningFor: 'Reedito was running for',
    addressInUse: {
        error: '(EADDRINUSE) Cannot start Reedito.',
        context: 'Port {port} is already in use by another program.',
        help: 'Is another Reedito instance already running?',
    },
    otherError: {
        error: '(Code: {errorNumber})',
        context: 'There was an error starting your server.',
        help: 'Please use the error code above to search for a solution.',
    },
};
/**
 * ## ReeditoServer
 */
class ReeditoServer {
    url;
    env;
    serverConfig;
    rootApp = null;
    httpServer = null;
    isShuttingDown = false;
    /** Tasks that should run before the server exits. */
    cleanupTasks = [];
    /** Tasks that should run at the very start of shutdown. */
    preStopTasks = [];
    constructor({ url, env, serverConfig, }) {
        this.url = url;
        this.env = env;
        this.serverConfig = serverConfig;
    }
    /**
     * ## Public API methods
     *
     * ### Start
     * Starts the reedito server listening on the configured port.
     * Requires an express app to be passed in
     *
     * @param rootApp Required express app instance.
     * @return Resolves once Reedito has started
     */
    start(rootApp) {
        debug('Starting...');
        this.rootApp = rootApp;
        const { host, port, shutdownTimeout } = this.serverConfig;
        return new Promise((resolve, reject) => {
            const httpServer = rootApp.listen(port, host);
            httpServer.on('error', (error) => {
                let reeditoError;
                if ('code' in error && error.code === 'EADDRINUSE') {
                    reeditoError = new errors_1.default.InternalServerError({
                        message: (0, tpl_1.default)(messages.addressInUse.error),
                        context: (0, tpl_1.default)(messages.addressInUse.context, { port }),
                        help: (0, tpl_1.default)(messages.addressInUse.help),
                    });
                }
                else {
                    reeditoError = new errors_1.default.InternalServerError({
                        message: (0, tpl_1.default)(messages.otherError.error, {
                            errorNumber: 'errno' in error ? error.errno : 'unknown',
                        }),
                        context: (0, tpl_1.default)(messages.otherError.context),
                        help: (0, tpl_1.default)(messages.otherError.help),
                    });
                }
                debug('Notifying server started (error)');
                return notify_1.default.notifyServerStarted().finally(() => {
                    reject(reeditoError);
                });
            });
            httpServer.on('listening', () => {
                debug('...Started');
                this._logStartMessages();
                debug('Notifying server ready (success)');
                return notify_1.default.notifyServerStarted().finally(() => {
                    resolve(this);
                });
            });
            this.httpServer = (0, stoppable_1.default)(httpServer, shutdownTimeout);
            // ensure that Reedito exits correctly on Ctrl+C and SIGTERM
            process
                .removeAllListeners('SIGINT')
                .on('SIGINT', () => this.shutdown())
                .removeAllListeners('SIGTERM')
                .on('SIGTERM', () => this.shutdown());
        });
    }
    /**
     * ### Shutdown
     * Stops the server, handles cleanup and exits the process = a full shutdown
     * Called on SIGINT or SIGTERM
     */
    async shutdown(code = 0) {
        // Prevent this function being run multiple times by checking whether we're
        // already shutting down
        if (this.isShuttingDown) {
            return;
        }
        try {
            this.isShuttingDown = true;
            logging_1.default.warn((0, tpl_1.default)(messages.reeditoIsShuttingDown));
            await this.stop();
            await (0, flush_1.flushLogsAndMetrics)();
            process.exit(code);
        }
        catch (error) {
            logging_1.default.error(error);
            await (0, flush_1.flushLogsAndMetrics)();
            process.exit(1);
        }
    }
    /**
     * ### Stop
     * Stops the server & handles cleanup, but does not exit the process
     * Used in tests for quick start/stop actions
     * Called by shutdown to handle server stop and cleanup before exiting
     * @returns Resolves once Reedito has stopped
     */
    async stop() {
        try {
            // Signal "stop taking new work" before the HTTP server drain, so background
            // workers aren't still claiming tasks during it
            this._preStop();
            // If we never fully started, there's nothing to stop
            if (this.httpServer && this.httpServer.listening) {
                // Time how long it takes to close all in-flight requests
                const startTime = Date.now();
                // We stop the server first so that no new long running requests or processes can be started
                await this._stopServer();
                const shutdownDuration = Date.now() - startTime;
                if (shutdownDuration > 15000) {
                    metrics_1.default.metric('long-shutdown', shutdownDuration);
                }
            }
            // Do all of the cleanup tasks
            await this._cleanup();
        }
        finally {
            // Wrap up
            this.httpServer = null;
            this._logStopMessages();
        }
    }
    /**
     * ### Hammertime
     * To be called after `stop`
     */
    async hammertime() {
        logging_1.default.info((0, tpl_1.default)(messages.cantTouchThis));
    }
    /**
     * Add a task that should be called on shutdown
     */
    registerCleanupTask(task, label) {
        this.cleanupTasks.push({
            task,
            label: label || `cleanup task #${this.cleanupTasks.length + 1}`,
        });
    }
    /**
     * Add a task that runs at the very start of shutdown, before the HTTP server drain.
     * Synchronous on purpose: this is the shutdown critical path, so it's for cheap "stop
     * claiming new work" signals only. Draining belongs in a cleanup task.
     */
    registerPreStopTask(task, label) {
        this.preStopTasks.push({
            task,
            label: label || `pre-stop task #${this.preStopTasks.length + 1}`,
        });
    }
    /**
     * ### Stop Server
     * Does the work of stopping the server using stoppable
     * This handles closing connections:
     * - New connections are rejected
     * - Idle connections are closed immediately
     * - Active connections are allowed to complete in-flight requests before being closed
     *
     * If server.shutdownTimeout is reached, requests are terminated in-flight
     */
    async _stopServer() {
        const { httpServer } = this;
        (0, node_assert_1.default)(httpServer, 'httpServer must be set before stopping server');
        const startTime = Date.now();
        try {
            return await (0, node_util_1.promisify)(httpServer.stop.bind(httpServer))();
        }
        finally {
            logging_1.default.info(`Shutdown: stopped HTTP server in ${Date.now() - startTime}ms`);
        }
    }
    /**
     * Best-effort: a throwing task must not skip the ones after it, nor the drain and
     * cleanup that follow.
     */
    _preStop() {
        for (const { task, label } of this.preStopTasks) {
            try {
                task();
            }
            catch (error) {
                logging_1.default.error(new errors_1.default.InternalServerError({
                    err: (0, errify_1.errify)(error),
                    message: `Shutdown: ${label} failed`,
                }));
            }
        }
    }
    /**
     * Runs cleanup tasks concurrently, timing each so a slow one is identifiable.
     * Every task runs to completion regardless of its siblings: a rejection escaping the
     * map would exit the process mid-drain and orphan email batches in `submitting`.
     */
    async _cleanup() {
        const failed = [];
        await Promise.all(this.cleanupTasks.map(async ({ task, label }) => {
            const startTime = Date.now();
            try {
                await task();
            }
            catch (error) {
                failed.push(label);
                logging_1.default.error(new errors_1.default.InternalServerError({
                    err: (0, errify_1.errify)(error),
                    message: `Shutdown: ${label} failed`,
                }));
            }
            finally {
                logging_1.default.info(`Shutdown: ${label} finished in ${Date.now() - startTime}ms`);
            }
        }));
        // Surface a non-zero exit, but only once every task has settled
        if (failed.length > 0) {
            throw new errors_1.default.InternalServerError({
                message: `Shutdown: ${failed.length} cleanup task(s) failed: ${failed.join(', ')}`,
            });
        }
    }
    /**
     * Log Start Messages
     */
    _logStartMessages() {
        logging_1.default.info((0, tpl_1.default)(messages.reeditoIsRunningIn, { env: this.env }));
        if (this.env === 'production') {
            logging_1.default.info((0, tpl_1.default)(messages.yourBlogIsAvailableOn, { url: this.url }));
        }
        else {
            logging_1.default.info((0, tpl_1.default)(messages.listeningOn, {
                host: this.serverConfig.host,
                port: this.serverConfig.port,
            }));
            logging_1.default.info((0, tpl_1.default)(messages.urlConfiguredAs, { url: this.url }));
        }
        logging_1.default.info((0, tpl_1.default)(messages.ctrlCToShutDown));
    }
    /**
     * Log Stop Messages
     */
    _logStopMessages() {
        logging_1.default.warn((0, tpl_1.default)(messages.reeditoHasShutdown));
        // Extra clear message for production mode
        if (this.env === 'production') {
            logging_1.default.warn((0, tpl_1.default)(messages.yourBlogIsNowOffline));
        }
        // Always output uptime
        logging_1.default.warn((0, tpl_1.default)(messages.reeditoWasRunningFor), moment_1.default.duration(process.uptime(), 'seconds').humanize());
    }
    /**
     * Test-only utilty.
     */
    __testOnlyAddress() {
        const { httpServer } = this;
        const address = httpServer?.address();
        if (address && typeof address === 'object') {
            return address;
        }
        return null;
    }
}
exports.ReeditoServer = ReeditoServer;
