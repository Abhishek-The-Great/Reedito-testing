"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const moment = require('moment');
async function cleanTokens({ db, logging }) {
    const d = moment.utc().subtract(24, 'hours');
    const deletedTokens = await db
        .knex('tokens')
        .where('created_at', '<', d.format('YYYY-MM-DD HH:mm:ss')) // we need to be careful about the type here. .format() is the only thing that works across SQLite and MySQL
        .delete();
    logging.info({
        system: {
            event: 'clean_tokens.completed',
            deleted_count: deletedTokens,
        },
    }, `[Background Job] clean-tokens removed ${deletedTokens} tokens older than 24 hours`);
    return deletedTokens;
}
exports.default = cleanTokens;
