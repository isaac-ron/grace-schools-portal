# DESIGN.md

Visual system for the Grace Schools portal. Tokens live in `src/app/globals.css`.

## The system: Crest

**The portal's most important output is a document a parent keeps.** A report card
is printed, folded, and produced again at a fee meeting two years later. So the
interface is built from document grammar rather than app grammar: ruled rows
instead of cards, a gold rule closing every record head, small-caps field labels,
and an old-style serif reserved for titles.

The same system runs the marketing site, which is what makes the two read as one
school rather than a brochure and an unrelated product.

**Light, pinned.** `color-scheme: light` is set explicitly rather than left to the
OS. Forced dark mode on low-end Android inverts data tables into something
unreadable, and this surface is mostly tables.

**Colour strategy: Committed.** Deep crimson carries the mastheads and record
heads. Warm paper carries everything else. Crimson still appears in only three
places on a page body: primary actions, the current selection, and the identity
bar. Gold is structural, not decorative.

## Palette

Carried from the crest so a parent recognises the school.

| Role | Token | Value |
|---|---|---|
| Primary | `--color-crimson` | `#8B1A1A` |
| Primary pressed | `--color-crimson-dark` | `#6B0F0F` |
| Drenched field | `--color-crimson-deep` | `#4A0B0B` |
| Primary tint | `--color-crimson-tint` | `#FBF4F1` |
| Structural rule | `--color-gold` | `#D4A017` |
| Page surface | `--color-surface` | `#FBFAF8` |
| Card | `--color-card` | `#FFFFFF` |
| Hairline | `--color-line` | `#E3DED5` |
| Control edge | `--color-line-strong` | `#8F8574` |
| Ink | `--color-ink` | `#1A1614` |
| Ink soft | `--color-ink-soft` | `#55504A` |
| Ink muted | `--color-ink-muted` | `#756C5F` |

**Warm paper, not cool slate.** The surface is `#FBFAF8`. A document is printed
on paper and the neutral is biased to match, which also stops the crimson reading
as cold.

**Two line weights, two jobs.** `--color-line` is the hairline that separates
rows and closes sections; it is decorative and deliberately faint.
`--color-line-strong` is the edge of a control: input, select, secondary button.
It carries 3:1 against both paper and card because WCAG 1.4.11 applies to the
boundary of a control, and the previous slate value failed that at 1.6:1.

**Gold is identity and structure, never action.** It closes a document head and
underlines the masthead. It is never a text colour on light surfaces and never
appears on anything interactive.

**Contrast is verified, not assumed.** Every pair the portal actually renders was
checked against WCAG AA. `--color-ink-muted` at `#756C5F` clears 4.5:1 on both
paper and card, so unlike the old muted grey it is safe for real labels rather
than being restricted to 14px and above.

### Semantic state

`--color-ok`, `--color-warn`, `--color-alert`, `--color-info`, each with a
`-tint` companion. Warmed to sit on paper instead of reading as a foreign UI.
Used for attendance status, release state, and submission state.

### CBE achievement levels

The one place colour carries real meaning.

| Level | Token | Treatment |
|---|---|---|
| Exceeding (EE, EE1, EE2) | `--color-level-ee` | Green |
| Meeting (ME, ME1, ME2) | `--color-level-me` | Blue |
| Approaching (AE, AE1, AE2) | `--color-level-ae` | Amber |
| Below (BE, BE1, BE2) | `--color-level-be` | Muted rose |
| Not assessed | `--color-level-na` | Warm slate |

Two deliberate decisions here.

**Below Expectation is a muted rose, not an alarm red.** CBE removes class ranking
by design to reduce comparison pressure. An interface that renders a child's
result in danger-red works against that, and a parent should not meet a scarlet
badge next to their eight-year-old's name.

**Not assessed is visually distinct from Below Expectation.** They are different
facts. A learner who missed an assessment is warm slate and reads "Not assessed",
never the bottom grade.

**Colour is never the only signal.** Every level badge prints its code as text.

## Typography

Two families, sharply divided by job.

- **Inter Variable** (`--font-body`) for all interface text: labels, buttons,
  tables, marks, body. Product UI wants one well-tuned sans, and this is it.
- **Source Serif 4 Variable** (`--font-heading`, applied via `.font-display`) for
  page titles, record heads and the wordmark. It replaced Playfair Display, which
  is a high-contrast display face: elegant at 48px on a marketing hero, thin and
  fragile at 24px on a cheap Android screen. Source Serif is a text serif built
  for exactly this size, and it prints properly.

Never a serif inside a control or a data cell.

**Fixed rem scale, not fluid.** Clamp-scaled headings serve marketing pages, not
a table that has to stay legible in a sidebar.

| Step | Size | Use |
|---|---|---|
| `text-2xl` | 1.5rem | Page title |
| `text-lg` | 1.125rem | Section heading |
| `text-base` | 1rem | Body, form inputs, table cells |
| `text-sm` | 0.875rem | Secondary text |
| `text-xs` | 0.75rem | Badges. Never body copy. |

`.doc-label` is the document caption: 11px, bold, uppercase, `0.13em` tracked. It
labels a value on a record ("Learner", "Admission no.") and heads a table column.
**It is not a section eyebrow.** A tracked label floating above every heading is
decoration; this one is only ever attached to a value.

Form inputs are 16px minimum. Anything smaller triggers zoom-on-focus in mobile
Safari and Android WebView.

`.tabular` applies `font-variant-numeric: tabular-nums` to every mark, percentage
and attendance count so columns align and digits do not jitter.

## Layout

- Content max width 72ch for prose, full width for tables.
- Mobile first, working from 320px.
- Parent surfaces are single column throughout. No parent screen has a sidebar.
- Staff surfaces get a sidebar at `lg` and a bottom bar below it.
- Tables scroll inside their own `overflow-x: auto` container. The page body never
  scrolls sideways.

**Ruled, not boxed.** A list of records is one bordered block with hairlines
between rows, never one card per row. Cards per item were the previous default
and they made a register of forty learners into forty pieces of chrome to scroll
past. `Panel`, `TableWrap`, `EmptyState` and the list surfaces all use `border-y`
with internal hairlines.

**Radius is a token, not a decision per component.** The scale is retuned in
`@theme` (`--radius-lg: 3px`), so every screen de-rounds at once and no screen can
drift back into app-card shapes.

## Components

Every interactive element ships with default, hover, focus-visible, active,
disabled, and where relevant loading and error. Half a set is not a set.

- **Tap targets 44px minimum**, including table row actions.
- **Focus ring:** 2px crimson at 2px offset, on every interactive element. Never
  removed.
- **Buttons:** one shape across the whole portal. Primary is solid crimson,
  secondary is a hairline outline, destructive is `--color-alert`. `LinkButton`
  is the same shape as an anchor, so navigation actions cannot drift.
- **`DocHead` and `DocField`** are the record primitives: a title closed by the
  gold rule, and a small-caps label above a value. Any surface that is a record of
  something rather than a workspace uses them.
- **Empty states teach the interface.** "No marks entered yet" plus the action
  that fixes it, never a bare "nothing here".
- **Skeletons, not spinners**, for content that is loading in place.
- **No KPI tiles.** The admin overview is a ruled summary. PRODUCT.md rules out
  the dashboard console and three numbers do not need three boxes.

## Motion

- 150 to 200ms on state transitions. Users are in a task.
- Motion conveys state only: a pressed button, a saving row, a queued register
  entry syncing. Nothing decorative.
- No page-load choreography.
- `prefers-reduced-motion: reduce` collapses everything to instant, handled
  globally in `globals.css`.

## Print

A released report card is meant to be kept, so printing produces a document
rather than a screenshot of an interface. `globals.css` drops the page background
and `.no-print` removes the shell chrome: masthead, sidebar, bottom bar.

## What this system deliberately does not have

No icon library, no chart library, no component framework, no animation library.
Page weight is a cost the parent pays in mobile data. Icons are inline SVG where
genuinely needed, and there are very few. The two web fonts are self-hosted and
subset by `unicode-range`, so a Latin-only reader never downloads Cyrillic.
