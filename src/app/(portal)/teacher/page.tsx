import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Today" };

export default async function TeacherHome() {
  const user = await requireRole("teacher");
  const supabase = await createClient();

  // RLS limits classes to those this teacher is assigned to or is class teacher of.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, grade_code, stream, grade_levels(label, sort_order)")
    .order("grade_code");

  return (
    <>
      <PageHeader
        title={`Good morning, ${user.fullName}`}
        description="Your classes for the current year."
      />

      {!classes || classes.length === 0 ? (
        <EmptyState
          title="No classes assigned yet"
          description="Administration assigns classes and subjects. Once that is done, your registers and mark sheets appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((cls) => (
            <li
              key={cls.id}
              className="rounded-xl border border-[var(--color-line)] bg-white p-5"
            >
              <p className="text-lg font-semibold text-[var(--color-ink)]">
                {cls.grade_levels?.label ?? cls.grade_code}
                {cls.stream ? ` ${cls.stream}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
