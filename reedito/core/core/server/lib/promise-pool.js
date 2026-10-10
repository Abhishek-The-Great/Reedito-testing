"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promisePool = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const validateMaxConcurrency = (maxConcurrency) => {
    if (maxConcurrency < 1 || !Number.isSafeInteger(maxConcurrency)) {
        throw new errors_1.default.IncorrectUsageError({
            message: 'Concurrency must be a positive integer',
        });
    }
};
/**
 * Run promise-returning tasks with a bounded level of concurrency.
 */
const promisePool = async (tasks, maxConcurrency) => {
    validateMaxConcurrency(maxConcurrency);
    const taskIterator = tasks.values();
    const concurrency = Math.min(maxConcurrency, tasks.length);
    const workers = Array(concurrency)
        .fill(taskIterator)
        .map(async (workerIterator) => {
        for (const task of workerIterator) {
            await task();
        }
    });
    await Promise.all(workers);
};
exports.promisePool = promisePool;
