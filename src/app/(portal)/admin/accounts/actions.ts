"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminAction, dbError } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const PATH = "/admin/accounts";

/**
 * Generates a temporary password the office can read down a phone line.
 *
 * Avoids characters that are ambiguous when dictated (0/O, 1/l/I) and satisfies
 * the same rule the set-password screen enforces. It is single use: every
 * provisioned account starts with must_change_password set, so this value stops
 * working the moment the user signs in and chooses their own.
 */
function temporaryPassword(): string {
  const words = [
    "Chepilat", "Nyanza", "Kisii", "Grace", "Summit", "Harvest",
    "Sunrise", "Victory", "Beacon", "Anchor", "Compass", "Lantern",
  ];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(Math.random() * 9000) + 1000);
  return `${word}${digits}`;
}

const createSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Enter the person's full name" }).max(120),
  email: z.email({ error: "Enter a valid email address" }).toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["parent", "teacher", "admin"], { error: "Choose a role" }),
  can_release_results: z.literal("on").optional(),
});

/**
 * Provision an account.
 *
 * This is the one place the service-role client is used in a user-triggered
 * path, because creating an auth user requires it. Two safeguards:
 *
 *   1. `requireRole("admin")` runs first and throws a redirect before any
 *      privileged client is constructed.
 *   2. The service client is used ONLY for `auth.admin.createUser`. The profile
 *      row is written with the request-scoped client so RLS still applies to it.
 */
export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("$")) continue;
    raw[k] = v === "" ? undefined : v;
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.join(".") || "form"] ??= []).push(issue.message);
    }
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const input = parsed.data;

  // Only an admin may hold the release permission; the database enforces this
  // too via the profiles_release_requires_admin check.
  const canRelease = input.role === "admin" && input.can_release_results === "on";

  const admin = createAdminClient();
  const password = temporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (/already been registered|already exists/i.test(authError.message)) {
      return { error: "An account already exists for that email address." };
    }
    return { error: `Could not create the account: ${authError.message}` };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    role: input.role,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone || null,
    can_release_results: canRelease,
    must_change_password: true,
    is_active: true,
  });

  if (profileError) {
    // Roll back the auth user so a half-created account cannot sign in with no
    // profile and no role.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `Could not save the profile: ${profileError.message}` };
  }

  revalidatePath(PATH);
  return {
    ok:
      `Account created for ${input.full_name}. Temporary password: ${password} ` +
      `They must change it when they first sign in. This is shown once.`,
  };
}

export async function updateAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(
    z.object({
      id: z.uuid(),
      full_name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(30).optional(),
      role: z.enum(["parent", "teacher", "admin"]),
      can_release_results: z.literal("on").optional(),
    }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: input.full_name,
          phone: input.phone || null,
          role: input.role,
          can_release_results: input.role === "admin" && input.can_release_results === "on",
        })
        .eq("id", input.id);
      if (error) return dbError(error);
      revalidatePath(PATH);
      revalidatePath(`${PATH}/${input.id}`);
      return { ok: "Account updated." };
    },
  );
}

/**
 * Deactivate rather than delete.
 *
 * `verifySession` treats an inactive profile as no session at all, so access
 * ends immediately even if the person still holds a valid cookie. Deleting the
 * account would instead orphan every mark they entered.
 */
export async function setAccountActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ id: z.uuid(), is_active: z.enum(["true", "false"]) }),
    formData,
    async (input, supabase, actorId) => {
      if (input.id === actorId && input.is_active === "false") {
        return { error: "You cannot deactivate your own account." };
      }
      const active = input.is_active === "true";
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: active })
        .eq("id", input.id);
      if (error) return dbError(error);
      revalidatePath(PATH);
      revalidatePath(`${PATH}/${input.id}`);
      return {
        ok: active
          ? "Account reactivated."
          : "Account deactivated. They are signed out immediately.",
      };
    },
  );
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const parsed = z.object({ id: z.uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid account." };

  const password = temporaryPassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password });
  if (error) return { error: `Could not reset the password: ${error.message}` };

  const supabase = await createClient();
  await supabase.from("profiles").update({ must_change_password: true }).eq("id", parsed.data.id);

  revalidatePath(`${PATH}/${parsed.data.id}`);
  return {
    ok: `Temporary password: ${password} They must change it at next sign-in. This is shown once.`,
  };
}
