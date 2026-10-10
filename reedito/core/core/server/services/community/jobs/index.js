const logging = require('@tryghost/logging');
const SendWeeklyReaderDigestsJob = require('./send-weekly-reader-digests-job').default;

let scheduled = false;

module.exports = {
  async scheduleWeeklyDigestsJob(jobsService) {
    if (scheduled || process.env.NODE_ENV?.startsWith('test')) {
      return;
    }

    const seconds = Math.floor(Math.random() * 60);
    const minutes = Math.floor(Math.random() * 60);
    const hour = Math.floor(Math.random() * 6);
    const cron = `${seconds} ${minutes} ${hour} * * 1`;

    logging.info(`[Background Job] weekly-reader-digest scheduled at ${cron}`);
    await jobsService.scheduleRecurring(new SendWeeklyReaderDigestsJob(), { cron });
    scheduled = true;
  },
};
