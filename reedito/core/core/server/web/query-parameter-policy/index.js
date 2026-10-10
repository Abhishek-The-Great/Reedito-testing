"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryParameterPolicy = void 0;
const policy_json_1 = __importDefault(require("./policy.json"));
const schema_1 = require("./schema");
exports.queryParameterPolicy = (0, schema_1.parseQueryParameterPolicy)(policy_json_1.default);
