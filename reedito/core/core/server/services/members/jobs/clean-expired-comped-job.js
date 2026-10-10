"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class CleanExpiredCompedJob extends job_1.Job {
    static type = 'clean-expired-comped';
}
exports.default = CleanExpiredCompedJob;
