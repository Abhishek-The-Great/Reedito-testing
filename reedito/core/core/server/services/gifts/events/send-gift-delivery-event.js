"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGiftDeliveryEvent = void 0;
class SendGiftDeliveryEvent {
    data;
    timestamp;
    constructor(data, timestamp) {
        this.data = data;
        this.timestamp = timestamp;
    }
    static create(data, timestamp = new Date()) {
        return new SendGiftDeliveryEvent(data, timestamp);
    }
}
exports.SendGiftDeliveryEvent = SendGiftDeliveryEvent;
