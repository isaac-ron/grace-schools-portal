import { z } from "zod";

/**
 * Environment configuration, validated once at module load so a missing or
 * malformed value fails the build or the first request rather than surfacing
 * as a confusing runtime error deep inside a data call.
 *
 * KEY NAMING
 *
 * Supabase renamed its API keys. New projects issue:
 *   - `sb_publishable_...`  (was: the `anon` key)  safe to ship to the browser
 *   - `sb_secret_...`       (was: `service_role`)  bypasses RLS, server only
 *
 * Both namings are accepted here so an older project with legacy JWT keys and a
 * new project with the current format both work without a code change.
 */

/**
 * NEXT_PUBLIC_* values are inlined at build time, so each one must be written
 * as a full literal property access. A dynamic lookup would resolve to
 * undefined in the browser bundle.
 */
const rawPublishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const publicSchema = z.object({
  url: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  publishableKey: z.string().min(20, {
    error:
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...). " +
      "On older projects this is the anon key.",
  }),
  siteUrl: z.url().optional(),
});

const parsed = publicSchema.parse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: rawPublishable,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
});

export const env = {
  supabaseUrl: parsed.url,
  /** Safe in the browser. RLS is what protects the data, not this key. */
  supabasePublishableKey: parsed.publishableKey,
  siteUrl: parsed.siteUrl,
};

/**
 * Server-only secrets, kept out of `env` so that importing the public config
 * from a Client Component can never drag a secret into the browser bundle.
 *
 * The secret key bypasses Row Level Security completely. It is for account
 * provisioning, the seed script and the backup job. Never for a user request.
 */
const serverSchema = z.object({
  secretKey: z.string().min(20, {
    error:
      "Set SUPABASE_SECRET_KEY (sb_secret_...). " +
      "On older projects this is the service_role key.",
  }),
});

let cached: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (!cached) {
    cached = serverSchema.parse({
      secretKey:
        process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }
  return cached;
}
