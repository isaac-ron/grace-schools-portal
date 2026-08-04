import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminHome() {
  const user = await requireRole("admin");
  const supabase = await createClient();

  const [{ count: students }, { count: staff }, { data: year }] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }).neq("role", "parent"),
    supabase.from("academic_years").select("name").eq("is_current", true).maybeSingle(),
  ]);

  const stats = [
    { label: "Active learners", value: students ?? 0 },
    { label: "Staff accounts", value: staff ?? 0 },
    { label: "Current year", value: year?.name ?? "Not set" },
  ];

  return (
    <>
      <PageHeader title="Overview" description={`Signed in as ${user.fullName}.`} />

      {!year && (
        <div className="mb-6">
          <Alert tone="warning">
            No academic year is marked as current. Terms, classes and marks all
            hang off the academic year, so set one before enrolling learners.
          </Alert>
        </div>
      )}

      {/* A ruled summary, not a row of KPI tiles. PRODUCT.md rules out the
          dashboard console: this is the school's own standing record, and three
          numbers do not need three boxes to be read. */}
      <dl className="grid border-y border-line bg-card sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-b border-line p-5 last:border-b-0
                       sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <dt className="doc-label">{stat.label}</dt>
            <dd className="mt-1.5 font-display text-2xl tabular text-ink">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {user.canReleaseResults && (
        <p className="mt-6 text-sm text-ink-soft">
          You hold the results release permission. Only you and others with it can
          publish a term&rsquo;s results to parents.
        </p>
      )}
    </>
  );
}
