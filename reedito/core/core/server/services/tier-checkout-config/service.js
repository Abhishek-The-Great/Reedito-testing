"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierCheckoutConfigService = void 0;
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const errors_1 = __importDefault(require("@tryghost/errors"));
const zod_1 = require("zod");
const schema_1 = require("../members-metafields/schema");
const members_metafields_1 = require("../members-metafields");
const checkout_1 = require("@reedito/checkout");
const codec_1 = require("./codec");
const queries_1 = require("./queries");
const models_1 = require("./models");
const serializers_1 = require("./serializers");
/**
 * What a member may do with a field this service creates for them.
 *
 * The opposite of the default a publisher-made field gets. These hold what the member
 * themselves gave at checkout, and collection can be switched on while the screen for
 * opening a field to members is not, since the two sit behind different flags. A closed
 * default would then leave a member unable to correct their own address and nobody able
 * to open it for them.
 */
const COLLECTED_FIELD_ACCESS = { member: members_metafields_1.MEMBER_ACCESS.write };
/**
 * A request states its settings in named sections: one for shipping, one for phone. Each
 * section stands for one or more of the values Stripe hands back when a checkout is
 * completed — shipping covers both the recipient's name and their address, phone covers
 * only the phone number.
 *
 * Naming those values here means that a request which includes a section settles every
 * value in it: each one is either given a destination or has its old one removed. Without
 * this list, a value the request never mentioned could keep a destination from an earlier
 * save that the publisher believes they have turned off.
 */
const BLOCK_PORTS = {
    shipping: [checkout_1.STRIPE_PORT.shippingName, checkout_1.STRIPE_PORT.shippingAddress],
    phone: [checkout_1.STRIPE_PORT.phone],
};
class TierCheckoutConfigService {
    knex;
    bindings;
    fields;
    constructor({ knex, bindings, fields, }) {
        this.knex = knex;
        this.bindings = bindings;
        this.fields = fields;
    }
    async browse() {
        const rows = decodeCollection(await (0, queries_1.configuredCollectionRows)(this.knex));
        if (rows.length === 0) {
            return [];
        }
        const asked = await this.questions();
        return rows.map((row) => assemble(row, asked.get(row.tierId) ?? []));
    }
    async read(productId) {
        const [row] = decodeCollection(await (0, queries_1.collectionRowsForTier)(this.knex, productId));
        if (!row) {
            throw new errors_1.default.NotFoundError({ message: 'Tier not found.' });
        }
        if (!row.configured) {
            return null;
        }
        const asked = await this.questions(productId);
        return assemble(row, asked.get(productId) ?? []);
    }
    async resolve(productId) {
        const [row] = decodeCollection(await (0, queries_1.collectionRowsForTier)(this.knex, productId));
        if (!row?.configured) {
            return { customFields: [], ...(0, models_1.emptyCollection)() };
        }
        const asked = await this.questions(productId);
        const customFields = (asked.get(productId) ?? []).flatMap((entry) => entry.askable ? [{ ...entry.question, ...entry.askable }] : []);
        return { customFields, ...row.collecting };
    }
    /**
     * Saves the checkout settings a request states, and leaves the rest alone.
     *
     * A request only has to include the sections it wants to change. Say nothing about
     * shipping and the shipping settings stay exactly as they were, so a client that only
     * knows how to edit the questions cannot wipe out the shipping settings by omitting
     * them.
     */
    async edit(context, productId, input) {
        const stated = parseInput(input);
        const now = new Date();
        if (stated.custom_fields) {
            await assertQuestionsAskable(this.knex, stated.custom_fields);
        }
        const plan = await this.planCollection(stated);
        const created = await this.knex.transaction(async (trx) => {
            await assertTierExists(trx, productId);
            await writeOptions(trx, productId, stated, now);
            for (const port of plan.clear) {
                await this.bindings.remove(trx, productId, port);
            }
            const made = [];
            for (const wanted of plan.create) {
                made.push(await this.fields.addOne(wanted, { executor: trx }));
            }
            for (const { port, key } of plan.bind) {
                await this.bindings.bind(trx, productId, port, key, now);
            }
            if (stated.custom_fields) {
                await this.writeQuestions(trx, productId, stated.custom_fields, now);
            }
            return made;
        });
        await this.fields.recordCreated(context, created);
    }
    async questions(productId) {
        const rows = await (0, queries_1.questionRows)(this.knex, productId);
        const byTier = new Map();
        for (const row of rows) {
            const parts = zod_1.z.decode(codec_1.questionRowCodec, row);
            const forTier = byTier.get(parts.tierId) ?? [];
            forTier.push(parts);
            byTier.set(parts.tierId, forTier);
        }
        return byTier;
    }
    async planCollection(stated) {
        const wanted = [];
        if (stated.shipping?.collect) {
            wanted.push({ port: checkout_1.STRIPE_PORT.shippingName, key: stated.shipping.name.custom_field_key }, { port: checkout_1.STRIPE_PORT.shippingAddress, key: stated.shipping.address.custom_field_key });
        }
        if (stated.phone?.collect) {
            wanted.push({ port: checkout_1.STRIPE_PORT.phone, key: stated.phone.custom_field_key });
        }
        const bound = new Set(wanted.map(({ port }) => port));
        const clear = [];
        for (const block of ['shipping', 'phone']) {
            if (stated[block]) {
                clear.push(...BLOCK_PORTS[block].filter((port) => !bound.has(port)));
            }
        }
        const create = new Map();
        for (const { port, key } of wanted) {
            const wants = checkout_1.PORT_FIELD[port];
            const existing = await this.fields.findByKey(key);
            if (existing) {
                assertCollectableInto(port, existing, wants.type);
                continue;
            }
            const alreadyPlanned = create.get(key);
            if (alreadyPlanned && alreadyPlanned.type !== wants.type) {
                throw new errors_1.default.ValidationError({
                    message: `This can only be collected into a ${wants.type} field.`,
                    property: `checkout.${port}.custom_field_key`,
                });
            }
            if (!alreadyPlanned) {
                create.set(key, {
                    key,
                    name: wants.name,
                    type: wants.type,
                    access: COLLECTED_FIELD_ACCESS,
                });
            }
        }
        return { clear, create: [...create.values()], bind: wanted };
    }
    /**
     * Saves the questions this tier asks its buyers during checkout.
     *
     * A binding records that one value coming back from Stripe belongs in one custom field,
     * and it identifies the value by the name Stripe uses for it. For a question that name
     * is the custom field's own key: Reedito sends the key to Stripe as the question's
     * identifier, and Stripe returns the buyer's answer labelled with that same key. That is
     * why the key is passed twice below — once as the name Stripe will answer under, and
     * once as the field the answer is stored in.
     */
    async writeQuestions(trx, productId, questions, now) {
        const asked = new Set(questions.map((question) => question.key));
        const alreadyAsked = await trx(queries_1.QUESTIONS_TABLE)
            .join(queries_1.BINDINGS_TABLE, `${queries_1.BINDINGS_TABLE}.id`, `${queries_1.QUESTIONS_TABLE}.binding_id`)
            .where(`${queries_1.BINDINGS_TABLE}.product_id`, productId)
            .select(`${queries_1.BINDINGS_TABLE}.port`);
        for (const { port } of alreadyAsked) {
            if (!asked.has(port)) {
                await this.bindings.remove(trx, productId, port);
            }
        }
        for (const [index, question] of questions.entries()) {
            const bindingId = await this.bindings.bind(trx, productId, question.key, question.key, now);
            await trx(queries_1.QUESTIONS_TABLE).where('binding_id', bindingId).del();
            await trx(queries_1.QUESTIONS_TABLE).insert({
                id: new bson_objectid_1.default().toHexString(),
                binding_id: bindingId,
                sort_order: index,
                label: question.label ?? null,
                optional: question.optional ?? true,
                created_at: now,
            });
        }
    }
}
exports.TierCheckoutConfigService = TierCheckoutConfigService;
function parseInput(input) {
    const parsed = serializers_1.CheckoutConfigInput.safeParse(input);
    if (parsed.success) {
        return parsed.data;
    }
    const issue = parsed.error.issues[0];
    throw new errors_1.default.ValidationError({
        message: issue.message,
        property: issue.path.join('.') || 'checkout',
    });
}
function decodeCollection(rows) {
    return rows.map((row) => zod_1.z.decode(codec_1.collectionRowCodec, row));
}
function assemble(row, asked) {
    return {
        tierId: row.tierId,
        customFields: asked.map((entry) => entry.question),
        ...row.collection,
    };
}
async function assertTierExists(db, productId) {
    const tier = await db('products').where('id', productId).first();
    if (!tier) {
        throw new errors_1.default.NotFoundError({ message: 'Tier not found.' });
    }
}
/**
 * Refuses a custom field that cannot hold what Stripe will send back.
 *
 * A request names the custom field each collected value should be saved into. That field
 * has to be active, because an archived field accepts no new values, and it has to store
 * the right kind of data: Stripe returns a structured address for the shipping address,
 * and plain text for a name or a phone number.
 *
 * Both refusals are deliberate rather than defensive. Reedito could save the value into some
 * other field, or accept the request and quietly collect nothing, but a publisher who named
 * a field meant that field. Being told now is better than finding out weeks later that
 * nothing was ever recorded.
 */
function assertCollectableInto(port, field, valueType) {
    if (field.status !== schema_1.FIELD_STATUS.active) {
        throw new errors_1.default.ValidationError({
            message: 'An archived custom field cannot receive collected data. Restore it first.',
            property: `checkout.${port}.custom_field_key`,
        });
    }
    if (field.type !== valueType) {
        throw new errors_1.default.ValidationError({
            message: `This can only be collected into a ${valueType} field.`,
            property: `checkout.${port}.custom_field_key`,
        });
    }
}
async function writeOptions(trx, productId, stated, now) {
    const all = zod_1.z.encode(codec_1.optionsCodec, {
        shippingAllowedCountries: stated.shipping?.collect
            ? (stated.shipping.allowed_countries ?? null)
            : null,
        taxNumber: stated.tax_number?.collect ?? false,
    });
    // Only the columns this request spoke about are written, so two requests changing
    // different parts of the same tier cannot undo each other, and a request that mentions
    // neither still leaves the row behind as the record that this tier has been set up.
    const columns = {
        ...(stated.shipping ? { shipping_allowed_countries: all.shipping_allowed_countries } : {}),
        ...(stated.tax_number ? { tax_number_collect: all.tax_number_collect } : {}),
    };
    await trx(queries_1.CONFIG_TABLE)
        .insert({
        id: new bson_objectid_1.default().toHexString(),
        product_id: productId,
        created_at: now,
        updated_at: now,
        ...columns,
    })
        .onConflict('product_id')
        .merge({ ...columns, updated_at: now });
}
async function assertQuestionsAskable(db, questions) {
    const collides = questions.find((question) => (0, checkout_1.isStripePort)(question.key));
    if (collides) {
        throw new errors_1.default.ValidationError({
            message: `A field keyed ${collides.key} cannot be asked at checkout, because that is what this checkout calls something it collects for itself.`,
            property: 'checkout.custom_fields',
        });
    }
    const keys = questions.map((question) => question.key);
    if (keys.length === 0) {
        return;
    }
    const rows = await db(queries_1.FIELDS_TABLE)
        .whereIn(`${queries_1.FIELDS_TABLE}.key`, keys)
        .where(`${queries_1.FIELDS_TABLE}.status`, schema_1.FIELD_STATUS.active)
        .select(`${queries_1.FIELDS_TABLE}.key`, `${queries_1.FIELDS_TABLE}.name`, `${queries_1.FIELDS_TABLE}.type`, `${queries_1.FIELDS_TABLE}.status`);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const question of questions) {
        const field = byKey.get(question.key);
        if (!field) {
            throw new errors_1.default.ValidationError({
                message: `Unknown custom field: ${question.key}`,
                property: 'checkout.custom_fields',
            });
        }
        if (!(0, checkout_1.isCheckoutEligible)(field.type)) {
            throw new errors_1.default.ValidationError({
                message: `A ${field.type} field cannot be asked for at checkout.`,
                property: 'checkout.custom_fields',
            });
        }
        const prompt = question.label ?? field.name;
        if (prompt.length > checkout_1.MAX_CHECKOUT_LABEL_LENGTH) {
            throw new errors_1.default.ValidationError({
                message: `A checkout question can be at most ${checkout_1.MAX_CHECKOUT_LABEL_LENGTH} characters. Give this one a shorter label.`,
                property: 'checkout.custom_fields',
            });
        }
    }
}
