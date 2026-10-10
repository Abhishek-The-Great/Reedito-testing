"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPANSIONS = void 0;
exports.routerTypeOf = routerTypeOf;
exports.buildFilter = buildFilter;
exports.filterMatches = filterMatches;
const nql_1 = __importDefault(require("@tryghost/nql"));
const logging_1 = __importDefault(require("@tryghost/logging"));
// NQL evaluation for routes.yaml collection filters, kept in one place so the
// forward lookup, ownership check and reverse lookup all decide membership the
// same way.
exports.EXPANSIONS = [
    { key: 'author', replacement: 'authors.slug' },
    { key: 'tags', replacement: 'tags.slug' },
    { key: 'tag', replacement: 'tags.slug' },
    { key: 'authors', replacement: 'authors.slug' },
    { key: 'primary_tag', replacement: 'primary_tag.slug' },
    { key: 'primary_author', replacement: 'primary_author.slug' },
];
const PAGE_TRANSFORMER = nql_1.default.utils.mapKeyValues({
    key: { from: 'page', to: 'type' },
    values: [
        { from: false, to: 'post' },
        { from: true, to: 'page' },
    ],
});
// Accepts both singular DB types ('post') and plural router keys ('posts').
const TYPE_TO_ROUTER_TYPE = {
    post: 'posts',
    posts: 'posts',
    page: 'pages',
    pages: 'pages',
    tag: 'tags',
    tags: 'tags',
    author: 'authors',
    authors: 'authors',
};
function routerTypeOf(resource) {
    if (!resource || !resource.type) {
        return null;
    }
    return TYPE_TO_ROUTER_TYPE[resource.type] || null;
}
function buildFilter(filter) {
    if (!filter) {
        return null;
    }
    return (0, nql_1.default)(filter, { expansions: exports.EXPANSIONS, transformer: PAGE_TRANSFORMER });
}
// A null filter always matches; anything that throws is a non-match, not an
// error.
//
// That covers malformed filters as well as odd records, because NQL parses
// lazily: `buildFilter` returns happily for a filter like `((`, and the parse
// error surfaces here on the first `queryJSON`. So this catch is the only
// thing standing between a bad routes.yaml filter and a site that cannot
// route — do not narrow it on the assumption that compilation already
// failed somewhere upstream. Pinned in router-filter.test.js.
function filterMatches(compiledFilter, record) {
    if (!compiledFilter) {
        return true;
    }
    try {
        return !!compiledFilter.queryJSON(record);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logging_1.default.warn('NQL match failed', message);
        return false;
    }
}
