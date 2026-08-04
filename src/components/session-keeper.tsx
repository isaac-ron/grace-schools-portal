"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * Keeps the Supabase session fresh from the browser.
 *
 * WHY THIS EXISTS INSTEAD OF proxy.ts
 *
 * The usual place to refresh a Supabase session in Next.js is Proxy (renamed
 * from Middleware in Next 16), because Server Components cannot set cookies.
 * That is not available here:
 *
 *   - Next.js 16 runs Proxy on the Node.js runtime and explicitly removed the
 *     `runtime` config option from Proxy files; setting it throws.
 *   - The Cloudflare adapter refuses to build a Node.js Proxy and offers no
 *     flag to override it.
 *
 * So Proxy and Cloudflare Workers cannot both be used on Next 16, and the
 * session refresh moves to the client, which handles it natively: the browser
 * client auto-refreshes the access token before expiry and writes the rotated
 * cookies itself.
 *
 * Without this, a teacher entering marks would hit token expiry mid-task, get
 * bounced to the login page by the DAL, and lose a half-filled mark sheet.
 *
 * Nothing about authorization depends on this component. Route protection is
 * `requireUser` / `requireRole` in the DAL, and the real boundary is Row Level
 * Security in the database. This only keeps a valid session valid.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // On a rotated token, re-render Server Components so they read the new
      // cookies. On sign-out in another tab, send this one to the login page.
      if (event === "TOKEN_REFRESHED") {
        router.refresh();
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
