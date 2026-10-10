const logging = require('@tryghost/logging');
const { default: ObjectID } = require('bson-objectid');
const { createTransactionalMigration } = require('../../utils');

const MIGRATION_USER = 1;

module.exports = createTransactionalMigration(
  async function up(knex) {
    logging.info('Creating Reedito Explore Integration');
    const existingIntegration = await knex('integrations')
      .where({
        name: 'Reedito Explore',
        slug: 'ghost-explore',
      })
      .first();

    if (existingIntegration) {
      logging.warn('Integration already exists, skipping');
      return;
    }

    await knex('integrations').insert({
      id: new ObjectID().toHexString(),
      type: 'internal',
      name: 'Reedito Explore',
      description: 'Internal Integration for the Reedito Explore directory',
      slug: 'ghost-explore',
      created_at: knex.raw('current_timestamp'),
      created_by: MIGRATION_USER,
    });
  },
  async function down(knex) {
    logging.info('Deleting Reedito Explore Integration');

    await knex('integrations')
      .where({
        type: 'internal',
        name: 'Reedito Explore',
        slug: 'ghost-explore',
      })
      .del();
  },
);
