import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. THIS BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Legitimate uses are narrow:
 *   - provisioning accounts (creating auth users for parents and staff)
 *   - the nightly backup job
 *   - the retention job that purges submission photos after two terms
 *
 * It must never be used to serve a page, a Server Action triggered by a user, or
 * anything where the caller's identity determines what they should see. Reach for
 * `lib/supabase/server` instead: if a query needs to bypass RLS to work, the
 * policy is wrong and the fix belongs in the policy.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.supabaseUrl,
    serverEnv().secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
