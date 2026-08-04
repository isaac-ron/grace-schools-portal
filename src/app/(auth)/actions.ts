"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, verifySession } from "@/lib/dal";

export type AuthState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().min(1, { error: "Enter your email or phone number" }),
  password: z.string().min(1, { error: "Enter your password" }),
});

/**
 * Sign in.
 *
 * Failures return one deliberately vague message. Distinguishing "no such
 * account" from "wrong password" tells an attacker which of a school's parent
 * emails are real, and tells them nothing a legitimate user needs.
 */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again" };
  }

  const supabase = await createClient();

  // Only the auth call is wrapped. `redirect()` below signals by throwing, so a
  // try/catch around the whole action would swallow it.
  let failed = false;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    failed = Boolean(error);
  } catch {
    // Defensive only: signInWithPassword reports network failure through its
    // returned `error` rather than by throwing, so this branch is rarely taken.
    // It exists so an unexpected throw becomes a message instead of a 500.
    return {
      error: "Could not reach the school system. Check your connection and try again.",
    };
  }

  if (failed) {
    return { error: "Those details did not match an account. Please try again." };
  }

  const user = await verifySession();
  if (!user) {
    // Authenticated, but no active profile. A deactivated staff member, or an
    // auth user the provisioning step never finished.
    await supabase.auth.signOut();
    return {
      error: "This account is not active. Please contact the school office.",
    };
  }

  const next = formData.get("next");
  if (user.mustChangePassword) redirect("/set-password");
  redirect(typeof next === "string" && next.startsWith("/") ? next : homePathFor(user.role));
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "Use at least 8 characters" })
      .regex(/[a-zA-Z]/, { error: "Include at least one letter" })
      .regex(/[0-9]/, { error: "Include at least one number" }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    error: "The two passwords do not match",
    path: ["confirm"],
  });

/**
 * Set a new password on first sign-in.
 *
 * Accounts are provisioned by the school office with a temporary password, so
 * every account starts with must_change_password set. Until it is cleared, the
 * DAL redirects every route here.
 */
export async function setPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the password and try again" };
  }

  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) {
    return { error: "That password could not be saved. Please try a different one." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  if (profileError) {
    return { error: "Your password changed but the account did not update. Contact the office." };
  }

  const user = await verifySession();
  redirect(user ? homePathFor(user.role) : "/login");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
