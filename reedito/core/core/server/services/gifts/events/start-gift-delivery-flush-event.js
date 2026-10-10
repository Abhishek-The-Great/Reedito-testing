"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartGiftDeliveryFlushEvent = void 0;
class StartGiftDeliveryFlushEvent {
    timestamp;
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
    static create(timestamp = new Date()) {
        return new StartGiftDeliveryFlushEvent(timestamp);
    }
}
exports.StartGiftDeliveryFlushEvent = StartGiftDeliveryFlushEvent;
