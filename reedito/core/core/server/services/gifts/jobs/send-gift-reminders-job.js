"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class SendGiftRemindersJob extends job_1.Job {
    static type = 'send-gift-reminders';
}
exports.default = SendGiftRemindersJob;
