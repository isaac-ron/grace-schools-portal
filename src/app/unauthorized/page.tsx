import type { Metadata } from "next";
import Link from "next/link";
import { verifySession, homePathFor } from "@/lib/dal";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "No access" };

export default async function UnauthorizedPage() {
  const user = await verifySession();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Wordmark />
        <h1 className="mt-8 font-display text-2xl font-bold text-ink">
          You do not have access to that page
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your account does not carry the permission this page needs. If you think
          that is wrong, the school office can check your account.
        </p>
        <div className="mt-8">
          <Link
            href={user ? homePathFor(user.role) : "/login"}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-crimson px-5
                       font-semibold text-white transition-colors duration-150
                       hover:bg-crimson-dark
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-crimson"
          >
            Back to your home page
          </Link>
        </div>
      </div>
    </main>
  );
}
