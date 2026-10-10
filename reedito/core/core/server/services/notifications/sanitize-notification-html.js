"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeNotificationHtml = sanitizeNotificationHtml;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
// Notification bodies are rendered as HTML in Reedito Admin and notification
// emails. Keep the content semantic and exclude executable markup, event
// handlers, unsafe URLs, images and inline styles.
const ALLOWED_TAGS = [
    'p',
    'br',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'code',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
];
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];
const SANITIZE_OPTIONS = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowProtocolRelative: false,
    transformTags: {
        a: sanitize_html_1.default.simpleTransform('a', {
            target: '_blank',
            rel: 'noopener noreferrer',
        }),
    },
};
function sanitizeNotificationHtml(html) {
    return (0, sanitize_html_1.default)(html, SANITIZE_OPTIONS);
}
