"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindings = exports.values = exports.definitions = exports.canWrite = exports.MEMBER_ACCESS = exports.MEMBERS = exports.INTERNAL = exports.ADMIN = exports.adminWriteOrigin = exports.actingContext = void 0;
exports.init = init;
const definitions_service_1 = require("./definitions-service");
const values_service_1 = require("./values-service");
const bindings_service_1 = require("./bindings-service");
const actions_1 = require("./actions");
const config_1 = require("./config");
var actions_2 = require("./actions");
Object.defineProperty(exports, "actingContext", { enumerable: true, get: function () { return actions_2.actingContext; } });
Object.defineProperty(exports, "adminWriteOrigin", { enumerable: true, get: function () { return actions_2.adminWriteOrigin; } });
// Which door a request came through, which is what decides how much of a member's
// answers it may see or change. Required wherever that is asked, so a new caller
// has to name itself rather than inherit an answer by default.
var access_1 = require("./access");
Object.defineProperty(exports, "ADMIN", { enumerable: true, get: function () { return access_1.ADMIN; } });
Object.defineProperty(exports, "INTERNAL", { enumerable: true, get: function () { return access_1.INTERNAL; } });
Object.defineProperty(exports, "MEMBERS", { enumerable: true, get: function () { return access_1.MEMBERS; } });
Object.defineProperty(exports, "MEMBER_ACCESS", { enumerable: true, get: function () { return access_1.MEMBER_ACCESS; } });
Object.defineProperty(exports, "canWrite", { enumerable: true, get: function () { return access_1.canWrite; } });
function init() {
    // The three are constructed together below, so checking all of them keeps the "all or
    // none" invariant explicit rather than trusting one to stand in for the rest.
    if (exports.definitions && exports.values && exports.bindings) {
        return;
    }
    const { knex } = require('../../data/db');
    const models = require('../../models');
    const recordAction = ({ context, verb, subject, details }) => (0, actions_1.recordMetafieldAction)({ Action: models.Action, context, verb, subject, details });
    // Resolved here, not in the service: reading config is this module's job, and
    // the service is handed a number. A getter rather than a value because the
    // ceiling is an operator setting that can change between requests, and a Reedito
    // container holds no state across them.
    const config = require('../../../shared/config');
    exports.definitions = new definitions_service_1.MetafieldDefinitionsService({
        knex,
        recordAction,
        getMaxDefinitions: () => (0, config_1.resolveMaxDefinitions)(config.get('members:metafields:maxDefinitions')),
    });
    // The values service reads the field definitions straight from the table, so
    // it needs knex and the same ceiling — no handle on the definitions service.
    exports.values = new values_service_1.MetafieldValuesService({
        knex,
        getMaxDefinitions: () => (0, config_1.resolveMaxDefinitions)(config.get('members:metafields:maxDefinitions')),
    });
    // Built after the values, which is what a binding routes into. It has no handle on the
    // definitions: making a field is not part of binding to one, so a caller that needs both
    // asks for both.
    exports.bindings = new bindings_service_1.MetafieldBindingsService({ knex, values: exports.values });
}
