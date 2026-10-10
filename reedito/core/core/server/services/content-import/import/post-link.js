"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlForImportedPost = urlForImportedPost;
function urlForImportedPost(post, options) {
    const data = post.toJSON();
    if (data.status === 'draft') {
        const editorType = data.type === 'page' ? 'page' : 'post';
        return new URL(`#/editor/${editorType}/${post.id}`, options.adminUrl).href;
    }
    return options.publishedUrl(post);
}
