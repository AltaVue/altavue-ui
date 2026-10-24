# @comet/ui

Shared internal UI for the AltaVue platform. One copy of the common components,
imported by every module — so a fix is made once here instead of in nine repos.

Contents:

1. the **field-level tooltip help system** (piloted in Tracker, packaged from
   Agile) — v0.1.0
2. the **comments and @mentions** components — v0.2.0
3. **`@comet/ui/dates`** — calendar days and moments in time (AO-2012) — v0.3.0
4. **`@comet/ui/finance`** — contract value and margin wording (AO-1999) — v0.3.0
5. **`@comet/ui/help`** — the tooltip help system on its own (item 1, without
   the comment editor) — v0.3.1
6. **`@comet/ui/topbar`** — THE AltaVue top bar, and **`@comet/ui/verify`**,
   the build check that keeps it from drifting (AO-2063) — v0.4.2 (v0.4.1: type file
   for `@comet/ui/verify`; v0.4.2: the bar stays pinned below the Dev/Staging
   ribbon and the search box clears on a new page)

> **Import the tooltips from `@comet/ui/help`, not from `@comet/ui`.** The root
> entry also carries the comment editor. In a webpack build, importing the root
> entry from a client component ships the whole editor (~430 KB) to every page,
> even if the module never shows a comment box — found in Agile during AO-2005.
> Use the root entry only in a module that actually renders comments.

Items 3 and 4 are separate, React-free entry points. Importing them does not
load the tooltip or comment-editor code, so none of it reaches the app's build
output. npm still *installs* this package's dependencies (TipTap, and `radix-ui`
as a peer), so an app that uses only these entry points (the Launcher) carries
them in `node_modules` without shipping them. None of them have install
scripts (checked for v0.3.0, AO-2005).

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
   import { FieldHelpProvider, type FieldHelpEntry } from '@comet/ui/help'

   <FieldHelpProvider glossary={glossary as FieldHelpEntry[]}>
     {children}
   </FieldHelpProvider>
   ```

4. **Use the components** at any label/header:

   ```tsx
   import { FieldLabel, FieldHelp } from '@comet/ui/help'

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

## Dates — `@comet/ui/dates` (v0.3.0, AO-2005)

> Plain version: the one copy of the date rules that stop AltaVue showing a date
> a day early for anyone outside UTC. It used to be copy-pasted, byte for byte,
> into eight repos.

The code was moved unchanged from the apps' `lib/dates.ts` (the long comment at
the top of `src/dates/index.ts` explains calendar days versus moments). It has no
React, browser or server dependency.

What stays in each app: `lib/requestTimeZone.ts` (reads the time-zone cookie on
the server) and the `useViewerTimeZone()` hook / `<LocalTime>` component. Those
are tied to Next.js and React, so they are not shared.

## Contract value and margin — `@comet/ui/finance` (v0.3.0, AO-2005)

> Plain version: every sentence AltaVue shows about a project's contract value
> and margin, written once, so Vantage, the Launcher and Agile can never say the
> same number two different ways.

Exports `CONTRACT_TYPES`, `ProjectFinancials`, `normaliseProjectFinancials` (raw
`project_financials` row → typed, null-safe), `formatMoney`, and
`contractSummary(financials, timeZone?, { budgetLocation? })`.

`budgetLocation` is for an app with no Budget tab of its own — the Launcher
passes the module name so the "create a cost budget" sentence tells the reader
where to go. Leave it out where the Budget tab is on the same project.

**What is deliberately not here:** reading the `project_financials` view and the
`user_can_access_budget` permission check. Both need the app's own Supabase
client, and this package has no database or auth dependency and must not
acquire one (see "Why the components take data instead of fetching it" above).
Each app keeps those two small functions in its own `lib/projectFinancials.ts`.

## How an app adopts the dates and finance entry points

Keep the app's existing file and turn it into a forwarder, so none of the
app's imports change:

```ts
// lib/dates.ts
export * from '@comet/ui/dates'
```

```ts
// lib/projectFinancials.ts — shared wording + this app's own data access
export * from '@comet/ui/finance'
// ...then the app's fetchProjectFinancials() and canViewProjectMoney()
```

Never add logic to a forwarder. A change goes here, gets a new tag, and each app
bumps to it.

Run the tests after any change to either entry point:

```
npm test
```

## Requirements

Peer dependencies (already present in every module): `react` 19+,
`react-dom` 19+, `radix-ui` 1.4+.

Real dependencies added in v0.2.0, installed automatically with the package:
`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/pm`.
TipTap 3's StarterKit already contains Link, so no separate link extension is
installed. The package still ships raw TypeScript with no build step — consumers
keep `transpilePackages: ['@comet/ui']`.

## Versioning

Every module pins a git tag (`#v0.3.0`), so each one updates on its own schedule.
Bump `version` in `package.json` and create the matching tag when you publish a
change.

Once AO-2005 has shipped: Vantage and Launcher on v0.3.0, Agile on v0.3.1;
Estimation, Scheduler, Scope and Time on v0.1.0 with their own `lib/dates.ts`
(identical to the shared copy). The Customer Portal does not use this package
and keeps its own `src/lib/dates.ts`.

## The platform top bar — `@comet/ui/topbar` (AO-2063, v0.4.0)

> Plain version: there is exactly one top bar in AltaVue, and it lives here.
> Every signed-in page in all eight apps shows it — app switcher, module name,
> global reports, global search, help, profile avatar. No app can change it,
> leave a piece out, or keep its own copy: the build fails if one tries.

### The three layers

1. **One copy, no options.** `PlatformTopBar` takes the module and the data it
   shows, and nothing else — no slots, no style props, no optional pieces. The
   module registry, app switcher, reports menu, search, help button, avatar
   menu, link rules and styling are all in `src/topbar/`. Styling is plain CSS
   shipped with the component (an app's Tailwind does not scan this package).
   **No database or auth code here** (shared package rule 1): the bar is
   display-only.
2. **One spot per app.** Each app renders the bar once, in
   `app/(app)/layout.tsx`, through `components/PlatformTopBarConnector.tsx`.
   Every signed-in page lives under `app/(app)/`. Route groups do not change
   URLs. The only pages allowed outside are listed per module in
   `PUBLIC_PAGES` in `bin/verify.mjs` — adding one needs a release.
3. **A check that blocks the build.** Each app's `next.config.ts` calls
   `verifyPlatformTopBar()` from `@comet/ui/verify`; it runs on every
   `next build` (Vercel included) and `next dev`. The Drift Guard (altavue-auth)
   runs the same rules on GitHub, plus "pins the current version" and "the
   next.config call is present".

### The connector

`connector/PlatformTopBarConnector.tsx` is copied **byte for byte** into every
app at `components/PlatformTopBarConnector.tsx` (line endings are ignored). It
reads the signed-in person, `getModuleAccess()`, the `report_registry` list and
`comet_search` through the app's own `@altavue/auth` client, and passes them
in. Sign out is the call every app already used: `signOut()` then `/login`.
The module comes from a two-line `lib/platformModule.ts`:

```ts
import type { PlatformModuleKey } from '@comet/ui/topbar'
export const PLATFORM_MODULE: PlatformModuleKey = 'agile'
```

Keys: `dashboard` (Launcher — shows SUPER ADMIN under `/super-admin`),
`scoping`, `estimation`, `tracker` (Vantage), `agile`, `scheduler`, `time`,
`stakeholders`. The Customer Portal is not covered — it is a separate
customer site with its own header.

### What the build check fails on

- `lib/platformModule.ts` missing or not exactly the two-line form.
- The connector missing or different from the canonical copy.
- `app/(app)/layout.tsx` missing or not rendering `<PlatformTopBarConnector />`.
- A `page.tsx` outside `app/(app)/` that is not on the module's public list
  (or a public page placed inside it).
- A file named `TopBar`, `AppSwitcher`, `ReportsDropdown`, `GlobalSearch`,
  `AppHeaderActions` or `NavHeader`, or any import of one.
- Anything other than the connector importing `@comet/ui/topbar`.
- `@comet/ui` not pinned as `github:AltaVue/altavue-ui#vX.Y.Z`, or a different
  version installed than the one pinned.

Run it by hand: `npx comet-ui-verify` in an app folder.

### Changing the top bar

Change it here, tag a new version, and move **all eight apps up together**
(the Drift Guard fails any app left behind). Never edit the connector inside an
app. Links: module links follow the host the page is on (dev / staging /
production, altavue-app.com or comet-app.com); the Portal is always production
(AO-1918). Tests: `npm test` (`src/topbar/topbar.test.ts`, `bin/verify.test.mjs`).
