"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryService = exports.service = exports.controller = void 0;
exports.init = init;
exports.recoverPendingDeliveries = recoverPendingDeliveries;
const gift_bookshelf_repository_1 = require("./gift-bookshelf-repository");
const gift_delivery_bookshelf_repository_1 = require("./gift-delivery-bookshelf-repository");
const gift_delivery_service_1 = require("./gift-delivery-service");
const gift_service_1 = require("./gift-service");
const signed_flush_scheduler_1 = require("../../adapters/scheduling/signed-flush-scheduler");
const gift_email_service_1 = require("./gift-email-service");
const gift_controller_1 = require("./gift-controller");
const send_gift_delivery_event_1 = require("./events/send-gift-delivery-event");
// Persistent scheduling adapters keep their queue across restarts and opt out
// of boot-time rebuilds (same contract post scheduling honours in boot.js).
let rescheduleDeliveriesOnBoot = true;
function init(options) {
    if (exports.service) {
        return;
    }
    const { Base: BaseModel, Gift: GiftModel, GiftDelivery: GiftDeliveryModel, MemberStripeCustomer: StripeCustomerModel, } = require('../../models');
    const GiftCheckoutAdapter = require('./gift-checkout-adapter');
    const membersService = require('../members');
    const tiersService = require('../tiers');
    const staffService = require('../staff');
    const DomainEvents = require('@tryghost/domain-events');
    const logging = require('@tryghost/logging');
    const { SubscriptionActivatedEvent } = require('../../../shared/events');
    const StartGiftReminderFlushEvent = require('./events/start-gift-reminder-flush-event');
    const { StartGiftDeliveryFlushEvent } = require('./events/start-gift-delivery-flush-event');
    const emailAnalyticsJobs = require('../email-analytics/jobs');
    const { ReeditoMailer } = require('../mail');
    const MailgunClient = require('../lib/mailgun-client');
    const config = require('../../../shared/config');
    const settingsCache = require('../../../shared/settings-cache');
    const urlUtils = require('../../../shared/url-utils').default;
    const settingsHelpers = require('../settings-helpers');
    const emailAddressParser = require('../email-address/email-address-parser');
    const { blogIcon } = require('../../../server/lib/image');
    const { t } = require('../i18n');
    const repository = new gift_bookshelf_repository_1.GiftBookshelfRepository({
        GiftModel,
        knex: BaseModel.knex,
    });
    const deliveryRepository = new gift_delivery_bookshelf_repository_1.GiftDeliveryBookshelfRepository({
        GiftDeliveryModel,
        knex: BaseModel.knex,
    });
    const checkoutAdapter = new GiftCheckoutAdapter({
        StripeCustomerModel,
        getStripeApi: () => require('../stripe').api,
    });
    const giftEmailService = new gift_email_service_1.GiftEmailService({
        config,
        transactionalMailer: new ReeditoMailer(),
        bulkMailer: new MailgunClient({ config, settings: settingsCache }),
        settingsCache,
        urlUtils,
        getFromAddress: () => emailAddressParser.stringify(settingsHelpers.getDefaultEmail()),
        getReplyToAddress: () => settingsHelpers.getMembersSupportAddress(),
        blogIcon,
        t,
    });
    const giftDeliveryScheduler = new signed_flush_scheduler_1.SignedFlushScheduler({
        apiUrl: options.apiUrl,
        adapter: options.schedulerAdapter,
        internalKeys: options.internalKeys,
        endpoint: ['gifts', 'flush_deliveries'],
        name: 'gift_delivery',
        findScheduledTimes: async () => {
            const scheduled = await deliveryRepository.findScheduledTimesForPurchasedGifts(new Date());
            return scheduled.map((scheduledAt) => scheduledAt.getTime());
        },
    });
    const giftDeliveryService = new gift_delivery_service_1.GiftDeliveryService({
        giftRepository: repository,
        giftDeliveryRepository: deliveryRepository,
        tiersService,
        giftEmailService,
        giftEmailAnalytics: {
            schedule: () => emailAnalyticsJobs.scheduleRecurringGiftDeliveriesJob(true),
        },
        giftDeliveryScheduler,
    });
    const giftReminderScheduler = new signed_flush_scheduler_1.SignedFlushScheduler({
        apiUrl: options.apiUrl,
        adapter: options.schedulerAdapter,
        internalKeys: options.internalKeys,
        endpoint: ['gifts', 'flush_reminders'],
        name: 'gift_reminder',
        legacyDelaysMs: [0],
        findScheduledTimes: async () => {
            const pending = await repository.findUnsentReminders();
            return pending
                .map((gift) => gift.reminderDueAt()?.getTime())
                .filter((time) => time !== undefined);
        },
    });
    const giftService = new gift_service_1.GiftService({
        giftRepository: repository,
        giftDeliveryService,
        get memberRepository() {
            return membersService.api.members;
        },
        tiersService,
        giftEmailService,
        get staffServiceEmails() {
            return staffService.api.emails;
        },
        giftReminderScheduler,
        checkoutAdapter,
        settingsCache,
    });
    exports.service = giftService;
    exports.deliveryService = giftDeliveryService;
    rescheduleDeliveriesOnBoot = Boolean(options.schedulerAdapter.rescheduleOnBoot);
    exports.controller = new gift_controller_1.GiftController({ service: giftService });
    DomainEvents.subscribe(SubscriptionActivatedEvent, async (event) => {
        try {
            await giftService.handlePaidSubscriptionActivation(event.data.memberId);
        }
        catch (err) {
            logging.error(err, 'Failed to consume gift on paid subscription activation');
        }
    });
    DomainEvents.subscribe(StartGiftReminderFlushEvent, async () => {
        const start = Date.now();
        logging.info('[Background Job] send-gift-reminders started');
        try {
            const { remindedCount, skippedCount, failedCount } = await giftService.processReminders();
            logging.info(`[Background Job] send-gift-reminders completed in ${Date.now() - start}ms: ${remindedCount} sent, ${skippedCount} not due, ${failedCount} rejected`);
        }
        catch (err) {
            logging.error(err, `[Background Job] send-gift-reminders failed after ${Date.now() - start}ms`);
        }
    });
    DomainEvents.subscribe(StartGiftDeliveryFlushEvent, async () => {
        const start = Date.now();
        try {
            const { sentCount, skippedCount, failedCount } = await giftDeliveryService.recoverPending();
            logging.info(`Processed ${sentCount} due gift deliveries, skipped ${skippedCount}, failed ${failedCount} in ${Date.now() - start}ms`);
        }
        catch (err) {
            logging.error(err, 'Failed to process due gift deliveries');
        }
    });
    DomainEvents.subscribe(send_gift_delivery_event_1.SendGiftDeliveryEvent, async (event) => {
        const start = Date.now();
        try {
            const result = await giftDeliveryService.send(event.data.deliveryId);
            logging.info(`Gift delivery ${event.data.deliveryId} ${result} in ${Date.now() - start}ms`);
        }
        catch (err) {
            logging.error(err, `Failed to process gift delivery ${event.data.deliveryId}`);
        }
    });
}
// Re-arms future deliveries and retries sends interrupted by a previous
// shutdown. Runs after all services initialise because recovery sends need
// tiers and members.
async function recoverPendingDeliveries() {
    if (!exports.deliveryService) {
        return;
    }
    const logging = require('@tryghost/logging');
    if (rescheduleDeliveriesOnBoot) {
        try {
            await exports.deliveryService.reschedulePending();
        }
        catch (err) {
            logging.error(err, 'Failed to reschedule pending gift deliveries');
        }
    }
    try {
        const { sentCount, skippedCount, failedCount } = await exports.deliveryService.recoverPending();
        if (sentCount + skippedCount + failedCount > 0) {
            logging.info(`Gift delivery recovery: ${sentCount} sent, ${skippedCount} skipped, ${failedCount} failed`);
        }
    }
    catch (err) {
        logging.error(err, 'Failed to recover pending gift deliveries');
    }
}
