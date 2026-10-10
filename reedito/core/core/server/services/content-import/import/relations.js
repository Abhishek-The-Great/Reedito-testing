"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookshelfPostRelationsResolver = void 0;
exports.parseAuthorReferences = parseAuthorReferences;
exports.parseTagReferences = parseTagReferences;
const { slugify } = require('@tryghost/string');
const validator = require('@tryghost/validator');
function parseAuthorReferences(authorNames, authorEmails) {
    const names = splitList(authorNames);
    const emails = splitList(authorEmails);
    return Array.from({ length: Math.max(names.length, emails.length) }, (_, index) => ({
        ...(names[index] ? { name: names[index] } : {}),
        ...(emails[index] ? { email: emails[index] } : {}),
    }));
}
function parseTagReferences(tagNames) {
    return splitList(tagNames).filter((tag) => Boolean(tag));
}
class BookshelfPostRelationsResolver {
    _models;
    constructor(models) {
        this._models = models;
    }
    async resolve(data, source, options) {
        const { authors, warnings } = await this.resolveAuthors(source, options);
        const tags = await this.resolveTags(source, options);
        const resolved = {
            ...data,
            tags: [...tags, ...data.tags],
        };
        if (authors.length > 0) {
            resolved.authors = authors;
        }
        return { data: resolved, warnings };
    }
    async resolveAuthors(source, options) {
        const authors = [];
        const warnings = [];
        const seen = new Set();
        const authorsByEmail = new Map();
        let owner;
        const useOwner = async (warning) => {
            owner ??= await this._models.User.getOwnerUser({ ...options });
            warnings.push(warning);
            if (!seen.has(owner.id)) {
                seen.add(owner.id);
                authors.push({ id: owner.id });
            }
        };
        for (const reference of parseAuthorReferences(source.authorNames, source.authorEmails)) {
            let author = null;
            if (reference.email) {
                if (!validator.isEmail(reference.email)) {
                    await useOwner(`Author email "${reference.email}" is invalid; assigned Owner instead.`);
                    continue;
                }
                const emailKey = reference.email.toLowerCase();
                author = authorsByEmail.get(emailKey) ?? null;
                if (!author) {
                    author = (await this._models.User.getByEmail(emailKey, { ...options })) ?? null;
                }
                if (!author && reference.name) {
                    author = await this._models.User.add({
                        name: reference.name,
                        email: emailKey,
                        roles: ['Contributor'],
                    }, { ...options });
                }
                if (!author) {
                    await useOwner(`Author email "${reference.email}" has no name; assigned Owner instead.`);
                    continue;
                }
                authorsByEmail.set(emailKey, author);
            }
            else if (reference.name) {
                author = await this._models.User.findOne({ slug: slugify(reference.name) }, { ...options });
                if (!author) {
                    await useOwner(`Author "${reference.name}" has no email; assigned Owner instead.`);
                    continue;
                }
            }
            else {
                await useOwner('An empty author entry was assigned to Owner instead.');
                continue;
            }
            if (author && !seen.has(author.id)) {
                seen.add(author.id);
                authors.push({ id: author.id });
            }
        }
        return { authors, warnings };
    }
    async resolveTags(source, options) {
        const tags = [];
        const seen = new Set();
        for (const reference of parseTagReferences(source.tagNames)) {
            const normalizedSlug = slugify(reference);
            const lookups = [{ name: reference }, { slug: reference }];
            if (normalizedSlug && normalizedSlug !== reference) {
                lookups.push({ slug: normalizedSlug });
            }
            const findTag = async (lookupOptions = {}) => {
                for (const lookup of lookups) {
                    const tag = await this._models.Tag.findOne(lookup, {
                        ...options,
                        ...lookupOptions,
                    });
                    if (tag) {
                        return tag;
                    }
                }
                return null;
            };
            let tag = await findTag();
            if (!tag) {
                try {
                    tag = await this._models.Tag.add({ name: reference }, { ...options });
                }
                catch (error) {
                    if (!isUniqueConstraintError(error)) {
                        throw error;
                    }
                    // A concurrent row or import may have created the same slug after our
                    // lookup. A locking read sees that committed row under MySQL's default
                    // repeatable-read isolation, where another ordinary select may not.
                    tag = await findTag({ forUpdate: true });
                    if (!tag) {
                        throw error;
                    }
                }
            }
            if (!seen.has(tag.id)) {
                seen.add(tag.id);
                tags.push({ id: tag.id });
            }
        }
        return tags;
    }
}
exports.BookshelfPostRelationsResolver = BookshelfPostRelationsResolver;
function splitList(value) {
    return value?.split(',').map((part) => part.trim() || undefined) ?? [];
}
function isUniqueConstraintError(error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    return (code === 'ER_DUP_ENTRY' || (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')));
}
