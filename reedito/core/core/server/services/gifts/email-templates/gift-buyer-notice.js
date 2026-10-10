"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBuyerNoticeText = renderBuyerNoticeText;
function renderBuyerNoticeText(data, t, { heading, intro }) {
    return `${heading}

${intro}

${data.gift.link}

${t('The link expires on {expiresAt} and can only be redeemed once.', {
        expiresAt: data.gift.expiresAt,
        interpolation: { escapeValue: false },
    })}

---
${t('This message was sent from {siteDomain} to {email}.', {
        siteDomain: data.siteDomain,
        email: data.toEmail,
        interpolation: { escapeValue: false },
    })}`;
}
