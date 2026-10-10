"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftController = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
class GiftController {
    service;
    constructor({ service }) {
        this.service = service;
    }
    async getRedeemable(frame) {
        const token = frame.data.token;
        const memberStatus = frame.options?.context?.member?.status ?? null;
        return this.service.getRedeemable({ token, memberStatus });
    }
    async redeem(frame) {
        const token = frame.data.token;
        const member = frame.options?.context?.member;
        if (!member?.id) {
            throw new errors_1.default.UnauthorizedError({
                message: 'Member authentication required.',
            });
        }
        return this.service.redeem({
            token,
            memberId: member.id,
        });
    }
}
exports.GiftController = GiftController;
