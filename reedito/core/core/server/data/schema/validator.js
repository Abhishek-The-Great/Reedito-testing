"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
const errors_1 = __importDefault(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const lodash_1 = __importDefault(require("lodash"));
// @ts-expect-error This module lacks type definitions.
const validator_1 = __importDefault(require("@tryghost/validator"));
// @ts-expect-error This module lacks type definitions.
const schema_1 = __importDefault(require("./schema"));
const messages = {
    valueCannotBeBlank: 'Value in [{tableName}.{columnKey}] cannot be blank.',
    valueMustBeBoolean: 'Value in [{tableName}.{columnKey}] must be one of true, false, 0 or 1.',
    valueExceedsMaxLength: 'Value in [{tableName}.{columnKey}] exceeds maximum length of {maxlength} characters.',
    valueIsNotInteger: 'Value in [{tableName}.{columnKey}] is not an integer.',
};
/**
 * Validate model against schema.
 *
 * ## on model update
 * - only validate changed fields
 * - otherwise we could throw errors which the user is out of control
 * - e.g.
 *   - we add a new field without proper validation, release goes out
 *   - we add proper validation for a single field
 * - if you call `user.save()` the default fallback in bookshelf is `options.method=update`.
 * - we set `options.method` explicit for adding resources (because otherwise bookshelf uses `update`)
 *
 * ## on model add
 * - validate everything to catch required fields
 */
function validateSchema(tableName, model, options) {
    options = options || {};
    const columns = lodash_1.default.keys(schema_1.default[tableName]);
    let validationErrors = [];
    lodash_1.default.each(columns, function each(columnKey) {
        let message = ''; // KEEP: Validator.js only validates strings.
        const strVal = lodash_1.default.toString(model.get(columnKey));
        if (options.method !== 'insert' && !lodash_1.default.has(model.changed, columnKey)) {
            return;
        }
        // check nullable
        if (Object.hasOwn(schema_1.default[tableName][columnKey], 'nullable') &&
            schema_1.default[tableName][columnKey].nullable !== true &&
            Object.hasOwn(schema_1.default[tableName][columnKey], 'type') &&
            schema_1.default[tableName][columnKey].type !== 'text' &&
            !Object.hasOwn(schema_1.default[tableName][columnKey], 'defaultTo')) {
            if (validator_1.default.isEmpty(strVal)) {
                message = (0, tpl_1.default)(messages.valueCannotBeBlank, {
                    tableName: tableName,
                    columnKey: columnKey,
                });
                validationErrors.push(new errors_1.default.ValidationError({
                    message: message,
                    context: tableName + '.' + columnKey,
                }));
            }
        }
        // validate boolean columns
        if (Object.hasOwn(schema_1.default[tableName][columnKey], 'type') &&
            schema_1.default[tableName][columnKey].type === 'boolean') {
            if (!(validator_1.default.isBoolean(strVal) || validator_1.default.isEmpty(strVal))) {
                message = (0, tpl_1.default)(messages.valueMustBeBoolean, {
                    tableName: tableName,
                    columnKey: columnKey,
                });
                validationErrors.push(new errors_1.default.ValidationError({
                    message: message,
                    context: tableName + '.' + columnKey,
                }));
            }
            // CASE: ensure we transform 0|1 to false|true
            if (!validator_1.default.isEmpty(strVal)) {
                model.set(columnKey, !!model.get(columnKey));
            }
        }
        // TODO: check if mandatory values should be enforced
        if (model.get(columnKey) !== null && model.get(columnKey) !== undefined) {
            // check length
            if (Object.hasOwn(schema_1.default[tableName][columnKey], 'maxlength')) {
                if (!validator_1.default.isLength(strVal, 0, schema_1.default[tableName][columnKey].maxlength)) {
                    message = (0, tpl_1.default)(messages.valueExceedsMaxLength, {
                        tableName: tableName,
                        columnKey: columnKey,
                        maxlength: schema_1.default[tableName][columnKey].maxlength,
                    });
                    validationErrors.push(new errors_1.default.ValidationError({
                        message: message,
                        context: tableName + '.' + columnKey,
                    }));
                }
            }
            // check validations objects
            if (Object.hasOwn(schema_1.default[tableName][columnKey], 'validations')) {
                validationErrors = validationErrors.concat(validator_1.default.validate(strVal, columnKey, schema_1.default[tableName][columnKey].validations, tableName));
            }
            // check type
            if (Object.hasOwn(schema_1.default[tableName][columnKey], 'type')) {
                if (schema_1.default[tableName][columnKey].type === 'integer' && !validator_1.default.isInt(strVal)) {
                    message = (0, tpl_1.default)(messages.valueIsNotInteger, {
                        tableName: tableName,
                        columnKey: columnKey,
                    });
                    validationErrors.push(new errors_1.default.ValidationError({
                        message: message,
                        context: tableName + '.' + columnKey,
                    }));
                }
            }
        }
    });
    if (validationErrors.length !== 0) {
        throw validationErrors;
    }
}
