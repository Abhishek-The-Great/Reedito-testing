"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = parse;
const node_stream_1 = require("node:stream");
const papaparse_1 = __importDefault(require("papaparse"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// A column named after an Object.prototype member (toString, __proto__, ...) is unsafe
// as a key: writing it would shadow a method or reach the prototype.
function isSafeColumnName(name) {
    return !(name in Object.prototype);
}
// headerMapping renames the CSV's headers to the columns they emit under; unmapped
// columns carry through under their own name, and one mapped to an empty target is
// dropped.
function parse(path, headerMapping) {
    return new Promise(function (resolve, reject) {
        const csvFileStream = fs_extra_1.default.createReadStream(path);
        const csvParserStream = papaparse_1.default.parse(papaparse_1.default.NODE_STREAM_INPUT, {
            header: true,
        });
        const rows = [];
        const parsedCSVStream = (0, node_stream_1.pipeline)(csvFileStream, csvParserStream, (err) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
        parsedCSVStream.on('data', (parsedRow) => {
            // a throw here escapes as an uncaught exception and leaves this
            // promise forever unsettled, so it has to become a rejection
            try {
                const row = {};
                for (const [header, value] of Object.entries(parsedRow)) {
                    // papaparse gathers the overflow from a row carrying more
                    // fields than there are headers under __parsed_extra, as an
                    // array rather than a cell any mapping can name
                    if (typeof value !== 'string') {
                        continue;
                    }
                    // hasOwn, not `in`: a prototype-named header would otherwise match an
                    // inherited method on the mapping and take a function as its mapped name.
                    if (headerMapping && Object.hasOwn(headerMapping, header)) {
                        if (!headerMapping[header]) {
                            continue;
                        }
                        row[headerMapping[header]] = value;
                    }
                    else if (isSafeColumnName(header)) {
                        row[header] = value;
                    }
                }
                if (!Object.keys(row).length) {
                    return;
                }
                rows.push(row);
            }
            catch (err) {
                reject(err);
            }
        });
    });
}
