"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftDelivery = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const reeditoBookshelf = require('./base');
const GiftDeliveryModel = reeditoBookshelf.Model.extend({
    tableName: 'gift_deliveries',
    hasTimestamps: false,
    defaults: {
        status: 'pending',
        outcome: 'unknown',
    },
    gift() {
        return this.belongsTo('Gift', 'gift_id', 'id');
    },
}, {
    async destroy() {
        throw new errors_1.default.IncorrectUsageError({ message: 'Cannot destroy GiftDelivery' });
    },
});
exports.GiftDelivery = reeditoBookshelf.model('GiftDelivery', GiftDeliveryModel);
