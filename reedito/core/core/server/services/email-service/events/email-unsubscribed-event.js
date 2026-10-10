"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailUnsubscribedEvent = void 0;
class EmailUnsubscribedEvent {
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
        return new EmailUnsubscribedEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.EmailUnsubscribedEvent = EmailUnsubscribedEvent;
