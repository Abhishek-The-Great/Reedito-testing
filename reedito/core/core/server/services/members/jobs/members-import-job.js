"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../jobs-service/job");
class MembersImportJob extends job_1.Job {
    static type = 'members-import';
    spoolKey;
    labelName;
    extraLabels;
    emailRecipient;
    constructor(data) {
        super();
        this.spoolKey = data.spoolKey;
        this.labelName = data.labelName;
        this.extraLabels = data.extraLabels;
        this.emailRecipient = data.emailRecipient;
    }
}
exports.default = MembersImportJob;
