"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.luck = void 0;
exports.randomDateBetween = randomDateBetween;
const faker_1 = require("@faker-js/faker");
const date_1 = require("../../../lib/db-types/date");
/**
 * Adds another degree of randomness into some decisions
 * @param lowerThan Only this % of people will achieve this luck
 * @returns Whether this person is lucky enough for the condition
 */
const luck = (lowerThan) => faker_1.faker.number.int({
    min: 1,
    max: 100,
}) <= lowerThan;
exports.luck = luck;
function randomDateBetween(start, end) {
    const earliest = (0, date_1.fromDatabaseDate)(start);
    const latest = (0, date_1.fromDatabaseDate)(end);
    return latest > earliest ? faker_1.faker.date.between({ from: earliest, to: latest }) : earliest;
}
