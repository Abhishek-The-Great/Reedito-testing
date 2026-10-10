"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class SendWeeklyReaderDigestsJob extends job_1.Job {
    static type = 'send-weekly-reader-digests';
}
exports.default = SendWeeklyReaderDigestsJob;
