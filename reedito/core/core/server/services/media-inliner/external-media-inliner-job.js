"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../jobs-service/job");
class ExternalMediaInlinerJob extends job_1.Job {
    static type = 'external-media-inliner';
    domains;
    constructor({ domains }) {
        super();
        this.domains = domains;
    }
}
exports.default = ExternalMediaInlinerJob;
