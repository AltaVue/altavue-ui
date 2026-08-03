# @comet/ui

Shared internal UI for the AltaVue platform. One copy of the common components,
imported by every module — so a fix is made once here instead of in nine repos.

Contents:

1. the **field-level tooltip help system** (piloted in Tracker, packaged from
   Agile) — v0.1.0
2. the **comments and @mentions** components — v0.2.0

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


## Comments and @mentions (v0.2.0)

`CommentThread` is the discussion attached to one record. `CommentComposer` is
the rich-text box on its own. `validateCommentDoc` is the security boundary.

> Plain version: this is the shared "comment box" used across AltaVue. It knows
> how comments look and behave; it does not know anything about the database.
> Each app passes in the comments and supplies the save handlers.

### Why the components take data instead of fetching it

`@comet/ui` has no Supabase dependency and must not acquire one — each app wires
up authentication its own way, and a shared component that reached for a database
client would have to know about all of them. So the module owns the data and the
shared component owns the behaviour, exactly as `FieldHelpProvider` works.

In practice each app writes one thin wrapper (perhaps 80 lines) that calls its
own server actions and renders `<CommentThread>`.

### The security model

A comment travels as a structured TipTap document, never as HTML.

1. **On the way in**, the server action calls `validateCommentDoc`, which walks
   the document and rebuilds it from an allow-list of node types, mark types, and
   attributes. Link targets must match `^https?://`. Anything unrecognised is
   dropped, not "cleaned".
2. **On the way out**, `CommentBody` renders that JSON as React elements. There
   is no `dangerouslySetInnerHTML` anywhere in this package.

That pairing is why AltaVue needs no HTML sanitiser library: untrusted markup
never exists in the first place. It is the same model
`comet-customer-portal/src/components/KbMarkdown.tsx` already uses.

`validateCommentDoc` has no React and no browser dependency, so it runs in Node
inside a server action. **Always call it on the server.** A check in the browser
is a convenience, not a control.

`src/comments/doc.test.ts` holds the adversarial test cases — `javascript:` and
`data:` links, unknown nodes and marks, `onclick` attributes, forged mention ids,
control characters, and depth/node/length bombs. Run it with
`npx tsx src/comments/doc.test.ts` after any change to the allow-lists.

### Usage

```tsx
'use client'
import { CommentThread, type CommentRecord } from '@comet/ui'

<CommentThread
  comments={comments}                 // CommentRecord[] you loaded
  currentUserId={userId}
  currentUserIsAdmin={isAdmin}
  enabled={commentsEnabled}           // false renders NOTHING, not an error
  onSubmit={(doc, text, parentId) => postComment({ doc, text, parentId })}
  onEdit={(id, doc, text) => editComment({ id, doc, text })}
  onDelete={(id) => deleteComment(id)}
  onSearchMentions={(query) => searchMentions(projectId, query)}
/>
```

`enabled={false}` rendering nothing is deliberate: it lets the thread be dropped
into a screen before that surface has been registered for comments in the
database, so rollout happens one module at a time with no code changes.

### What the editor produces

Bold, italic, strikethrough, inline code, bullet and numbered lists, links,
block quotes, code blocks, emoji, and @mentions — and nothing else. Headings,
horizontal rules, and underline are switched off on purpose, and the editor's
configuration matches the validator's allow-list exactly, so nothing a person
types is silently discarded on save.

**No attachments.** AltaVue already has two attachment mechanisms; a third would
be a maintenance liability.

### On @mentions

Only people who hold an AltaVue login can be mentioned. External stakeholders
without a user account are neither mentionable nor emailed. `onSearchMentions`
should call the server, which should serve the list from a database function
rather than querying `profiles` from the browser.

### A note on cmdk

The mention picker is deliberately **not** built on cmdk, even though cmdk is
available in Tracker. cmdk takes keyboard focus to run its own filtering, but a
mention picker must leave the caret in the editor, because the person is still
typing. `MentionList` instead receives arrow and Enter keys forwarded from the
editor through TipTap's `onKeyDown`, which is how the suggestion plugin is meant
to be used. It is styled to match the command palette.

### Extra theme tokens used by the comment components

On top of the tooltip contract above:

- `--color-surface`, `--color-background` — the composer and popover backgrounds
- `--color-muted` — inline code, code blocks, hover states
- `--color-border`, `--color-border-strong` — outlines and quote bars
- `--color-text`, `--color-text-muted`, `--color-text-subtle` — text hierarchy
- `--color-accent`, `--color-accent-text` — the Comment button and mention chips
- `--color-danger` — the delete confirmation

Every current module defines these in `app/globals.css`.

## Requirements

Peer dependencies (already present in every module): `react` 19+,
`react-dom` 19+, `radix-ui` 1.4+.

Real dependencies added in v0.2.0, installed automatically with the package:
`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/pm`.
TipTap 3's StarterKit already contains Link, so no separate link extension is
installed. The package still ships raw TypeScript with no build step — consumers
keep `transpilePackages: ['@comet/ui']`.

## Versioning

For now modules track `#main`. When a second module adopts the package, switch
to git tags (`#v0.1.0`, `#v0.2.0`, …) so each module updates on its own schedule
and nothing drifts unexpectedly. Bump `version` in `package.json` and create the
matching tag when you publish a change.
