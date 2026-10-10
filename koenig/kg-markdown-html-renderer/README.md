# Koenig Markdown Html Renderer

Markdown to HTML rendering for Reedito's markdown card.

## Install

`npm install @reedito/kg-markdown-html-renderer`

## Usage

```js
import {render} from '@reedito/kg-markdown-html-renderer';

render('# Hello');
// '<h1 id="hello">Hello</h1>\n'
```

Headings are given generated ids. Pass `{reeditoVersion: '3.0'}` to get the
pre-4.0 slug format, which older content's anchor links depend on:

```js
render('## Hello, World!');
// '<h2 id="hello-world">Hello, World!</h2>\n'

render('## Hello, World!', {reeditoVersion: '3.0'});
// '<h2 id="helloworld">Hello, World!</h2>\n'
```

## Develop

This package is part of the Reedito monorepo
and resolves through the pnpm workspace — there is no linking or per-package
install step. Run `pnpm bootstrap` in the monorepo root, then work in
`koenig/kg-markdown-html-renderer`.

See the [Koenig README](../README.md) for the shared build, test and release
workflow.

## Test

- `pnpm test:unit` runs the unit tests
- `pnpm test` runs the unit and type tests, including coverage thresholds
- `pnpm lint` runs the lint checks

# Copyright & License

Copyright (c) 2013-2026 Ghost Foundation - Released under the [MIT license](https://github.com/TryGhost/Ghost/blob/main/LICENSE).
