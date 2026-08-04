import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

/**
 * The signed-in user, reduced to what the UI is allowed to know.
 *
 * A DTO rather than the raw profile row, so a Server Component cannot casually
 * hand the whole record (including fields it should not expose) to the client.
 */
export type SessionUser = {
  id: string;
  role: UserRole;
  fullName: string;
  canReleaseResults: boolean;
  mustChangePassword: boolean;
};

/**
 * Data Access Layer.
 *
 * Every authorization decision starts here. Row Level Security is the real
 * boundary, enforced in the database, and this layer sits in front of it so that
 * pages fail closed with a redirect rather than rendering an empty shell.
 *
 * Two things must stay true:
 *   - Nothing in `app/` queries Supabase directly. It goes through here or
 *     through a repository that calls `requireUser()` first.
 *   - Identity always comes from `getClaims()`, never from `getSession()`.
 *     Session data is read straight from a cookie and is not verified, so it
 *     must not be trusted for an access decision.
 */

/**
 * Verified identity for this request, memoised for the render pass so that a
 * layout and its pages share one lookup instead of re-verifying per component.
 */
export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  // getClaims verifies the JWT signature rather than trusting the cookie body.
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, can_release_results, must_change_password, is_active")
    .eq("id", userId)
    .maybeSingle();

  // A verified token with no active profile is not a valid session. This covers
  // a deactivated staff member whose cookie has not yet expired.
  if (error || !profile || !profile.is_active) return null;

  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    canReleaseResults: profile.can_release_results,
    mustChangePassword: profile.must_change_password,
  };
});

/** The signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await verifySession();
  if (!user) redirect("/login");

  // A provisioned account must set its own password before reaching anything
  // else. Checked here rather than only in proxy so it cannot be routed around.
  if (user.mustChangePassword) redirect("/set-password");

  return user;
}

/** The signed-in user, required to hold one of `roles`. */
export async function requireRole(
  ...roles: [UserRole, ...UserRole[]]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/unauthorized");
  return user;
}

/**
 * Guard for publishing results (requirement 7).
 *
 * The database enforces this too, in the report_cards release trigger. This is
 * the friendly half: it keeps the button and the route out of reach so a user
 * without the permission meets a clear page, not a raw error.
 */
export async function requireResultsRelease(): Promise<SessionUser> {
  const user = await requireRole("admin");
  if (!user.canReleaseResults) redirect("/unauthorized");
  return user;
}

/** Where a role lands after signing in. */
export function homePathFor(role: UserRole): string {
  switch (role) {
    case "parent":
      return "/parent";
    case "teacher":
      return "/teacher";
    case "admin":
      return "/admin";
  }
}
