"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeCheckoutCollectionOptions = stripeCheckoutCollectionOptions;
const logging_1 = __importDefault(require("@tryghost/logging"));
const checkout_1 = require("@reedito/checkout");
/** Keyed on the eligible types, so this and the configure-time rule cannot drift apart. */
const QUESTION_TYPES = {
    short_text: 'text',
};
function askable(question) {
    if (!(0, checkout_1.isCheckoutEligible)(question.type)) {
        logging_1.default.warn({
            event: { name: 'stripe.checkout.question_skipped' },
            customFieldKey: question.key,
            fieldType: question.type,
            reason: 'unsupported_type',
        }, 'Skipping a Stripe checkout question');
        return false;
    }
    if (question.prompt.length > checkout_1.MAX_CHECKOUT_LABEL_LENGTH) {
        logging_1.default.warn({
            event: { name: 'stripe.checkout.question_skipped' },
            customFieldKey: question.key,
            promptLength: question.prompt.length,
            reason: 'label_too_long',
        }, 'Skipping a Stripe checkout question');
        return false;
    }
    return true;
}
/**
 * Build the collection parameters for a checkout, or nothing at all.
 *
 * Returns an object with no keys when a tier asks for nothing, so a caller can spread it
 * over its session options unconditionally and change nothing.
 */
function stripeCheckoutCollectionOptions(checkout) {
    const options = {};
    if (!checkout) {
        return options;
    }
    const eligible = checkout.customFields.filter(askable);
    const questions = eligible.slice(0, checkout_1.MAX_CHECKOUT_CUSTOM_FIELDS);
    if (questions.length < eligible.length) {
        logging_1.default.warn({
            event: { name: 'stripe.checkout.questions_trimmed' },
            asked: questions.length,
            configured: eligible.length,
        }, 'Some Stripe checkout questions were not asked');
    }
    if (questions.length > 0) {
        options.custom_fields = questions.map((question) => ({
            // Reedito sends the custom field's own key as the question's identifier, and Stripe
            // returns the buyer's answer labelled with that same key. Using it in both places
            // means reading an answer is a direct lookup of the field it belongs to, with
            // nothing in between that could map it to the wrong one.
            key: question.key,
            label: { type: 'custom', custom: question.prompt },
            type: QUESTION_TYPES[question.type],
            optional: question.optional,
        }));
    }
    if (checkout.shipping) {
        // Reedito stores "everywhere" as no list, because the set of countries moves and a
        // stored copy of it would quietly become a restriction. Stripe has no such sentinel:
        // `allowed_countries` is the only key `shipping_address_collection` has, so a request
        // that omits it carries no parameter at all, and Stripe accepts it precisely because
        // it was never asked to collect anything — a session that succeeds and collects no
        // address. So everywhere is expanded to every country here, at the one point that
        // builds the request.
        //
        // An empty list is neither everywhere nor a real restriction, and would encode to the
        // same absent parameter. Defended here rather than trusted from the settings screen:
        // this is the checkout path, and a malformed configuration must cost the collection
        // rather than throw inside a session build.
        const allowedCountries = checkout.shipping.allowedCountries ?? [...checkout_1.STRIPE_ALLOWED_COUNTRIES];
        if (allowedCountries.length === 0) {
            logging_1.default.warn({
                event: { name: 'stripe.checkout.collection_skipped' },
                port: 'shipping_address',
                reason: 'no_allowed_countries',
            }, 'Skipping a Stripe checkout collection');
        }
        else {
            options.shipping_address_collection = { allowed_countries: allowedCountries };
        }
    }
    // Unioned with whatever automatic tax asks for. Both want the same thing, so a site
    // running the 2024 tax beta keeps collecting and a site that asked for it starts.
    if (checkout.taxNumber) {
        options.tax_id_collection = { enabled: true };
    }
    if (checkout.phone) {
        options.phone_number_collection = { enabled: true };
    }
    return options;
}
