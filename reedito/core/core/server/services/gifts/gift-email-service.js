"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftEmailService = void 0;
const gift_email_renderer_1 = require("./gift-email-renderer");
const color_utils_1 = require("@tryghost/color-utils");
const errors_1 = __importDefault(require("@tryghost/errors"));
const mailgun_message_id_1 = require("../lib/mailgun-message-id");
const constants_1 = require("./constants");
const gift_date_1 = require("./gift-date");
const DEFAULT_ACCENT_COLOR = '#15212A';
class GiftEmailService {
    transactionalMailer;
    config;
    bulkMailer;
    settingsCache;
    urlUtils;
    getFromAddress;
    getReplyToAddress;
    blogIcon;
    renderer;
    t;
    constructor({ config, transactionalMailer, bulkMailer, settingsCache, urlUtils, getFromAddress, getReplyToAddress, blogIcon, t, }) {
        this.config = config;
        this.transactionalMailer = transactionalMailer;
        this.bulkMailer = bulkMailer;
        this.settingsCache = settingsCache;
        this.urlUtils = urlUtils;
        this.getFromAddress = getFromAddress;
        this.getReplyToAddress = getReplyToAddress;
        this.blogIcon = blogIcon;
        this.t = t;
        this.renderer = new gift_email_renderer_1.GiftEmailRenderer({ t });
    }
    get siteDomain() {
        try {
            return new URL(this.urlUtils.getSiteUrl()).hostname;
        }
        catch {
            return '';
        }
    }
    get accentColor() {
        return this.settingsCache.get('accent_color') || DEFAULT_ACCENT_COLOR;
    }
    mixAccentColor(target, accentWeight, fallback) {
        try {
            return (0, color_utils_1.Color)(target).mix((0, color_utils_1.Color)(this.accentColor), accentWeight).hex().toLowerCase();
        }
        catch {
            return fallback;
        }
    }
    get accentTint() {
        return this.mixAccentColor('#FFFFFF', 0.07, '#F4F5F6');
    }
    get accentShade() {
        return this.mixAccentColor('#15212A', 0.72, '#738A94');
    }
    formatDate(date) {
        return (0, gift_date_1.formatGiftDate)(date, {
            locale: this.settingsCache.get('locale'),
            timeZone: this.settingsCache.get('timezone'),
        });
    }
    async sendPurchaseConfirmation({ buyerEmail, token, tierName, cadence, duration, expiresAt, scheduledAt, recipientEmail = null, }) {
        const siteDomain = this.siteDomain;
        const siteUrl = this.urlUtils.getSiteUrl();
        const siteTitle = this.settingsCache.get('title') ?? siteDomain;
        const giftLink = `${siteUrl.replace(/\/$/, '')}/gift/${token}`;
        const scheduled = Boolean(recipientEmail) && scheduledAt && scheduledAt.getTime() > Date.now();
        const deliveryDate = scheduled ? this.formatDate(scheduledAt) : null;
        const { html, text } = await this.renderer.renderPurchaseConfirmation({
            siteTitle,
            siteUrl,
            siteIconUrl: this.blogIcon.getIconUrl({ absolute: true, fallbackToDefault: false }),
            siteDomain,
            accentColor: this.settingsCache.get('accent_color'),
            toEmail: buyerEmail,
            gift: {
                tierName,
                duration,
                isMonthly: cadence === 'month',
                link: giftLink,
                expiresAt: this.formatDate(expiresAt),
                recipientEmail,
                deliveryDate,
            },
        });
        await this.transactionalMailer.send({
            to: buyerEmail,
            subject: scheduled
                ? this.t('Your gift will be sent on {deliveryDate}', {
                    deliveryDate,
                    interpolation: { escapeValue: false },
                })
                : recipientEmail
                    ? this.t('Your gift is on its way')
                    : this.t('Your gift is ready'),
            html,
            text,
            from: this.getFromAddress(),
            replyTo: this.getReplyToAddress(),
            forceTextContent: true,
            disableTracking: true,
        });
    }
    async sendGiftSentConfirmation(data) {
        await this.sendBuyerNotice(data, {
            subject: this.t('Your gift has been sent'),
            render: (payload) => this.renderer.renderSentConfirmation(payload),
        });
    }
    async sendDeliveryFailureNotification(data) {
        await this.sendBuyerNotice(data, {
            subject: this.t("We couldn't deliver your gift"),
            render: (payload) => this.renderer.renderDeliveryFailure(payload),
        });
    }
    async sendBuyerNotice({ buyerEmail, recipientEmail, token, expiresAt }, { subject, render, }) {
        const siteDomain = this.siteDomain;
        const siteUrl = this.urlUtils.getSiteUrl();
        const siteTitle = this.settingsCache.get('title') ?? siteDomain;
        const giftLink = `${siteUrl.replace(/\/$/, '')}/gift/${token}`;
        const { html, text } = await render({
            siteTitle,
            siteUrl,
            siteIconUrl: this.blogIcon.getIconUrl({ absolute: true, fallbackToDefault: false }),
            siteDomain,
            toEmail: buyerEmail,
            gift: {
                link: giftLink,
                expiresAt: this.formatDate(expiresAt),
                recipientEmail,
            },
        });
        await this.transactionalMailer.send({
            to: buyerEmail,
            subject,
            html,
            text,
            from: this.getFromAddress(),
            replyTo: this.getReplyToAddress(),
            forceTextContent: true,
            disableTracking: true,
        });
    }
    async sendReminder({ memberEmail, memberName, tierName, consumesAt, }) {
        const siteDomain = this.siteDomain;
        const siteUrl = this.urlUtils.getSiteUrl();
        const siteTitle = this.settingsCache.get('title') ?? siteDomain;
        const manageSubscriptionUrl = new URL('#/portal/account', siteUrl).href;
        const firstName = memberName?.trim().split(/\s+/)[0] || null;
        const { html, text } = await this.renderer.renderReminder({
            siteTitle,
            siteUrl,
            siteIconUrl: this.blogIcon.getIconUrl({ absolute: true, fallbackToDefault: false }),
            siteDomain,
            accentColor: this.settingsCache.get('accent_color'),
            memberEmail,
            firstName,
            gift: {
                tierName,
                consumesAt: this.formatDate(consumesAt),
                manageSubscriptionUrl,
            },
        });
        await this.transactionalMailer.send({
            to: memberEmail,
            subject: this.t('Your gift subscription is ending soon'),
            html,
            text,
            from: this.getFromAddress(),
            replyTo: this.getReplyToAddress(),
            forceTextContent: true,
        });
    }
    async sendGiftDelivery({ recipientEmail, recipientName, buyerEmail, buyerName, personalMessage, token, tierName, benefits, cadence, duration, expiresAt, }) {
        const siteDomain = this.siteDomain;
        const siteUrl = this.urlUtils.getSiteUrl();
        const siteTitle = this.settingsCache.get('title') ?? siteDomain;
        const giftLink = `${siteUrl.replace(/\/$/, '')}/gift/${token}`;
        const { html, text } = await this.renderer.renderDelivery({
            siteTitle,
            siteIconUrl: this.blogIcon.getIconUrl({ absolute: true, fallbackToDefault: false }),
            siteDomain,
            accentColor: this.accentColor,
            accentTint: this.accentTint,
            accentShade: this.accentShade,
            toEmail: recipientEmail,
            buyerEmail,
            buyerName,
            recipientName,
            personalMessage,
            gift: {
                tierName,
                benefits,
                duration,
                isMonthly: cadence === 'month',
                link: giftLink,
                expiresAt: this.formatDate(expiresAt),
            },
        });
        const subject = this.t('{buyerName} sent you a gift', {
            buyerName,
            interpolation: { escapeValue: false },
        });
        const tags = [constants_1.GIFT_DELIVERY_EMAIL_TAG];
        const mailgunTagFromConfig = this.config.get('bulkEmail:mailgun:tag');
        if (typeof mailgunTagFromConfig === 'string' && mailgunTagFromConfig.length > 0) {
            tags.push(mailgunTagFromConfig);
        }
        if (!this.bulkMailer.isConfigured()) {
            await this.transactionalMailer.send({
                to: recipientEmail,
                subject,
                html,
                text,
                from: this.getFromAddress(),
                replyTo: this.getReplyToAddress(),
                forceTextContent: true,
                tags,
                disableTracking: true,
            });
            return { providerMessageId: null };
        }
        const response = await this.bulkMailer.send({
            subject,
            html,
            plaintext: text,
            from: this.getFromAddress(),
            replyTo: this.getReplyToAddress(),
            tags,
            disable_tracking: true,
        }, { [recipientEmail]: {} }, []);
        const providerMessageId = (0, mailgun_message_id_1.getMailgunMessageId)(response) ?? null;
        if (!providerMessageId) {
            throw new errors_1.default.EmailError({
                message: 'Bulk Mailgun did not accept gift delivery',
                code: 'EMAIL_NOT_ACCEPTED',
            });
        }
        return { providerMessageId };
    }
}
exports.GiftEmailService = GiftEmailService;
