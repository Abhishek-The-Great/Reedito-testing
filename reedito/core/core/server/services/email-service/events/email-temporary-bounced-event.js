"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemporaryBouncedEvent = void 0;
class EmailTemporaryBouncedEvent {
    id;
    email;
    memberId;
    emailId;
    error;
    emailRecipientId;
    timestamp;
    constructor({ id, email, memberId, emailId, emailRecipientId, error, timestamp, }) {
        this.id = id;
        this.memberId = memberId;
        this.emailId = emailId;
        this.email = email;
        this.error = error;
        this.emailRecipientId = emailRecipientId;
        this.timestamp = timestamp;
    }
    static create(data) {
        return new EmailTemporaryBouncedEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.EmailTemporaryBouncedEvent = EmailTemporaryBouncedEvent;
