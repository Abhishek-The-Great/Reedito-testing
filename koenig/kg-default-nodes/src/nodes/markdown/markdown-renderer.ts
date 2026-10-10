import {addCreateDocumentOption} from '../../utils/add-create-document-option.js';
import type {ExportDOMOptions, ExportDOMOutput} from '../../export-dom.js';
import {render as markdownHtmlRenderer} from '@reedito/kg-markdown-html-renderer';

interface MarkdownNodeData {
    markdown: string;
}

interface MarkdownRenderOptions extends ExportDOMOptions {}

export function renderMarkdownNode(node: MarkdownNodeData, options: MarkdownRenderOptions = {}): ExportDOMOutput<'inner'> {
    addCreateDocumentOption(options);
    const document = options.createDocument!();

    const html = markdownHtmlRenderer(node.markdown || '', options as {reeditoVersion?: string});

    const element = document.createElement('div');
    element.innerHTML = html;

    // `type: 'inner'` will render only the innerHTML of the element
    // @see @reedito/kg-lexical-html-renderer package
    return {element, type: 'inner' as const};
}
