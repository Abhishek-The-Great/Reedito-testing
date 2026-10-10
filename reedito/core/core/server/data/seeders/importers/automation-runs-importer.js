"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationRunsImporter = void 0;
const faker_1 = require("@faker-js/faker");
const errors_1 = __importDefault(require("@tryghost/errors"));
const strict_1 = __importDefault(require("node:assert/strict"));
const table_importer_1 = require("./table-importer");
const parse_email_address_1 = require("@reedito/parse-email-address");
const date_1 = require("../../../lib/db-types/date");
const random_1 = require("../utils/random");
const assertExampleEmailDomain = (email) => {
    const { domain } = (0, parse_email_address_1.parseEmailAddress)(email) ?? {};
    (0, strict_1.default)(domain, 'Refusing to seed an automation run for a member with no email');
    (0, strict_1.default)(domain === 'example.com' ||
        domain === 'example.net' ||
        domain === 'example.org' ||
        domain === 'example.edu' ||
        domain.endsWith('.example'), `Refusing to seed an automation run for non-example email: ${email}`);
};
class AutomationRunsImporter extends table_importer_1.TableImporter {
    static table = 'automation_runs';
    static dependencies = ['automations', 'members'];
    #automation;
    #members = [];
    defaultQuantity = 20;
    constructor(knex, transaction) {
        super(AutomationRunsImporter.table, knex, transaction);
    }
    async import(quantity = this.defaultQuantity) {
        const automations = await this.transaction
            .select('id', 'created_at')
            .from('automations');
        this.#members = await this.transaction
            .select('id', 'email', 'created_at')
            .from('members');
        if (automations.length === 0 || this.#members.length === 0) {
            return;
        }
        await this.importForEach(automations, quantity / automations.length);
    }
    setReferencedModel(automation) {
        this.#automation = automation;
    }
    generate() {
        if (!this.#automation) {
            throw new errors_1.default.IncorrectUsageError({
                message: 'Cannot generate automation run without an automation',
            });
        }
        const member = faker_1.faker.helpers.arrayElement(this.#members);
        const automationCreatedAt = (0, date_1.fromDatabaseDate)(this.#automation.created_at);
        const memberCreatedAt = (0, date_1.fromDatabaseDate)(member.created_at);
        const createdAt = (0, random_1.randomDateBetween)(new Date(Math.max(automationCreatedAt.valueOf(), memberCreatedAt.valueOf())), new Date());
        assertExampleEmailDomain(member.email);
        return {
            id: this.fastFakeObjectId(),
            created_at: (0, date_1.toDatabaseDate)(createdAt),
            updated_at: (0, date_1.toDatabaseDate)(createdAt),
            automation_id: this.#automation.id,
            member_id: member.id,
            member_email: member.email,
        };
    }
}
exports.AutomationRunsImporter = AutomationRunsImporter;
