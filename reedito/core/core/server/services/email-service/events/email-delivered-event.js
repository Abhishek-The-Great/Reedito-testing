"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailDeliveredEvent = void 0;
class EmailDeliveredEvent {
    email;
    memberId;
    emailId;
    emailRecipientId;
    timestamp;
    constructor({ email, memberId, emailId, emailRecipientId, timestamp, }) {
        this.email = email;
        this.memberId = memberId;
        this.emailId = emailId;
        this.emailRecipientId = emailRecipientId;
        this.timestamp = timestamp;
    }
    static create(data) {
        return new EmailDeliveredEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.EmailDeliveredEvent = EmailDeliveredEvent;
