"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class SendEmailJob extends job_1.Job {
    static type = 'send-email';
    emailId;
    constructor({ emailId }) {
        super();
        this.emailId = emailId;
    }
}
exports.default = SendEmailJob;
