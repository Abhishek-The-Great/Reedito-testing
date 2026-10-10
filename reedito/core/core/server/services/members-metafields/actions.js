"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.actingContext = actingContext;
exports.adminWriteOrigin = adminWriteOrigin;
exports.recordMetafieldAction = recordMetafieldAction;
const logging_1 = __importDefault(require("@tryghost/logging"));
/**
 * Who is acting, read off an API frame's context.
 *
 * Here rather than in each endpoint, because two resources now record metafield history
 * and a second reading of the same shape is a second chance to disagree about it. An
 * integration and a user are both actors; a request that is neither — a webhook, a job —
 * has none, and the history says so rather than guessing.
 */
function actingContext(context) {
    const frame = (context ?? {});
    const viaApiKey = Boolean(frame.api_key);
    if (frame.integration) {
        return { actor: { id: frame.integration.id, type: 'integration', viaApiKey } };
    }
    if (frame.user) {
        return { actor: { id: frame.user, type: 'user', viaApiKey } };
    }
    return { actor: null };
}
/**
 * Who made a write through the Admin API and where, read off the same context as
 * `actingContext`, so the values a request writes and the history it records name the
 * same writer. Null when nobody is acting, which no Admin API write should be.
 */
function adminWriteOrigin(context) {
    const { actor } = actingContext(context);
    if (!actor) {
        return null;
    }
    if (actor.type === 'integration') {
        return { writtenBy: { type: 'integration', id: actor.id }, source: 'admin_api' };
    }
    // A staff token authenticates as its user but is a call to the API, not a visit to Admin.
    return {
        writtenBy: { type: 'user', id: actor.id },
        source: actor.viaApiKey ? 'admin_api' : 'admin',
    };
}
// Field-definition changes map to activity-feed events. A field's timeline reads
// added -> edited -> archived -> restored, and a permanent delete (only from the
// archived state) ends it with deleted.
const COMMANDS = {
    create: 'added',
    rename: 'edited',
    reorder: 'edited',
    changeAccess: 'edited',
    archive: 'archived',
    restore: 'restored',
    delete: 'deleted',
};
// Best-effort action-log write: a failed action must never fail the command that triggered it.
async function recordMetafieldAction({ Action, context, verb, subject, details, }) {
    if (!context.actor) {
        return;
    }
    try {
        await Action.add({
            event: COMMANDS[verb],
            resource_type: 'member_custom_field',
            // The field's id: this column holds 24 characters, and a key minted from
            // a publisher-chosen name is bounded by the far wider key column, so only
            // the id fits every field. Null where the act had no single field.
            resource_id: subject,
            actor_type: context.actor.type,
            actor_id: context.actor.id,
            context: details,
        }, { autoRefresh: false });
    }
    catch (err) {
        logging_1.default.error({
            event: { name: 'members.metafields.action_log_failed' },
            err,
            verb,
            subject,
            actorType: context.actor.type,
            actorId: context.actor.id,
        }, 'Failed to record a member metafield action');
    }
}
