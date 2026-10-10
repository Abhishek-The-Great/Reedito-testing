"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailOpenedEvent = void 0;
class EmailOpenedEvent {
    email;
    memberId;
    emailId;
    emailRecipientId;
    timestamp;
    constructor({ email, memberId, emailId, emailRecipientId, timestamp, }) {
        this.memberId = memberId;
        this.emailId = emailId;
        this.emailRecipientId = emailRecipientId;
        this.email = email;
        this.timestamp = timestamp;
    }
    static create(data) {
        return new EmailOpenedEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.EmailOpenedEvent = EmailOpenedEvent;
