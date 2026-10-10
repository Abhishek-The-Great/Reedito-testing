import { Job } from '../../jobs-service/job';

export default class SendWeeklyReaderDigestsJob extends Job {
  static type = 'send-weekly-reader-digests';
}
