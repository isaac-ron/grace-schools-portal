import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Browser client, used only where the interaction genuinely has to happen on the
 * client: the photo upload progress flow and the attendance retry queue.
 *
 * Everything else reads through the server DAL. This client is still bound by
 * the same RLS policies, so it cannot reach data the user is not entitled to.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
  );
}
