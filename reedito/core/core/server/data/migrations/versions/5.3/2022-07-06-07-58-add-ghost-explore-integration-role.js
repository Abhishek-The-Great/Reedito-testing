const logging = require('@tryghost/logging');
const { default: ObjectID } = require('bson-objectid');
const { createTransactionalMigration } = require('../../utils');

const MIGRATION_USER = 1;

module.exports = createTransactionalMigration(
  async function up(knex) {
    logging.info('Creating "Reedito Explore Integration" role');
    const existingRole = await knex('roles')
      .where({
        name: 'Reedito Explore Integration',
      })
      .first();

    if (existingRole) {
      logging.warn('"Reedito Explore Integration" role already exists, skipping');
      return;
    }

    await knex('roles').insert({
      id: new ObjectID().toHexString(),
      name: 'Reedito Explore Integration',
      description: 'Internal Integration for the Reedito Explore directory',
      created_by: MIGRATION_USER,
      created_at: knex.raw('current_timestamp'),
    });
  },
  async function down(knex) {
    logging.info('Deleting role "Reedito Explore Integration"');
    await knex('roles')
      .where({
        name: 'Reedito Explore Integration',
      })
      .del();
  },
);
