"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartGiftEmailAnalyticsJobEvent = void 0;
class StartGiftEmailAnalyticsJobEvent {
    timestamp;
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
    static create(timestamp = new Date()) {
        return new StartGiftEmailAnalyticsJobEvent(timestamp);
    }
}
exports.StartGiftEmailAnalyticsJobEvent = StartGiftEmailAnalyticsJobEvent;
