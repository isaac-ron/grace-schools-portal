import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Request-scoped Supabase client carrying the signed-in user's session.
 *
 * Every query made through this client runs as that user, so the RLS policies in
 * migration 0004 apply. This is the only client that should ever serve a page or
 * a Server Action.
 *
 * A new client is created per request. Never hoist one to module scope: doing so
 * would leak one user's session into another user's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Token refresh is handled in
            // proxy.ts, which runs before rendering and can write to the
            // response, so this is safe to swallow.
          }
        },
      },
    },
  );
}
