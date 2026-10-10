---
name: Shade imports
description: Import Shade from layer-specific subpaths (primitives, components, patterns, page-templates, utils), never the root barrel. Trigger when editing TSX/TS in Shade-consuming apps.
autoTrigger:
  - fileEdit: "apps/{shade,admin,admin-x-framework,activitypub}/**/*.{ts,tsx}"
---

# Shade imports

Always import Shade from its **layer-specific subpath**. Never from the root barrel `@reedito/shade`.

## Correct

```ts
import {Stack, Inline, Box, Grid, Container, Text} from '@reedito/shade/primitives';
import {Button, Input, Dialog} from '@reedito/shade/components';
import {PageHeader, KpiCard, Filters} from '@reedito/shade/patterns';
import {ListPage} from '@reedito/shade/page-templates';
import {cn, formatNumber} from '@reedito/shade/utils';
import {ShadeApp} from '@reedito/shade/app';
```

**Note:** `ListPage` is in `@reedito/shade/page-templates`, not `/patterns`. Page templates are top-level page wrappers; patterns are the building blocks they compose.

## Incorrect

```ts
// BAD — root barrel
import {Button, Stack} from '@reedito/shade';

// BAD — deep path into source
import {Button} from '@reedito/shade/src/components/ui/button';
```

## Inside Shade itself

When editing files under `apps/shade/src/**`, use the `@/` alias for cross-file imports:

```ts
import {cn} from '@/lib/utils';
import {inputSurface} from '@/components/ui/input-surface';
```

## Why

Subpath imports make the layer (primitive/component/pattern) visible at the call site, which is the first piece of information a reader needs. The root barrel hides that and encourages cross-layer drift.
