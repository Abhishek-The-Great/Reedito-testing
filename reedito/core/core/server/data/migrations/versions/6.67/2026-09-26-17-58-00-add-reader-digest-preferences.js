const { addTable } = require('../../utils');

module.exports = addTable('reader_digest_preferences', {
  member_id: {
    type: 'string',
    maxlength: 24,
    nullable: false,
    primary: true,
    references: 'members.id',
    cascadeDelete: true,
  },
  enabled: { type: 'boolean', nullable: false, defaultTo: false },
  last_sent_at: { type: 'dateTime', nullable: true },
  created_at: { type: 'dateTime', nullable: false },
  updated_at: { type: 'dateTime', nullable: false },
  '@@INDEXES@@': [['enabled', 'last_sent_at']],
});
