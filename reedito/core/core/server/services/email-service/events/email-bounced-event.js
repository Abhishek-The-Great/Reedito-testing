"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailBouncedEvent = void 0;
class EmailBouncedEvent {
    id;
    email;
    memberId;
    emailId;
    error;
    emailRecipientId;
    timestamp;
    constructor({ id, email, memberId, emailId, error, emailRecipientId, timestamp, }) {
        this.id = id;
        this.memberId = memberId;
        this.emailId = emailId;
        this.email = email;
        this.error = error;
        this.emailRecipientId = emailRecipientId;
        this.timestamp = timestamp;
    }
    static create(data) {
        return new EmailBouncedEvent({ ...data, timestamp: data.timestamp || new Date() });
    }
}
exports.EmailBouncedEvent = EmailBouncedEvent;
