"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderText = renderText;
const gift_buyer_notice_1 = require("./gift-buyer-notice");
// Each translated sentence must stay intact; only the selection between them
// varies.
function renderIntro(data, t) {
    const gift = data.gift;
    const giftDescription = {
        duration: gift.duration,
        count: gift.duration,
        tierName: gift.tierName,
        siteTitle: data.siteTitle,
        interpolation: { escapeValue: false },
    };
    if (gift.recipientEmail && gift.deliveryDate) {
        const scheduled = {
            ...giftDescription,
            recipientEmail: gift.recipientEmail,
            deliveryDate: gift.deliveryDate,
        };
        return gift.isMonthly
            ? t('Thank you for your support. Your gift — a {duration}-month {tierName} membership to {siteTitle} — will be sent to {recipientEmail} on {deliveryDate}. You can also share the link below yourself.', scheduled)
            : t('Thank you for your support. Your gift — a {duration}-year {tierName} membership to {siteTitle} — will be sent to {recipientEmail} on {deliveryDate}. You can also share the link below yourself.', scheduled);
    }
    if (gift.recipientEmail) {
        const emailed = {
            ...giftDescription,
            recipientEmail: gift.recipientEmail,
        };
        return gift.isMonthly
            ? t('Thank you for your support. Your gift — a {duration}-month {tierName} membership to {siteTitle} — is on its way to {recipientEmail}. You can also share the link below yourself.', emailed)
            : t('Thank you for your support. Your gift — a {duration}-year {tierName} membership to {siteTitle} — is on its way to {recipientEmail}. You can also share the link below yourself.', emailed);
    }
    return gift.isMonthly
        ? t("Thank you for your support. Share the link below with whoever you'd like to gift them a {duration}-month {tierName} membership to {siteTitle}.", giftDescription)
        : t("Thank you for your support. Share the link below with whoever you'd like to gift them a {duration}-year {tierName} membership to {siteTitle}.", giftDescription);
}
function renderText(data, t) {
    const heading = data.gift.recipientEmail && data.gift.deliveryDate
        ? t('Your gift is scheduled')
        : data.gift.recipientEmail
            ? t('Your gift is on its way')
            : t('Your gift is ready');
    return (0, gift_buyer_notice_1.renderBuyerNoticeText)(data, t, { heading, intro: renderIntro(data, t) });
}
