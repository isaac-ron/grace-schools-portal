import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { homePathFor, verifySession } from "@/lib/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in: skip the form. Previously handled in proxy.ts, which
  // this app cannot use on Cloudflare (see components/session-keeper.tsx).
  const existing = await verifySession();
  if (existing) {
    redirect(existing.mustChangePassword ? "/set-password" : homePathFor(existing.role));
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-2xl font-bold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Use the email address or phone number you gave the school office.
      </p>

      <LoginForm next={next} />

      <p className="mt-8 border-t border-line pt-6 text-sm text-ink-soft">
        Accounts are created by the school office. If you do not have one yet, or
        you have forgotten your password, call the office on{" "}
        <a
          href="tel:+254720970572"
          className="font-medium text-crimson underline underline-offset-4"
        >
          0720 970 572
        </a>
        .
      </p>
    </div>
  );
}
