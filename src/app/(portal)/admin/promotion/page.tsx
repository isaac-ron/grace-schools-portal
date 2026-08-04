import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr } from "@/components/table";
import { Alert } from "@/components/ui";
import { PromotionForm } from "./forms";

export const metadata: Metadata = { title: "Year-end promotion" };

export default async function PromotionPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: years } = await supabase
    .from("academic_years")
    .select("id, name, is_current")
    .order("starts_on", { ascending: false });

  const current = (years ?? []).find((y) => y.is_current);

  // How many learners sit in each grade right now, so the office can sanity
  // check the shape of the roll before moving a thousand children.
  const { data: enrollments } = current
    ? await supabase
        .from("enrollments")
        .select("student_id, classes(grade_code, grade_levels(label, sort_order)), students(is_active)")
        .eq("academic_year_id", current.id)
    : { data: [] };

  const byGrade = new Map<string, { label: string; sort: number; count: number }>();
  for (const e of enrollments ?? []) {
    if (!e.students?.is_active) continue;
    const code = e.classes?.grade_code ?? "?";
    const entry = byGrade.get(code) ?? {
      label: e.classes?.grade_levels?.label ?? code,
      sort: e.classes?.grade_levels?.sort_order ?? 0,
      count: 0,
    };
    entry.count++;
    byGrade.set(code, entry);
  }
  const gradeRows = [...byGrade.entries()].sort((a, b) => a[1].sort - b[1].sort);

  return (
    <>
      <Toolbar
        title="Year-end promotion"
        description="Moves every active learner up one grade into the next academic year, in one action."
      />

      <div className="flex flex-col gap-6">
        <Panel title="How this behaves">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-soft">
            <li>Grade 9 learners are not promoted. They finish junior school and are left for the office to archive or transfer deliberately.</li>
            <li>Stream is kept when the same stream exists in the new year, otherwise the learner lands in that grade&rsquo;s first class.</li>
            <li>Learners already placed in the destination year are skipped, so running it twice is safe and a partial run can be resumed.</li>
            <li>If a destination class is missing, nothing is moved at all and you are told which grade to create.</li>
            <li>Marks, attendance and report cards stay attached to the year they happened in.</li>
          </ul>
        </Panel>

        {current && gradeRows.length > 0 && (
          <Panel title={`Current roll (${current.name})`}>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Grade</Th>
                  <Th align="right">Active learners</Th>
                </tr>
              </thead>
              <tbody>
                {gradeRows.map(([code, g]) => (
                  <Tr key={code}>
                    <Td>{g.label}</Td>
                    <Td align="right" numeric>
                      {g.count}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </Panel>
        )}

        <Panel title="Run promotion">
          {!years || years.length < 2 ? (
            <Alert tone="warning">
              You need at least two academic years before promoting. Create next year on the{" "}
              <Link href="/admin/academic-year" className="underline underline-offset-4">
                academic year page
              </Link>
              , then create its classes.
            </Alert>
          ) : (
            <PromotionForm
              years={years.map((y) => ({
                value: y.id,
                label: y.is_current ? `${y.name} (current)` : y.name,
              }))}
              currentId={current?.id}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
