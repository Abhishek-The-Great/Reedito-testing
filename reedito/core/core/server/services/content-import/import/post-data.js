"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RowSkipped = void 0;
exports.default = buildPostData;
const row_1 = require("./row");
const { slugify } = require('@tryghost/string');
// A malformed row, refused before any write was attempted; distinct from a write
// that failed, which the importer records separately.
class RowSkipped extends Error {
    constructor(reason) {
        super(reason);
        this.name = 'RowSkipped';
    }
}
exports.RowSkipped = RowSkipped;
const DIRECT_OPTIONAL_FIELDS = [
    'comment_id',
    'custom_excerpt',
    'feature_image',
    'canonical_url',
    'custom_template',
    'codeinjection_head',
    'codeinjection_foot',
];
const META_FIELDS = [
    'feature_image_alt',
    'feature_image_caption',
    'meta_title',
    'meta_description',
    'og_image',
    'og_title',
    'og_description',
    'twitter_image',
    'twitter_title',
    'twitter_description',
];
function buildPostData(row, htmlToLexical, importTagNames, markdownToHtml, cleanHTML) {
    const check = row_1.importableRowSchema.safeParse(row);
    if (!check.success) {
        throw new RowSkipped(check.error.issues[0].message);
    }
    const data = {
        title: row.title,
        // Slugified here with the standard rules: left to the model, the
        // importing-context slug pass keeps every punctuation dash
        // (slugify requiredChangesOnly).
        slug: slugify(row.slug ?? row.title),
        // Explicit rather than left to the model, which would default visibility
        // from the site setting. Never 'scheduled': the post scheduler has no
        // importing check.
        status: row.status ?? 'published',
        type: row.type ?? 'post',
        visibility: row.visibility ?? 'public',
        // The # prefix gives the batch tags internal visibility.
        tags: importTagNames.map((name) => ({ name })),
    };
    if (row.html && row.markdown) {
        throw new RowSkipped('html and markdown cannot both be provided');
    }
    let sourceHTML = row.html;
    let sourceKind = 'html';
    if (row.markdown) {
        if (!markdownToHtml) {
            throw new RowSkipped('markdown could not be converted');
        }
        try {
            sourceHTML = markdownToHtml(row.markdown);
            sourceKind = 'markdown';
        }
        catch {
            throw new RowSkipped('markdown could not be converted');
        }
    }
    if (sourceHTML) {
        let cleanedHTML = sourceHTML;
        if (cleanHTML) {
            try {
                cleanedHTML = cleanHTML({ html: sourceHTML, opinionated: true });
            }
            catch {
                throw new RowSkipped('html could not be cleaned');
            }
        }
        try {
            data.lexical = JSON.stringify(htmlToLexical(cleanedHTML));
        }
        catch {
            throw new RowSkipped(`${sourceKind} could not be converted`);
        }
    }
    for (const field of DIRECT_OPTIONAL_FIELDS) {
        if (row[field] !== undefined) {
            data[field] = row[field];
        }
    }
    if (row.featured !== undefined) {
        data.featured = toBoolean(row.featured);
    }
    if (row.show_title_and_feature_image !== undefined) {
        data.show_title_and_feature_image = toBoolean(row.show_title_and_feature_image);
    }
    // published_at remains the fallback timestamp for the whole post, while an
    // explicit created_at or updated_at wins for that individual field.
    if (row.published_at) {
        data.published_at = row.published_at;
    }
    if (row.created_at ?? row.published_at) {
        data.created_at = row.created_at ?? row.published_at;
    }
    if (row.updated_at ?? row.published_at) {
        data.updated_at = row.updated_at ?? row.published_at;
    }
    const postsMeta = {};
    for (const field of META_FIELDS) {
        if (row[field] !== undefined) {
            postsMeta[field] = row[field];
        }
    }
    if (Object.keys(postsMeta).length > 0) {
        data.posts_meta = postsMeta;
    }
    return data;
}
function toBoolean(value) {
    return value === '1' || value.toLowerCase() === 'true';
}
