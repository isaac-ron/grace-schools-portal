"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Section navigation.
 *
 * A client component only because the current section has to be marked, which
 * DESIGN.md names as one of the three places crimson is allowed to appear. The
 * rest of the shell stays on the server.
 */

export type NavItem = { href: string; label: string; ready: boolean };

export function NavLinks({
  items,
  layout,
}: {
  items: NavItem[];
  layout: "side" | "bottom";
}) {
  const pathname = usePathname();

  const base =
    layout === "side"
      ? "flex items-center rounded-md px-3 py-2.5 text-sm min-h-[44px]"
      : // Fixed width plus a scrolling parent: admin has ten sections, and
        // squeezing them into one screen width makes every label unreadable.
        "flex shrink-0 items-center justify-center whitespace-nowrap px-4 text-sm min-h-[56px] border-t-2";

  return (
    <>
      {items.map((item) => {
        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Not built yet"
              className={`${base} ${layout === "bottom" ? "border-transparent" : ""} cursor-not-allowed font-medium text-ink-muted`}
            >
              {item.label}
            </span>
          );
        }

        // A section owns its subtree, so /admin/students/new still marks Learners.
        // The role root is matched exactly or every section would light up at once.
        const depth = item.href.split("/").length;
        const current =
          depth <= 2
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        const tone = current
          ? layout === "side"
            ? "bg-crimson-tint font-semibold text-crimson"
            : "border-crimson font-semibold text-crimson"
          : layout === "side"
            ? "font-medium text-ink-soft hover:bg-surface-dark hover:text-ink"
            : "border-transparent font-medium text-ink-soft hover:text-ink";

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`${base} ${tone} transition-colors duration-150
                        focus-visible:outline-2 focus-visible:outline-offset-2
                        focus-visible:outline-crimson`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
