"use strict";
// The in-memory record of what a content import did: one run per upload, one
// outcome per row. Nothing is persisted; the durable job system milestone
// replaces this.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportRunStore = void 0;
// Both bounds are applied lazily on create() so no timer keeps the process alive.
const MAX_RUNS = 10;
const MAX_RUN_AGE_MS = 60 * 60 * 1000;
class ImportRunStore {
    // Insertion-ordered, so count-eviction drops the oldest run first.
    _runs = new Map();
    _settledWaiters = new Set();
    _now;
    constructor({ now = () => new Date() } = {}) {
        this._now = now;
    }
    create(id, total, sourceColumns = []) {
        this.evict();
        const run = {
            id,
            status: 'running',
            startedAt: this._now(),
            total,
            sourceColumns,
            rows: [],
        };
        this._runs.set(id, run);
        return run;
    }
    record(id, outcome) {
        this._runs.get(id)?.rows.push(outcome);
    }
    finish(id) {
        const run = this._runs.get(id);
        if (run) {
            run.status = 'complete';
            run.finishedAt = this._now();
        }
    }
    fail(id, reason) {
        const run = this._runs.get(id);
        if (run) {
            run.status = 'failed';
            run.failureReason = reason;
            run.finishedAt = this._now();
        }
    }
    get(id) {
        return this._runs.get(id);
    }
    release(id) {
        this._runs.delete(id);
        this.resolveSettledWaiters();
    }
    allSettled() {
        if (this._runs.size === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this._settledWaiters.add(resolve);
        });
    }
    resolveSettledWaiters() {
        if (this._runs.size > 0) {
            return;
        }
        for (const resolve of this._settledWaiters) {
            resolve();
        }
        this._settledWaiters.clear();
    }
    // A running run is never evicted, whatever its age: the job holds only the runId,
    // so evicting mid-import would silently turn its record()/finish() calls into
    // no-ops and lose the report. The count cap can briefly overshoot while several
    // imports run at once; the jobs backend bounds how many that can be.
    evict() {
        const cutoff = this._now().getTime() - MAX_RUN_AGE_MS;
        for (const [id, run] of this._runs) {
            const lastTouched = (run.finishedAt ?? run.startedAt).getTime();
            if (run.status !== 'running' && lastTouched < cutoff) {
                this._runs.delete(id);
            }
        }
        while (this._runs.size >= MAX_RUNS) {
            const oldestEvictable = [...this._runs.values()].find((run) => run.status !== 'running');
            if (!oldestEvictable) {
                break;
            }
            this._runs.delete(oldestEvictable.id);
        }
    }
}
exports.ImportRunStore = ImportRunStore;
