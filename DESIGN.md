# DESIGN.md

Visual system for the Grace Schools portal. Tokens live in `src/app/globals.css`.

## Theme

**Light, pinned.** `color-scheme: light` is set explicitly rather than left to the OS. Forced dark mode on low-end Android inverts data tables into something unreadable, and this surface is mostly tables.

**Colour strategy: Restrained.** Tinted neutrals carry the surface; crimson appears only on primary actions, the current selection, and the identity bar. The school's colours are strong, and a portal that used them at full strength would read as a brochure rather than a record.

## Palette

Carried from the marketing site so a parent recognises the school.

| Role | Token | Value |
|---|---|---|
| Primary | `--color-crimson` | `#8B1A1A` |
| Primary pressed | `--color-crimson-dark` | `#6B0F0F` |
| Primary tint | `--color-crimson-tint` | `#FDF2F2` |
| Accent | `--color-gold` | `#D4A017` |
| Page surface | `--color-surface` | `#F8FAFC` |
| Card | `--color-card` | `#FFFFFF` |
| Hairline | `--color-line` | `#E2E8F0` |
| Ink | `--color-ink` | `#0F172A` |
| Ink soft | `--color-ink-soft` | `#475569` |
| Ink muted | `--color-ink-muted` | `#94A3B8` |

`--color-ink-soft` at `#475569` is the floor for body text on white (8.6:1). `--color-ink-muted` is for non-essential labels at 14px and above only, never for body copy.

**Gold is identity, not action.** It appears in the wordmark rule and nowhere interactive. Gold on white fails contrast at body sizes, so it is never a text colour on light surfaces.

### Semantic state

`--color-ok`, `--color-warn`, `--color-alert`, `--color-info`, each with a `-tint` companion for backgrounds. Used for attendance status, release state, and submission state.

### CBE achievement levels

The one place colour carries real meaning.

| Level | Token | Treatment |
|---|---|---|
| Exceeding (EE, EE1, EE2) | `--color-level-ee` | Green |
| Meeting (ME, ME1, ME2) | `--color-level-me` | Blue |
| Approaching (AE, AE1, AE2) | `--color-level-ae` | Amber |
| Below (BE, BE1, BE2) | `--color-level-be` | Muted rose |
| Not assessed | `--color-level-na` | Slate |

Two deliberate decisions here.

**Below Expectation is a muted rose, not an alarm red.** CBE removes class ranking by design to reduce comparison pressure. An interface that renders a child's result in danger-red works against that, and a parent should not meet a scarlet badge next to their eight-year-old's name.

**Not assessed is visually distinct from Below Expectation.** They are different facts. A learner who missed an assessment is slate and reads "Not assessed", never the bottom grade.

**Colour is never the only signal.** Every level badge prints its code as text.

## Typography

Two families, sharply divided by job.

- **Inter Variable** (`--font-body`) for all interface text: labels, buttons, tables, marks, body. Product UI wants one well-tuned sans, and this is it.
- **Playfair Display Variable** (`--font-heading`, applied via `.font-display`) for the wordmark and page titles only. It carries the school's identity into the portal without ever appearing in a control or a data cell.

**Fixed rem scale, not fluid.** Clamp-scaled headings serve marketing pages, not a table that has to stay legible in a sidebar.

| Step | Size | Use |
|---|---|---|
| `text-2xl` | 1.5rem | Page title |
| `text-lg` | 1.125rem | Section heading |
| `text-base` | 1rem | Body, form inputs, table cells |
| `text-sm` | 0.875rem | Secondary text, table headers |
| `text-xs` | 0.75rem | Badges, metadata. Never body copy. |

Form inputs are 16px minimum. Anything smaller triggers zoom-on-focus in mobile Safari and Android WebView.

`.tabular` applies `font-variant-numeric: tabular-nums` to every mark, percentage and attendance count so columns align and digits do not jitter.

## Layout

- Content max width 72ch for prose, full width for tables.
- Mobile first, working from 320px.
- Parent surfaces are single column throughout. No parent screen has a sidebar.
- Staff surfaces get a sidebar at `lg` and a bottom bar below it.
- Tables scroll inside their own `overflow-x: auto` container. The page body never scrolls sideways.

## Components

Every interactive element ships with default, hover, focus-visible, active, disabled, and where relevant loading and error. Half a set is not a set.

- **Tap targets 44px minimum**, including table row actions.
- **Focus ring:** 2px crimson at 2px offset, on every interactive element. Never removed.
- **Buttons:** one shape across the whole portal. Primary is solid crimson, secondary is a hairline outline, destructive is `--color-alert`.
- **Empty states teach the interface.** "No marks entered yet" plus the action that fixes it, never a bare "nothing here".
- **Skeletons, not spinners**, for content that is loading in place.

## Motion

- 150 to 200ms on state transitions. Users are in a task.
- Motion conveys state only: a pressed button, a saving row, a queued register entry syncing. Nothing decorative.
- No page-load choreography.
- `prefers-reduced-motion: reduce` collapses everything to instant, handled globally in `globals.css`.

## What this system deliberately does not have

No icon library, no chart library, no component framework, no animation library. Page weight is a cost the parent pays in mobile data. Icons are inline SVG where genuinely needed, and there are very few.
