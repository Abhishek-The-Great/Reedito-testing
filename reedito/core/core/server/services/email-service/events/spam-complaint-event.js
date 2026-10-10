"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpamComplaintEvent = void 0;
class SpamComplaintEvent {
    email;
    memberId;
    emailId;
    timestamp;
    constructor({ email, memberId, emailId, timestamp, }) {
        this.memberId = memberId;
        this.emailId = emailId;
        this.email = email;
        this.timestamp = timestamp;
    }
    static create(data) {
        return new SpamComplaintEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.SpamComplaintEvent = SpamComplaintEvent;
