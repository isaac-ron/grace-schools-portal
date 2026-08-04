import "server-only";

import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/form";

/**
 * Shared plumbing for admin Server Actions.
 *
 * Every admin mutation goes through `adminAction`, which guarantees three things
 * that are easy to forget one at a time:
 *
 *   1. The caller is an active admin, checked before any input is touched.
 *   2. Input is validated against a schema, with per-field errors returned.
 *   3. The Supabase client used is the request-scoped one, so RLS applies. The
 *      service-role client is never reachable from here.
 */
export async function adminAction<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  run: (
    input: z.infer<S>,
    supabase: Awaited<ReturnType<typeof createClient>>,
    actorId: string,
  ) => Promise<ActionState>,
): Promise<ActionState> {
  const user = await requireRole("admin");

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue; // React action metadata
    raw[key] = value === "" ? undefined : value;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();

  try {
    return await run(parsed.data, supabase, user.id);
  } catch (e) {
    // Database constraints and triggers carry messages written for humans
    // (the results release guard, the enrollment checks). Surface them rather
    // than replacing them with a generic failure.
    const message = e instanceof Error ? e.message : "Something went wrong.";
    return { error: message };
  }
}

/** Turns a Supabase error into an ActionState, mapping the constraints we own. */
export function dbError(error: { message: string; code?: string } | null): ActionState {
  if (!error) return undefined;

  if (error.code === "23505") {
    return { error: "That already exists. Check for a duplicate." };
  }
  if (error.code === "23503") {
    return { error: "That references something which no longer exists. Refresh and try again." };
  }
  return { error: error.message };
}
