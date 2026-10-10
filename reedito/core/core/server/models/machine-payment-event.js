const errors = require('@tryghost/errors');
const reeditoBookshelf = require('./base');

const MachinePaymentEvent = reeditoBookshelf.Model.extend(
  {
    tableName: 'machine_payment_events',
  },
  {
    async edit() {
      throw new errors.IncorrectUsageError({ message: 'Cannot edit MachinePaymentEvent' });
    },

    async destroy() {
      throw new errors.IncorrectUsageError({ message: 'Cannot destroy MachinePaymentEvent' });
    },
  },
);

module.exports = {
  MachinePaymentEvent: reeditoBookshelf.model('MachinePaymentEvent', MachinePaymentEvent),
};
