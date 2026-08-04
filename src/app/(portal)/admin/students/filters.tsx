"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui";

/**
 * Search and filter as a plain GET form.
 *
 * Deliberately not a live-filtering client component: state lives in the URL, so
 * a result list can be shared, bookmarked, and survives a back button. It also
 * works with JavaScript off.
 */
export function StudentFilters({ classes }: { classes: { value: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const showingArchived = params.get("archived") === "1";

  function toggleArchived() {
    const next = new URLSearchParams(params.toString());
    if (showingArchived) next.delete("archived");
    else next.set("archived", "1");
    startTransition(() => router.push(`/admin/students?${next.toString()}`));
  }

  const control =
    "min-h-[44px] rounded-lg border border-line-strong bg-white px-3.5 text-base " +
    "text-ink focus-visible:outline-2 focus-visible:outline-offset-2 " +
    "focus-visible:outline-crimson";

  return (
    <div className="flex flex-col gap-3">
      <form method="GET" action="/admin/students" className="flex flex-wrap items-end gap-3">
        {showingArchived && <input type="hidden" name="archived" value="1" />}

        <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-semibold text-ink">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.get("q") ?? ""}
            placeholder="Name or admission number"
            className={control}
          />
        </div>

        <div className="flex min-w-[12rem] flex-col gap-1.5">
          <label htmlFor="class" className="text-sm font-semibold text-ink">
            Class
          </label>
          <select id="class" name="class" defaultValue={params.get("class") ?? ""} className={control}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <div>
        <button
          type="button"
          onClick={toggleArchived}
          disabled={pending}
          className="min-h-[44px] text-sm font-semibold text-crimson underline
                     underline-offset-4 disabled:opacity-50"
        >
          {showingArchived ? "Show active learners" : "Show archived learners"}
        </button>
      </div>
    </div>
  );
}
