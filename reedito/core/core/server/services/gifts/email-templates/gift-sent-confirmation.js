"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderText = renderText;
const gift_buyer_notice_1 = require("./gift-buyer-notice");
function renderText(data, t) {
    return (0, gift_buyer_notice_1.renderBuyerNoticeText)(data, t, {
        heading: t('Your gift has been sent'),
        intro: t('Your gift was sent to {recipientEmail}. You can also share the link below yourself.', {
            recipientEmail: data.gift.recipientEmail,
            interpolation: { escapeValue: false },
        }),
    });
}
