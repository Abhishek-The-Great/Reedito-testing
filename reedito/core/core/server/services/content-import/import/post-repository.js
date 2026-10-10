"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookshelfPostsRepository = void 0;
const relations_1 = require("./relations");
class BookshelfPostsRepository {
    _models;
    _relations;
    constructor(models, relations = new relations_1.BookshelfPostRelationsResolver(models)) {
        this._models = models;
        this._relations = relations;
    }
    write(data, options, metadata = {}) {
        return this._models.Base.transaction(async (transacting) => {
            const writeOptions = { ...options, transacting };
            const lookupOptions = {
                ...writeOptions,
                forUpdate: true,
                ...(metadata.runTagName ? { withRelated: ['tags'] } : {}),
            };
            let existingMatch;
            if (data.comment_id) {
                const existing = await this._models.Post.findOne({ comment_id: data.comment_id, status: 'all' }, lookupOptions);
                if (existing) {
                    existingMatch = {
                        post: existing,
                        duplicateReason: `A post with the source ID "${data.comment_id}" already exists.`,
                        matchedBy: 'source_id',
                    };
                }
            }
            if (!existingMatch) {
                const existing = await this._models.Post.findOne({ slug: data.slug, status: 'all' }, lookupOptions);
                if (existing) {
                    existingMatch = {
                        post: existing,
                        duplicateReason: `A post with the slug "${data.slug}" already exists.`,
                        matchedBy: 'slug',
                    };
                }
            }
            if (existingMatch) {
                const { post: existing, duplicateReason, matchedBy } = existingMatch;
                const duplicate = {
                    origin: hasRunTag(existing, metadata.runTagName) ? 'this_import' : 'pre_existing',
                    matchedBy,
                };
                if (!metadata.sourceUpdatedAt) {
                    return { status: 'skipped', reason: duplicateReason, duplicate };
                }
                const incomingInstant = new Date(metadata.sourceUpdatedAt).getTime();
                const storedUpdatedAt = existing.toJSON().updated_at;
                const storedInstant = storedUpdatedAt
                    ? new Date(storedUpdatedAt).getTime()
                    : undefined;
                if (Number.isNaN(incomingInstant) ||
                    (storedInstant !== undefined && incomingInstant <= storedInstant)) {
                    return {
                        status: 'skipped',
                        reason: 'The existing post is newer than or as recent as the imported row.',
                        duplicate,
                    };
                }
                // Reedito's collision plugin treats updated_at as the client's version token.
                // First update the content against the locked server version, then persist
                // the incoming source timestamp on its own. The second edit is safe because
                // timestamp-only importing edits are excluded from collision detection.
                const resolved = await this._relations.resolve(data, metadata, writeOptions);
                const collisionSafeData = { ...resolved.data };
                if (storedUpdatedAt) {
                    collisionSafeData.updated_at = storedUpdatedAt;
                }
                else {
                    delete collisionSafeData.updated_at;
                }
                const editOptions = {
                    ...writeOptions,
                    id: existing.id,
                };
                await this._models.Post.edit(collisionSafeData, { ...editOptions });
                const post = await this._models.Post.edit({ updated_at: metadata.sourceUpdatedAt }, { ...editOptions });
                return { status: 'updated', post, warnings: resolved.warnings };
            }
            const resolved = await this._relations.resolve(data, metadata, writeOptions);
            const post = await this._models.Post.add(resolved.data, writeOptions);
            return { status: 'created', post, warnings: resolved.warnings };
        });
    }
}
exports.BookshelfPostsRepository = BookshelfPostsRepository;
function hasRunTag(post, runTagName) {
    if (!runTagName) {
        return false;
    }
    const tags = post.toJSON().tags;
    return (Array.isArray(tags) &&
        tags.some((tag) => typeof tag === 'object' &&
            tag !== null &&
            'name' in tag &&
            tag.name === runTagName));
}
