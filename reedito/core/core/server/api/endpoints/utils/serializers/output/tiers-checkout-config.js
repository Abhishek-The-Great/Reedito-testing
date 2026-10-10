"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tier_checkout_config_1 = require("../../../../../services/tier-checkout-config");
const serialize = (configs, _apiConfig, frame) => {
    frame.response = tier_checkout_config_1.toCheckoutConfigResponse.parse(configs);
};
// module.exports (not export): the API framework loads serializers via require().
module.exports = {
    browse: serialize,
    read: serialize,
    edit: serialize,
};
