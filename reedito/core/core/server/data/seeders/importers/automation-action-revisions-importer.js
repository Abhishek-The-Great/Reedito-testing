"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationActionRevisionsImporter = void 0;
const faker_1 = require("@faker-js/faker");
const errors_1 = __importDefault(require("@tryghost/errors"));
const table_importer_1 = require("./table-importer");
const date_1 = require("../../../lib/db-types/date");
const constants_1 = require("../../../services/member-welcome-emails/constants");
class AutomationActionRevisionsImporter extends table_importer_1.TableImporter {
    static table = 'automation_action_revisions';
    static dependencies = ['automation_actions'];
    #action;
    #emailDesignSettingId;
    #revisionIndex = 0;
    defaultQuantity = 16;
    constructor(knex, transaction) {
        super(AutomationActionRevisionsImporter.table, knex, transaction);
    }
    async import(quantity = this.defaultQuantity) {
        const actions = await this.transaction
            .select('id', 'type', 'created_at')
            .from('automation_actions');
        if (actions.length === 0) {
            return;
        }
        const emailDesignSetting = await this.transaction('email_design_settings')
            .select('id')
            .where('slug', constants_1.DEFAULT_EMAIL_DESIGN_SETTING_SLUG)
            .first();
        if (!emailDesignSetting) {
            throw new errors_1.default.InternalServerError({
                message: `Missing email design setting: ${constants_1.DEFAULT_EMAIL_DESIGN_SETTING_SLUG}`,
            });
        }
        this.#emailDesignSettingId = emailDesignSetting.id;
        await this.importForEach(actions, quantity / actions.length);
    }
    setReferencedModel(action) {
        this.#action = action;
        this.#revisionIndex = 0;
    }
    generate() {
        if (!this.#action) {
            throw new errors_1.default.IncorrectUsageError({
                message: 'Cannot generate automation action revision without an action',
            });
        }
        const createdAt = (0, date_1.fromDatabaseDate)(this.#action.created_at);
        createdAt.setSeconds(createdAt.getSeconds() + this.#revisionIndex);
        this.#revisionIndex += 1;
        const common = {
            id: this.fastFakeObjectId(),
            created_at: (0, date_1.toDatabaseDate)(createdAt),
            action_id: this.#action.id,
            email_sent_count: null,
            email_opened_count: null,
            email_clicked_count: null,
        };
        switch (this.#action.type) {
            case 'wait':
                return {
                    ...common,
                    wait_hours: faker_1.faker.number.int({ min: 1, max: 30 }) * 24,
                    email_subject: null,
                    email_lexical: null,
                    email_design_setting_id: null,
                };
            case 'send_email':
                if (!this.#emailDesignSettingId) {
                    throw new errors_1.default.InternalServerError({
                        message: `Missing email design setting: ${constants_1.DEFAULT_EMAIL_DESIGN_SETTING_SLUG}`,
                    });
                }
                const emailBody = faker_1.faker.lorem.sentence();
                return {
                    ...common,
                    wait_hours: null,
                    email_subject: faker_1.faker.lorem.sentence(),
                    email_design_setting_id: this.#emailDesignSettingId,
                    email_lexical: JSON.stringify({
                        root: {
                            children: [
                                {
                                    children: [
                                        {
                                            detail: 0,
                                            format: 0,
                                            mode: 'normal',
                                            style: '',
                                            text: emailBody,
                                            type: 'text',
                                            version: 1,
                                        },
                                    ],
                                    direction: null,
                                    format: '',
                                    indent: 0,
                                    type: 'paragraph',
                                    version: 1,
                                },
                            ],
                            direction: null,
                            format: '',
                            indent: 0,
                            type: 'root',
                            version: 1,
                        },
                    }),
                };
            default:
                throw new errors_1.default.IncorrectUsageError({
                    message: `Unknown automation action type: ${this.#action.type}`,
                });
        }
    }
}
exports.AutomationActionRevisionsImporter = AutomationActionRevisionsImporter;
