import {assertHTML, focusEditor, html, initialize, isMac, pasteText} from '../../utils/e2e';
import {expect, test} from '@playwright/test';

test.describe('Html Output Plugin', async function () {
    let page;

    test.beforeAll(async ({browser}) => {
        page = await browser.newPage();
    });

    test.beforeEach(async () => {
        await initialize({page, uri: '/#/html-output'});
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('can render html to editor', async function () {
        await focusEditor(page);

        await assertHTML(page, html`
            <p dir="ltr">
                <span data-lexical-text="true">check</span>
                <a href="https://example.com/changelog/markdown/" dir="ltr">
                    <span data-lexical-text="true">example.com/changelog/markdown/</span>
                </a>
            </p>
        `);
    });

    test('can parse editor state to html', async function () {
        const ctrl = isMac() ? 'Meta' : 'Control';
        await focusEditor(page);

        // check that default content renders to html
        await expect(await page.getByTestId('html-output').textContent()).toEqual('<p dir="ltr"><span style="white-space: pre-wrap;">check </span><a href="https://example.com/changelog/markdown/"><span style="white-space: pre-wrap;">example.com/changelog/markdown/</span></a></p>');

        // remove content
        await page.keyboard.press(`${ctrl}+KeyA`);
        await page.keyboard.press(`Delete`);

        await assertHTML(page, html`
            <p><br /></p>
        `);

        // paste link
        await pasteText(page, '<a href="https://example.com/changelog/markdown/">example.com/changelog/markdown/</a>', 'text/html');

        // check that link pasted successfully
        await assertHTML(page, html`
            <p>
                <a href="https://example.com/changelog/markdown/" dir="ltr">
                    <span style="white-space: pre-wrap;" data-lexical-text="true">example.com/changelog/markdown/</span>
                </a>
            </p>
        `);

        // check that link renders to html
        await expect(await page.getByTestId('html-output').textContent()).toEqual('<p dir="ltr"><a href="https://example.com/changelog/markdown/"><span style="white-space: pre-wrap;">example.com/changelog/markdown/</span></a></p>');
    });
});
