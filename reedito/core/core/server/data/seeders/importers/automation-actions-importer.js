"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationActionsImporter = void 0;
const errors_1 = __importDefault(require("@tryghost/errors"));
const table_importer_1 = require("./table-importer");
const date_1 = require("../../../lib/db-types/date");
const random_1 = require("../utils/random");
class AutomationActionsImporter extends table_importer_1.TableImporter {
    static table = 'automation_actions';
    static dependencies = ['automations'];
    #automation;
    #actionIndex = 0;
    defaultQuantity = 8;
    constructor(knex, transaction) {
        super(AutomationActionsImporter.table, knex, transaction);
    }
    async import(quantity = this.defaultQuantity) {
        const automations = await this.transaction
            .select('id', 'created_at')
            .from('automations');
        if (automations.length === 0) {
            return;
        }
        await this.importForEach(automations, quantity / automations.length);
    }
    setReferencedModel(automation) {
        this.#automation = automation;
        this.#actionIndex = 0;
    }
    generate() {
        if (!this.#automation) {
            throw new errors_1.default.IncorrectUsageError({
                message: 'Cannot generate automation action without an automation',
            });
        }
        const createdAt = (0, random_1.randomDateBetween)(this.#automation.created_at, new Date());
        const type = this.#actionIndex % 2 === 0 ? 'wait' : 'send_email';
        this.#actionIndex += 1;
        return {
            id: this.fastFakeObjectId(),
            created_at: (0, date_1.toDatabaseDate)(createdAt),
            updated_at: (0, date_1.toDatabaseDate)(createdAt),
            deleted_at: null,
            automation_id: this.#automation.id,
            type,
        };
    }
}
exports.AutomationActionsImporter = AutomationActionsImporter;
