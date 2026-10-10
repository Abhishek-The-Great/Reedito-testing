const logging = require('@tryghost/logging');
const { createTransactionalMigration } = require('../../utils');
const ObjectID = require('bson-objectid').default;

const MIGRATION_USER = 1;

module.exports = createTransactionalMigration(
  async function up(knex) {
    logging.info('Adding Reedito ActivityPub integration');
    const existing = await knex
      .select('id')
      .from('integrations')
      .where('slug', '=', 'reedito-activitypub')
      .andWhere('type', '=', 'internal')
      .first();

    if (existing) {
      logging.warn('Found existing Reedito ActivityPub integration');
      return;
    }

    await knex
      .insert({
        id: new ObjectID().toHexString(),
        type: 'internal',
        slug: 'reedito-activitypub',
        name: 'Reedito ActivityPub',
        description: 'Internal Integration for ActivityPub',
        created_at: knex.raw('current_timestamp'),
        created_by: MIGRATION_USER,
      })
      .into('integrations');
  },
  async function down(knex) {
    logging.info('Removing Reedito ActivityPub integration');
    await knex
      .del()
      .from('integrations')
      .where('slug', '=', 'reedito-activitypub')
      .andWhere('type', '=', 'internal');
  },
);
