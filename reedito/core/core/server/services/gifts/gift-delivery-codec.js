"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeGiftDeliveryRow = decodeGiftDeliveryRow;
exports.encodeGiftDelivery = encodeGiftDelivery;
const case_keys_1 = require("../../lib/case-keys");
const gift_delivery_schema_1 = require("./gift-delivery-schema");
function decodeGiftDeliveryRow(input) {
    return (0, case_keys_1.camelKeys)(gift_delivery_schema_1.DbGiftDelivery.parse(input));
}
function encodeGiftDelivery(delivery) {
    return gift_delivery_schema_1.DbGiftDelivery.parse((0, case_keys_1.snakeKeys)(delivery));
}
