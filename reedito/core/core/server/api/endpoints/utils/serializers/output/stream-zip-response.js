"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createZipStreamResponse = createZipStreamResponse;
const stream_response_1 = require("./stream-response");
/**
 * Builds the `frame.response` handler for a streaming zip download — the
 * shared header/piping wiring lives in `stream-response`.
 */
function createZipStreamResponse({ source, filename }) {
    return (0, stream_response_1.createStreamResponse)({
        source,
        filename,
        contentType: 'application/zip',
        missingFilenameMessage: 'Missing zip export filename',
    });
}
