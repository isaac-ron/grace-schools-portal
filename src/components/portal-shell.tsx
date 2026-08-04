import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/ui";
import { NavLinks, type NavItem } from "@/components/portal-nav";
import type { SessionUser, UserRole } from "@/lib/dal";

/**
 * The portal shell.
 *
 * Parents get a top bar and nothing else: their surface is single column with
 * one destination, and a sidebar would be navigation for its own sake. Staff get
 * a sidebar on laptops and a bottom bar on phones, because they move between
 * registers, marks and classes constantly.
 *
 * The masthead is the deep crimson field closed by a gold rule. That pairing is
 * the structural mark of the Crest system and it repeats at the head of every
 * record inside the app, which is what ties a page to the school rather than to
 * a product.
 */

const NAV: Record<UserRole, NavItem[]> = {
  parent: [{ href: "/parent", label: "Home", ready: true }],
  teacher: [
    { href: "/teacher", label: "Today", ready: true },
    { href: "/teacher/register", label: "Register", ready: true },
    { href: "/teacher/marks", label: "Marks", ready: false },
    { href: "/teacher/assignments", label: "Assignments", ready: false },
  ],
  admin: [
    { href: "/admin", label: "Overview", ready: true },
    { href: "/admin/students", label: "Learners", ready: true },
    { href: "/admin/classes", label: "Classes", ready: true },
    { href: "/admin/accounts", label: "Accounts", ready: true },
    { href: "/admin/attendance", label: "Attendance", ready: true },
    { href: "/admin/academic-year", label: "Academic year", ready: true },
    { href: "/admin/notices", label: "Notices", ready: true },
    { href: "/admin/fees", label: "Fees", ready: true },
    { href: "/admin/results", label: "Results", ready: false },
    { href: "/admin/promotion", label: "Promotion", ready: true },
    { href: "/admin/audit", label: "Audit log", ready: true },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  parent: "Parent",
  teacher: "Teacher",
  admin: "Administration",
};

export function PortalShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const items = NAV[user.role];
  const isStaff = user.role !== "parent";

  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                   focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:font-semibold
                   focus:text-crimson focus:outline-2 focus:outline-crimson"
      >
        Skip to content
      </a>

      <header className="no-print sticky top-0 z-30 border-b-2 border-gold bg-crimson-deep">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href={`/${user.role}`}
            className="rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Wordmark subdued />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm leading-tight text-white sm:block">
              <span className="block font-semibold">{user.fullName}</span>
              <span className="block text-white/75">{ROLE_LABEL[user.role]}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-[44px] rounded-md border border-white/35 px-4 text-sm font-semibold
                           text-white transition-colors duration-150 hover:bg-white/10
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6">
        {isStaff && (
          <nav
            aria-label="Sections"
            className="no-print hidden w-56 shrink-0 flex-col gap-0.5 lg:flex"
          >
            <NavLinks items={items} layout="side" />
          </nav>
        )}

        <main id="main" className={`min-w-0 flex-1 ${isStaff ? "pb-20 lg:pb-0" : ""}`}>
          {children}
        </main>
      </div>

      {isStaff && (
        <nav
          aria-label="Sections"
          className="no-print fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t
                     border-line bg-card lg:hidden"
        >
          <NavLinks items={items} layout="bottom" />
        </nav>
      )}
    </div>
  );
}
