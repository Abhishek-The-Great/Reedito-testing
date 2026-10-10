"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirementsByTier = exports.toCheckoutConfigResponse = exports.TierCheckoutConfig = exports.ShippingCollection = exports.ResolvedQuestion = exports.ResolvedCheckout = exports.PhoneCollection = exports.emptyCheckoutConfig = exports.CheckoutQuestion = exports.TierCheckoutConfigService = void 0;
/**
 * What a tier's checkout asks and collects.
 *
 * A domain of its own rather than part of the Tier aggregate: a tier is loaded into memory
 * once at boot, and these rows are read live because deleting a custom field cascades a
 * question away without that repository ever seeing it.
 *
 * Constructed by the tiers service wrapper at boot, which already holds the collaborators
 * this needs, rather than by an init() here — the custom field services are built before
 * it, so both are ready by the time it runs.
 */
var service_1 = require("./service");
Object.defineProperty(exports, "TierCheckoutConfigService", { enumerable: true, get: function () { return service_1.TierCheckoutConfigService; } });
var models_1 = require("./models");
Object.defineProperty(exports, "CheckoutQuestion", { enumerable: true, get: function () { return models_1.CheckoutQuestion; } });
Object.defineProperty(exports, "emptyCheckoutConfig", { enumerable: true, get: function () { return models_1.emptyCheckoutConfig; } });
Object.defineProperty(exports, "PhoneCollection", { enumerable: true, get: function () { return models_1.PhoneCollection; } });
Object.defineProperty(exports, "ResolvedCheckout", { enumerable: true, get: function () { return models_1.ResolvedCheckout; } });
Object.defineProperty(exports, "ResolvedQuestion", { enumerable: true, get: function () { return models_1.ResolvedQuestion; } });
Object.defineProperty(exports, "ShippingCollection", { enumerable: true, get: function () { return models_1.ShippingCollection; } });
Object.defineProperty(exports, "TierCheckoutConfig", { enumerable: true, get: function () { return models_1.TierCheckoutConfig; } });
var serializers_1 = require("./serializers");
Object.defineProperty(exports, "toCheckoutConfigResponse", { enumerable: true, get: function () { return serializers_1.toCheckoutConfigResponse; } });
Object.defineProperty(exports, "requirementsByTier", { enumerable: true, get: function () { return serializers_1.requirementsByTier; } });
