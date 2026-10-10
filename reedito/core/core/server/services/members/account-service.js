"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberAccountService = void 0;
const lodash_1 = __importDefault(require("lodash"));
const members_metafields_1 = require("../members-metafields");
/**
 * A member's own account: what they are shown about themselves, and what they may
 * change.
 *
 * Separate from the request handlers that used to hold this, because none of it is
 * a question about HTTP. Which fields a member may set is a fact about members, and
 * the answer is the same whoever is asking.
 *
 * Takes a member id rather than a member. Everything here either writes or reads
 * afresh, and a record loaded before a write is stale by the time the answer is
 * built, so there is nothing a caller could usefully hand over.
 */
/** What a member is allowed to change about themselves. */
const WRITABLE_FIELDS = [
    'name',
    'expertise',
    'subscribed',
    'newsletters',
    'enable_comment_notifications',
    'enable_updates_and_announcements',
];
/**
 * The relations a write needs loaded to work out what it is changing.
 *
 * Newsletters because the older `subscribed` flag is stored as a list of them, and
 * the subscription chain because changing what a member is entitled to has to
 * reconcile against what they are paying for.
 */
const WRITE_RELATIONS = [
    'stripeSubscriptions',
    'stripeSubscriptions.customer',
    'stripeSubscriptions.stripePrice',
    'newsletters',
];
class MemberAccountService {
    #memberBREADService;
    #members;
    #emailSuppressionList;
    #metafieldValues;
    constructor({ memberBREADService, members, emailSuppressionList, metafieldValues, }) {
        this.#memberBREADService = memberBREADService;
        this.#members = members;
        this.#emailSuppressionList = emailSuppressionList;
        this.#metafieldValues = metafieldValues;
    }
    /** Everything a member is shown about themselves. */
    async read(memberId) {
        // As the member rather than as staff: how much of the extra fields a publisher
        // defines is answered depends on which side of Reedito is asking.
        return this.#memberBREADService.read({ id: memberId }, { metafieldsFor: members_metafields_1.MEMBERS });
    }
    /** Apply what a member asked to change about themselves, and say what they now hold. */
    async edit(data, memberId) {
        // Worked out before the member is touched, so a value the catalog refuses fails
        // the whole request rather than leaving a member renamed with their answers
        // rejected. The write below reconciles subscriptions with Stripe and sends
        // events, none of which giving up halfway could undo.
        const plannedMetafields = data.metafields === undefined
            ? null
            : await this.#metafieldValues.planWrite(this.#metafieldValues.unwrapWire(data.metafields), members_metafields_1.MEMBERS);
        await this.#members.update(lodash_1.default.pick(data, WRITABLE_FIELDS), {
            id: memberId,
            withRelated: WRITE_RELATIONS,
        });
        if (plannedMetafields) {
            // A member is recorded as the author of their own answers, made from their
            // account, which is Portal's.
            await this.#metafieldValues.applyWrite(memberId, plannedMetafields, {
                writtenBy: { type: 'member', id: memberId },
                source: 'portal',
            });
        }
        // Read back rather than returning what was written: a member is told what
        // Reedito now holds, which is not always what they sent. Setting the older
        // `subscribed` flag, for one, is stored as a list of newsletters.
        return this.read(memberId);
    }
    /**
     * Let Reedito email this member again.
     *
     * Two records rather than one: the address is on a list the email provider also
     * writes to, and the member carries a flag of their own. A member asking to hear
     * from a site again means both.
     */
    async allowEmail(memberId, email) {
        await this.#emailSuppressionList.removeEmail(email);
        await this.#members.update({ email_disabled: false }, { id: memberId });
    }
}
exports.MemberAccountService = MemberAccountService;
