"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbDate = exports.fromDatabaseDate = exports.toDatabaseDate = void 0;
const luxon_1 = require("luxon");
const errors = __importStar(require("@tryghost/errors"));
const zod_1 = require("zod");
const DATABASE_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const databaseDateInput = zod_1.z.union([zod_1.z.date(), zod_1.z.string(), zod_1.z.number()]);
const parseDatabaseDateString = (value) => {
    const sql = luxon_1.DateTime.fromSQL(value, { zone: 'utc' });
    return sql.isValid ? sql : luxon_1.DateTime.fromISO(value, { zone: 'utc' });
};
const parseDatabaseDate = (date) => {
    const input = databaseDateInput.safeParse(date);
    if (!input.success) {
        throw new errors.InternalServerError({ message: 'Invalid database date' });
    }
    let parsed;
    if (typeof input.data === 'string') {
        parsed = parseDatabaseDateString(input.data);
    }
    else if (typeof input.data === 'number') {
        parsed = luxon_1.DateTime.fromMillis(input.data, { zone: 'utc' });
    }
    else {
        parsed = luxon_1.DateTime.fromJSDate(input.data, { zone: 'utc' });
    }
    if (!parsed.isValid) {
        throw new errors.InternalServerError({ message: 'Invalid database date' });
    }
    return parsed;
};
// Raw Knex queries need this UTC datetime format for consistent MySQL and SQLite behavior.
const toDatabaseDate = (date) => parseDatabaseDate(date).toFormat(DATABASE_DATE_FORMAT);
exports.toDatabaseDate = toDatabaseDate;
const fromDatabaseDate = (date) => parseDatabaseDate(date).toJSDate();
exports.fromDatabaseDate = fromDatabaseDate;
// A zod codec for datetime columns: MySQL returns a Date, SQLite a string/number;
// normalise to a Date on read and pass a Date through on write.
// On SQLite, Knex binds the Date that DbDate passes through as epoch milliseconds (stored as
// INTEGER) while toDatabaseDate writes TEXT; SQLite orders INTEGER before TEXT, so never compare
// or order those two representations.
exports.DbDate = zod_1.z.codec(databaseDateInput, zod_1.z.date(), {
    decode: exports.fromDatabaseDate,
    encode: (date) => date,
});
