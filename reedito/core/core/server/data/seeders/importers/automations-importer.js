"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationsImporter = void 0;
const faker_1 = require("@faker-js/faker");
// @ts-expect-error This module currently lacks type definitions.
const string_1 = require("@tryghost/string");
const table_importer_1 = require("./table-importer");
const blog_info_1 = require("../utils/blog-info");
const date_1 = require("../../../lib/db-types/date");
const constants_1 = require("../../../services/member-welcome-emails/constants");
const defaultAutomations = [
    {
        name: 'Free member welcome flow',
        slug: constants_1.MEMBER_WELCOME_EMAIL_SLUGS.free,
    },
    {
        name: 'Paid member welcome flow',
        slug: constants_1.MEMBER_WELCOME_EMAIL_SLUGS.paid,
    },
];
class AutomationsImporter extends table_importer_1.TableImporter {
    static table = 'automations';
    static dependencies = [];
    #generated = 0;
    defaultQuantity = 2;
    constructor(knex, transaction) {
        super(AutomationsImporter.table, knex, transaction);
    }
    generate() {
        const id = this.fastFakeObjectId();
        const defaultAutomation = defaultAutomations[this.#generated];
        const randomName = `${faker_1.faker.word.adjective()} ${faker_1.faker.word.noun()} flow`;
        const name = defaultAutomation?.name ?? `${randomName} ${id}`;
        const slug = defaultAutomation?.slug ?? `${(0, string_1.slugify)(randomName)}-${id}`;
        const createdAt = faker_1.faker.date.between({ from: blog_info_1.blogStartDate, to: new Date() });
        this.#generated += 1;
        return {
            id,
            status: faker_1.faker.helpers.arrayElement(['active', 'inactive']),
            name,
            slug,
            created_at: (0, date_1.toDatabaseDate)(createdAt),
            updated_at: (0, date_1.toDatabaseDate)(createdAt),
        };
    }
}
exports.AutomationsImporter = AutomationsImporter;
