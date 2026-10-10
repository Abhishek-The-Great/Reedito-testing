const _ = require('lodash');
const bookshelf = require('bookshelf');
const ObjectId = require('bson-objectid').default;
const plugins = require('@tryghost/bookshelf-plugins');

const db = require('../../data/db');

// ### reeditoBookshelf
// Initializes a new Bookshelf instance called reeditoBookshelf, for reference elsewhere in Reedito.
const reeditoBookshelf = bookshelf(db.knex);

reeditoBookshelf.plugin(plugins.eagerLoad);

// Add committed/rollback events.
reeditoBookshelf.plugin(plugins.transactionEvents);

// Load the Reedito custom-query plugin, which applying a custom query to findPage requests
reeditoBookshelf.plugin(plugins.customQuery);

// Load the Reedito filter plugin, which handles applying a 'filter' to findPage requests
reeditoBookshelf.plugin(plugins.filter);

// Load the Reedito filter plugin, which handles applying a 'order' to findPage requests
reeditoBookshelf.plugin(plugins.order);

// Load the Reedito search plugin, which handles applying a search query to findPage requests
reeditoBookshelf.plugin(plugins.search);

// Load the Reedito include count plugin, which allows for the inclusion of cross-table counts
reeditoBookshelf.plugin(plugins.includeCount);

// Load the Reedito pagination plugin, which gives us the `fetchPage` method on Models
reeditoBookshelf.plugin(plugins.pagination);

// Update collision plugin
reeditoBookshelf.plugin(plugins.collision);

// Load hasPosts plugin for authors models
reeditoBookshelf.plugin(plugins.hasPosts);

reeditoBookshelf.plugin(require('./plugins/crud'));

reeditoBookshelf.plugin(require('./plugins/actions'));

reeditoBookshelf.plugin(require('./plugins/events'));

reeditoBookshelf.plugin(require('./plugins/raw-knex'));

reeditoBookshelf.plugin(require('./plugins/sanitize'));

reeditoBookshelf.plugin(require('./plugins/generate-slug'));

reeditoBookshelf.plugin(require('./plugins/bulk-operations'));

reeditoBookshelf.plugin(require('./plugins/filtered-collection'));

reeditoBookshelf.plugin(require('./plugins/user-type'), {
  resolveIntegrationUserId: function resolveIntegrationUserId(options) {
    return reeditoBookshelf.model('User').getOwnerId(options);
  },
  resolveInternalUserId: function resolveInternalUserId(options) {
    return reeditoBookshelf.model('User').getOwnerId(options);
  },
});

reeditoBookshelf.plugin(require('./plugins/data-manipulation'));

reeditoBookshelf.plugin(require('./plugins/overrides'));

reeditoBookshelf.plugin(require('./plugins/relations'));

// Manages nested updates (relationships)
reeditoBookshelf.plugin('bookshelf-relations', {
  allowedOptions: ['context', 'importing', 'migrating'],
  unsetRelations: true,
  editRelations: false,
  extendChanged: '_changed',
  attachPreviousRelations: true,
  hooks: {
    belongsToMany: {
      after: function (existing, targets, options) {
        // reorder tags/authors
        const queryOptions = {
          query: {
            where: {},
          },
        };

        // CASE: disable after hook for specific relations
        if (
          ['permissions_roles', 'members_newsletters'].indexOf(
            existing.relatedData.joinTableName,
          ) !== -1
        ) {
          return Promise.resolve();
        }

        return Promise.all(
          targets.models.map((target, index) => {
            queryOptions.query.where[existing.relatedData.otherKey] = target.id;

            return existing.updatePivot(
              {
                sort_order: index,
              },
              _.extend({}, options, queryOptions),
            );
          }),
        );
      },
      beforeRelationCreation: function onCreatingRelation(model, data) {
        data.id = ObjectId().toHexString();
      },
    },
  },
});

module.exports = reeditoBookshelf;
