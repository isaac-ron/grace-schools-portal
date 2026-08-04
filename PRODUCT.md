# PRODUCT.md

## Register

**Product.** Authenticated app UI. Design serves the task: reading a child's results, marking a register, entering marks. No marketing surface lives here; that is the separate static site at `thegraceschools.com`.

## What this is

The portal for The Grace Schools, Chepilat, a Kenyan primary and junior school of up to 1000 learners running the national CBE curriculum.

It does four things:

1. Parents read their child's termly report card, once the Headteacher releases results.
2. Parents read attendance, notices, and a fee balance.
3. Teachers enter marks, mark a daily register, set assignments, and grade photo submissions.
4. Admin runs the school register: learners, classes, staff, terms.

Full scope, phasing and constraints: `../PORTAL_SCOPE.md`.

## Users and context

| User | Device | Context |
|---|---|---|
| **Parent or guardian** | Low-end Android, 3G, metered data | Standing outside, at work, or at home. Opens it a handful of times a term, usually the week results come out. Not a confident computer user. Data costs them real money. |
| **Teacher** | Personal phone, sometimes a shared laptop | Marking a register between 8:00 and 8:20am with 40 learners in front of them. Entering marks at the end of term under time pressure. |
| **Admin and Headteacher** | Laptop in the school office | Longer sessions, bulk work: importing learners, reviewing an exception report, releasing results. |

**The defining constraint:** most users are not digitally confident and are on cheap phones over expensive data. Every design decision resolves toward that.

## The primary task per surface

- Parent home: "how is my child doing, and is there anything I need to act on."
- Report card: read and keep. Must survive being printed or screenshotted.
- Teacher register: mark the exceptions and get out. Present is the default.
- Mark entry: type a column of numbers quickly without losing your place.
- Admin: find a learner, fix a record, move on.

## Brand personality

**Plain. Official. Unhurried.**

This holds official records about someone's child. It should read like a school record, not a product. Trust comes from clarity and restraint, not from personality. The crimson and gold carry over from the marketing site so a parent recognises the school, but they are used as identity and state, never as decoration.

## Anti-references

Explicitly not:

- **A consumer app.** No gamification, streaks, badges, celebratory animation, or emoji on a child's grades. A Below Expectation result is a real thing about a real child and the interface must never editorialise it.
- **A corporate SaaS dashboard.** No KPI tiles, no charts for their own sake, no analytics density on the parent side. Parents want one child's facts, not a console.
- **The old PHP portal.** No cramped tables, 11px text, dated form controls, or desktop-only layouts.
- **A social feed.** No infinite scroll, activity stream, likes, or comment threads.

## Strategic design principles

1. **Readability on a cheap phone wins every conflict.** Large tap targets, generous type, high contrast, works at 320px. Admin screens may be denser because they are used on laptops.
2. **The release gate is visible, not implied.** A parent must never be confused about whether they are seeing final results. Draft data is not shown to parents at all, and the database enforces that.
3. **Never punish with design.** CBE deliberately removes class ranking. Below Expectation gets a muted treatment, never an alarm red, and "not assessed" is visually distinct from the bottom grade because they are different facts.
4. **Degrade gracefully.** The register works with no signal and syncs later. Report cards print. Nothing depends on a live connection to be readable.
5. **Every gram of page weight is a parent's money.** No web fonts beyond the two already self-hosted, no icon library, no chart library on parent surfaces.

## Accessibility

- WCAG 2.2 AA. Body text at 4.5:1 minimum, verified rather than assumed.
- Colour is never the only signal. Every achievement level shows its code as text next to any colour.
- Tap targets 44px minimum.
- Full keyboard operation for staff surfaces, where the real work happens.
- `prefers-reduced-motion` respected globally.
- Light scheme pinned. Forced dark mode on low-end Android mangles data tables.
