const { InternalServerError } = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const security = require('@tryghost/security');
const { default: ObjectID } = require('bson-objectid');
const { createTransactionalMigration } = require('../../utils');

const MIGRATION_USER = 1;

module.exports = createTransactionalMigration(
  async function up(knex) {
    logging.info('Adding Admin API key for Reedito Explore Integration');

    const integration = await knex('integrations')
      .where({
        slug: 'ghost-explore',
        name: 'Reedito Explore',
      })
      .first();

    if (!integration) {
      throw new InternalServerError({
        message: 'Could not find Reedito Explore Integration',
      });
    }

    const role = await knex('roles')
      .where({
        name: 'Reedito Explore Integration',
      })
      .first();

    if (!role) {
      throw new InternalServerError({
        message: 'Could not find Reedito Explore Integration Role',
      });
    }

    const existingKey = await knex('api_keys')
      .where({
        integration_id: integration.id,
        role_id: role.id,
      })
      .first();

    if (existingKey) {
      logging.warn('Admin API key already exists');
      return;
    }

    await knex('api_keys').insert({
      id: new ObjectID().toHexString(),
      type: 'admin',
      secret: security.secret.create('admin'),
      role_id: role.id,
      integration_id: integration.id,
      created_at: knex.raw('current_timestamp'),
      created_by: MIGRATION_USER,
    });
  },
  async function down(knex) {
    logging.info('Removing Reedito Explore API key');

    const integration = await knex('integrations')
      .where({
        slug: 'ghost-explore',
        type: 'internal',
        name: 'Reedito Explore',
      })
      .first();

    const role = await knex('roles')
      .where({
        name: 'Reedito Explore Integration',
      })
      .first();

    if (!role || !integration) {
      logging.warn('Could not delete API key');
      return;
    }

    logging.info('Deleting API Key');
    await knex('api_keys')
      .where({
        integration_id: integration.id,
        role_id: role.id,
      })
      .del();
  },
);
