"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCSVStreamResponse = createCSVStreamResponse;
const stream_response_1 = require("./stream-response");
/**
 * Builds the `frame.response` handler for a streaming CSV download — the
 * shared header/piping wiring lives in `stream-response`.
 */
function createCSVStreamResponse({ source, transform, filename }) {
    return (0, stream_response_1.createStreamResponse)({
        source,
        transform,
        filename,
        contentType: 'text/csv; charset=utf-8',
        missingFilenameMessage: 'Missing CSV export filename',
    });
}
