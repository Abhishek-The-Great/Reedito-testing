"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderText = renderText;
const gift_buyer_notice_1 = require("./gift-buyer-notice");
function renderText(data, t) {
    return (0, gift_buyer_notice_1.renderBuyerNoticeText)(data, t, {
        heading: t("We couldn't deliver your gift"),
        intro: t("We couldn't deliver your gift to {recipientEmail}. Send them the gift link below so they can redeem it.", {
            recipientEmail: data.gift.recipientEmail,
            interpolation: { escapeValue: false },
        }),
    });
}
