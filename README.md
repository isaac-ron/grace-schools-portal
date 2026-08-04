# Grace Schools Portal

Authenticated portal for The Grace Schools, Chepilat. Separate from the public
marketing site (`../grace-schools`, a static export on HostPinnacle) and
deployed separately so nothing it does can affect that site or the Vijana site
sharing the same hosting account.

Scope and decisions: [`../PORTAL_SCOPE.md`](../PORTAL_SCOPE.md)
Product context: [`PRODUCT.md`](PRODUCT.md) · Visual system: [`DESIGN.md`](DESIGN.md)

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind v4 |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database, auth | Supabase (Postgres + Row Level Security) |
| Submission photos | Cloudflare R2 |
| Backups | Nightly `pg_dump` to R2 via GitHub Actions |

Running cost is KES 0. Everything is on a permanent free tier.

## Status: Phases 0 and 1 complete

**Phase 0, foundations:**

- Database schema, 25 tables, with the CBE grading model
- Row Level Security on every table, 71 passing authorization assertions
- Supabase clients (request-scoped, browser, service-role)
- Data Access Layer with session verification and role guards
- Auth: sign in, forced first-login password change, sign out
- Role-based portal shell
- Cloudflare deploy config, CI, nightly backup, keep-alive

**Phase 1, admin core:**

- Academic years and terms, with atomic "current" switching
- Classes, streams, class teachers, subject teacher assignment
- Learning areas (CBE subjects)
- Learners: enrol, search, filter, edit, move class, archive
- Guardian linking, which is what grants a parent sight of a learner
- Accounts: provision any role, temporary passwords, permissions, deactivate
- Bulk learner import from CSV with a dry-run preview
- Notices, publish and withdraw
- Fee balance CSV upload
- Year-end promotion
- Audit log viewer

**Not built yet:** mark entry, registers, assignments, report cards. Those are
Phases 2 to 5 in the scope document. Nav shows Results greyed out.

## Local setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose the region
   closest to Kenya.
2. Under **Project Settings → API**, copy the project URL, the `anon` key, and
   the `service_role` key.
3. Under **Project Settings → Database**, copy the connection string.

### 2. Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

The service role key bypasses Row Level Security completely. It is used only for
provisioning accounts and the backup job. It must never appear in a
`NEXT_PUBLIC_` variable or be used to serve a user request.

### 3. Apply migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor in order.

### 4. Run

```bash
npm install
npm run dev
```

There is no sign-up page. Accounts are provisioned by the school office, so seed
a demo school to get in and look around:

```bash
npm run db:seed          # or db:seed:reset to wipe and re-seed
```

All seeded accounts use the password `GracePortal2026`:

| Account | Role | What it shows |
|---|---|---|
| `head@thegraceschools.test` | Admin + release | Headteacher. Can publish results. |
| `admin@thegraceschools.test` | Admin | Cannot publish results. |
| `teacher.g7@thegraceschools.test` | Teacher | Grade 7 only. |
| `teacher.g2@thegraceschools.test` | Teacher | Grade 2 and PP1, observation marking. |
| `parent.achieng@thegraceschools.test` | Parent | Two children. Grade 7 results **released**. |
| `parent.kiprono@thegraceschools.test` | Parent | One child. Results **draft**, so no marks. |

The two parent accounts are the interesting pair: same page, same code path, and
one sees marks while the other sees none. Nothing in the UI does that filtering.
The database refuses.

The seeded Grade 7 marks deliberately cover the awkward cases: a learner with a
missing Maths mark (renders "Not assessed", not Below Expectation) who also
scored a genuine zero in Agriculture (renders BE2, correctly).

To provision a real account by hand instead, create the user in
**Supabase → Authentication → Users**, then insert a matching profile:

```sql
insert into profiles (id, role, full_name, can_release_results, must_change_password)
values ('<auth user uuid>', 'admin', 'Head Teacher', true, false);
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:test` | **Applies all migrations to a throwaway Postgres and runs the authorization suite.** Requires Docker. |
| `npm run test:csv` | Unit tests for the CSV import parser |
| `npm run db:seed` | Seed a demo school with test accounts |
| `npm run db:seed:reset` | Wipe seeded data and re-seed |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the linked project |
| `npm run cf:build` | Build for Cloudflare Workers |
| `npm run cf:preview` | Run the Workers build locally |
| `npm run cf:deploy` | Deploy to Cloudflare |

## The authorization suite

`npm run db:test` is the most important command in this repo.

It spins up a real Postgres, applies every migration, and asserts 70 things
including:

- A parent sees their own children and no one else's
- A parent cannot see marks while the report card is still in draft
- A parent can see them the moment results are released, and another parent
  still cannot
- A teacher sees only learners in classes they are assigned to
- Teachers cannot see fee balances
- An admin without the release permission cannot publish results
- A parent cannot escalate their own role
- A guardian cannot grade their own child's work
- A teacher cannot attach a mark to a learner outside their class
- Every whole percent from 0 to 100 maps to exactly one CBE band on both scales
- A missing mark yields "not assessed", never Below Expectation

Run it after any change under `supabase/migrations/`. CI blocks merges on it.

## Deployment

### First time

```bash
npx wrangler login
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run cf:deploy
```

Then point `portal.thegraceschools.com` at the Worker in the Cloudflare
dashboard. The apex domain stays on HostPinnacle and is not touched.

### GitHub secrets for the scheduled jobs

| Secret | Used by |
|---|---|
| `SUPABASE_DB_URL` | backup |
| `BACKUP_PASSPHRASE` | backup (AES256 symmetric encryption) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | backup |
| `R2_ENDPOINT`, `R2_BUCKET` | backup |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | keep-alive |

**Test the restore before go-live.** A backup nobody has restored is a guess.

## Architecture notes

**Row Level Security is the authorization boundary**, not the UI and not the
route guards. Policies live in `supabase/migrations/0004_security.sql`. The
`proxy.ts` guard and the DAL's `requireRole` exist so users meet a redirect
instead of an empty page, but neither is what stops a data leak.

**Nothing in `app/` queries Supabase without going through a session check
first.** Pages call `requireUser()` or `requireRole()` from `src/lib/dal.ts`,
which verifies the JWT signature via `getClaims()` rather than trusting the
session cookie.

**Marks are derived, never stored twice.** A score holds the raw mark; the
percentage and CBE level are computed by a database trigger. This means a
corrected mark immediately corrects the report card, and results can be
recomputed if a band is ever revised.

**"Not assessed" is not a grade.** A learner absent from an assessment has a
NULL score and no level. The published KNEC scale starts at 1%, and a scored
zero maps to the bottom band, but a missing mark maps to nothing at all.
Conflating the two would permanently misrepresent a child on a document their
parents keep.

**No class ranking.** CBE removes it by design. It is not a missing feature.

**Photos only.** Video is not supported anywhere: not capped, not configurable,
not behind a flag. The `submission_files` table rejects any MIME type that is
not JPEG, PNG or WebP.

## Note on `proxy.ts`

Next.js 16 renamed Middleware to Proxy. The file is `src/proxy.ts`, not
`src/middleware.ts`. It refreshes the Supabase session and writes rotated
cookies to the response, which Server Components cannot do. Without it, users
get random logouts.
