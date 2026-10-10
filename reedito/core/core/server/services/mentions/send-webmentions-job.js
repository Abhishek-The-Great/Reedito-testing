"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../jobs-service/job");
// Carries the post's full html twice - the largest job payload in the system;
// revisit if a durable backend puts size limits on envelopes.
class SendWebmentionsJob extends job_1.Job {
    static type = 'send-webmentions';
    sourceUrl;
    html;
    previousHtml;
    constructor({ sourceUrl, html, previousHtml, }) {
        super();
        this.sourceUrl = sourceUrl;
        this.html = html ?? null;
        this.previousHtml = previousHtml ?? null;
    }
}
exports.default = SendWebmentionsJob;
