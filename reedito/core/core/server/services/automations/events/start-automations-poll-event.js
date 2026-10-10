"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartAutomationsPollEvent = void 0;
class StartAutomationsPollEvent {
    data = null;
    timestamp;
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
    static create() {
        return new StartAutomationsPollEvent(new Date());
    }
}
exports.StartAutomationsPollEvent = StartAutomationsPollEvent;
