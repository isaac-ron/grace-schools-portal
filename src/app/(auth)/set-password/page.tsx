import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Choose a password" };

export default async function SetPasswordPage() {
  // Not requireUser: that would redirect back here and loop.
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-2xl font-bold text-ink">
        Choose a password
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Welcome, {user.fullName}. The office gave you a temporary password. Pick
        your own before you continue, and keep it private.
      </p>

      <SetPasswordForm />
    </div>
  );
}
