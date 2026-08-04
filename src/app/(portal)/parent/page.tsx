import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Home" };

export default async function ParentHome() {
  const user = await requireRole("parent");
  const supabase = await createClient();

  // RLS limits this to children linked to this guardian. No filter is written
  // here, and none is needed: the policy is the filter.
  const { data: children } = await supabase
    .from("students")
    .select("id, admission_no, first_name, last_name")
    .order("first_name");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName}`}
        description="Results appear here once the school releases them for the term."
      />

      {!children || children.length === 0 ? (
        <EmptyState
          title="No learners linked to this account yet"
          description="The school office links your children to your account. Call the office on 0720 970 572 if you expected to see someone here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {children.map((child) => (
            <li
              key={child.id}
              className="rounded-xl border border-[var(--color-line)] bg-white p-5"
            >
              <p className="text-lg font-semibold text-[var(--color-ink)]">
                {child.first_name} {child.last_name}
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-ink-soft)] tabular">
                Admission number {child.admission_no}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
