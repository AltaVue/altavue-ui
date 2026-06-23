# @comet/ui

Shared internal UI for the COMET platform. One copy of the common components,
imported by every module — so a fix is made once here instead of in nine repos.

First contents: the **field-level tooltip help system** (piloted in Tracker,
packaged from Agile).

> Plain version: this is the single home for the little help-tooltip components.
> Each app still keeps its own help *text* (its `data/tooltip-glossary.json`);
> only the components live here.

## What it exports

- `FieldHelp` — wraps any label/column-header text; shows a help tooltip on
  hover/focus when the glossary has an entry for the field id.
- `FieldLabel` — drop-in replacement for a form `<Label>` that adds the help.
- `FieldHelpProvider` — supplies a module's glossary to the components.
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` — the Radix
  tooltip primitives, themed for COMET.
- `Label` — the shadcn-style label the components build on.
- `FieldHelpEntry` — the glossary entry type.

## How a module adopts it

1. **Add the dependency** (in the module's `package.json`):

   ```json
   "@comet/ui": "github:mmcdaniel-saber/comet-ui#main"
   ```

   (Pin to a tag like `#v0.1.0` once you start cutting releases — see
   "Versioning" below.)

2. **Transpile it** — in `next.config.ts`:

   ```ts
   const nextConfig: NextConfig = {
     transpilePackages: ['@comet/ui'],
     // ...rest
   }
   ```

   The package ships TypeScript source (no build step); Next compiles it.

3. **Provide the glossary once**, high in the app (e.g. root `layout.tsx`):

   ```tsx
   import glossary from '@/data/tooltip-glossary.json'
   import { FieldHelpProvider, type FieldHelpEntry } from '@comet/ui'

   <FieldHelpProvider glossary={glossary as FieldHelpEntry[]}>
     {children}
   </FieldHelpProvider>
   ```

4. **Use the components** at any label/header:

   ```tsx
   import { FieldLabel, FieldHelp } from '@comet/ui'

   <FieldLabel fieldId="user_story.story_points">Story Points</FieldLabel>
   <th><FieldHelp fieldId="budget_weekly_cost.variance">Variance</FieldHelp></th>
   ```

   A module that already had local copies can instead point its existing
   `@/components/FieldHelp` and `@/components/ui/tooltip` files at this package
   (one-line re-exports) so none of its call sites change. That's how Agile
   adopted it.

## Theme contract

The tooltip styling uses CSS variables the consuming app must define (the
standard COMET aurora-glass tokens):

- `--color-text` — tooltip background (navy, e.g. `#0a1628`)
- `--color-text-subtle` — the dotted underline on hover/focus
- `--color-accent` — the keyboard focus ring (gold)

Every current module defines these in `app/globals.css`.

## Requirements

Peer dependencies (already present in every module): `react` 19+,
`react-dom` 19+, `radix-ui` 1.4+.

## Versioning

For now modules track `#main`. When a second module adopts the package, switch
to git tags (`#v0.1.0`, `#v0.2.0`, …) so each module updates on its own schedule
and nothing drifts unexpectedly. Bump `version` in `package.json` and create the
matching tag when you publish a change.
