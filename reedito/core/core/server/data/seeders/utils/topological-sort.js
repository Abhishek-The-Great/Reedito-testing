"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.topologicalSort = topologicalSort;
const strict_1 = __importDefault(require("node:assert/strict"));
/**
 * This sorting algorithm is used to make sure that dependent tables are imported after their dependencies.
 */
function topologicalSort(objects) {
    // Create an empty result array to store the ordered objects
    const result = [];
    // Create a set to track visited objects during the DFS
    const visited = new Set();
    const objectsByName = new Map();
    for (const object of objects) {
        objectsByName.set(object.name, object);
    }
    // Helper function to perform DFS
    function dfs(name) {
        if (visited.has(name)) {
            return;
        }
        const object = objectsByName.get(name);
        (0, strict_1.default)(object, `Expected an object with name ${name}`);
        visited.add(name);
        for (const dependency of object.dependencies || []) {
            dfs(dependency);
        }
        result.push(object);
    }
    // Perform DFS on each object
    for (const object of objects) {
        dfs(object.name);
    }
    return result;
}
