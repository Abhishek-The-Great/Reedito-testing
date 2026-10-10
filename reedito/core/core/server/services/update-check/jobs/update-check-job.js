"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class UpdateCheckJob extends job_1.Job {
    static type = 'update-check';
}
exports.default = UpdateCheckJob;
