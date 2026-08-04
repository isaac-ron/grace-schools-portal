import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel } from "@/components/table";
import { Alert } from "@/components/ui";
import { NewStudentForm } from "../forms";

export const metadata: Metadata = { title: "Enrol a learner" };

export default async function NewStudentPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: year } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();

  const { data: classes } = year
    ? await supabase
        .from("classes")
        .select("id, grade_code, stream, grade_levels(label, sort_order)")
        .eq("academic_year_id", year.id)
    : { data: [] };

  const options = [...(classes ?? [])]
    .sort((a, b) => (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0))
    .map((c) => ({
      value: c.id,
      label: `${c.grade_levels?.label ?? c.grade_code}${c.stream ? ` ${c.stream}` : ""}`,
    }));

  return (
    <>
      <Toolbar title="Enrol a learner">
        <Link
          href="/admin/students"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-line-strong
                     bg-white px-5 text-base font-semibold text-ink
                     transition-colors duration-150 hover:bg-surface"
        >
          Cancel
        </Link>
      </Toolbar>

      {!year ? (
        <Alert tone="warning">
          Set a current academic year before enrolling learners.
        </Alert>
      ) : options.length === 0 ? (
        <Alert tone="warning">
          There are no classes for {year.name} yet. Create at least one on the{" "}
          <Link href="/admin/classes" className="underline underline-offset-4">
            classes page
          </Link>
          .
        </Alert>
      ) : (
        <Panel>
          <NewStudentForm classes={options} />
        </Panel>
      )}
    </>
  );
}
