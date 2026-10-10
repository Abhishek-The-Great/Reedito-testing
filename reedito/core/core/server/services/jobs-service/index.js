"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.getInstance = getInstance;
exports.shutdown = shutdown;
const errors_1 = __importDefault(require("@tryghost/errors"));
const jobs_service_1 = require("./jobs-service");
let instance;
function init() {
    // The instance lives for the whole process: the didInit-guarded mentions
    // service captures it in MentionController and MentionSendingService, so
    // an in-process restart (test harness) must revive the same object rather
    // than strand those references on a stopped queue.
    if (instance) {
        instance.clearHandlers();
        return instance;
    }
    const adapterManager = require('../adapter-manager').default;
    const logging = require('@tryghost/logging');
    const sentry = require('../../../shared/sentry');
    instance = new jobs_service_1.JobsService({
        backend: adapterManager.getAdapter('jobs'),
        logging,
        sentry,
    });
    return instance;
}
function getInstance() {
    if (!instance) {
        throw new errors_1.default.IncorrectUsageError({
            message: 'Jobs service used before init(). Call init() from boot first.',
        });
    }
    return instance;
}
function shutdown(options) {
    if (!instance) {
        return Promise.resolve();
    }
    return instance.shutdown(options);
}
