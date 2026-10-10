"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rssController = rssController;
const lodash_1 = __importDefault(require("lodash"));
const node_url_1 = __importDefault(require("node:url"));
const debug = require('@tryghost/debug')('services:routing:controllers:rss');
const security = require('@tryghost/security');
const settingsCache = require('../../../../shared/settings-cache');
const rssService = require('../../rss');
const renderer = require('../../rendering');
const dataService = require('../../data');
/**
 * Generates the title for the RSS feed based on author, tag, or publication settings.
 */
function getTitle(relatedData) {
    const data = relatedData || {};
    let titleStart = lodash_1.default.get(data, 'author[0].name') || lodash_1.default.get(data, 'tag[0].name') || '';
    titleStart += titleStart ? ' - ' : '';
    return titleStart + settingsCache.get('title');
}
/**
 * RSS routing controller.
 * Fetches posts/meta data and delegates rendering to `rssService`.
 */
function rssController(req, res, next) {
    debug('rssController');
    const pathOptions = {
        page: 1, // required for fetchData
        slug: req.params.slug ? security.string.safe(req.params.slug) : undefined,
    };
    // CASE: Reedito is using an rss cache - normalize the URL for use as a key
    const baseUrl = node_url_1.default.parse(req.originalUrl).pathname;
    return dataService
        .fetchData(pathOptions, res.routerOptions, res.locals)
        .then(function formatResult(result) {
        const response = lodash_1.default.pick(result, ['posts', 'meta']);
        response.title = getTitle(result.data);
        response.description = settingsCache.get('description');
        return response;
    })
        .then(function (data) {
        return rssService.render(res, baseUrl, data);
    })
        .catch(renderer.handleError(next));
}
