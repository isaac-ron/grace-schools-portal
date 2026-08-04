import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { Alert, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Attendance" };

/** Below this, a learner is flagged for the office to follow up. */
const CONCERN_THRESHOLD = 90;

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; term?: string }>;
}) {
  await requireRole("admin");
  const { class: classFilter, term: termFilter } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: year } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();

  if (!year) {
    return (
      <>
        <Toolbar title="Attendance" />
        <Alert tone="warning">
          No academic year is marked as current. Set one on the{" "}
          <Link href="/admin/academic-year" className="underline underline-offset-4">
            academic year page
          </Link>
          .
        </Alert>
      </>
    );
  }

  const [{ data: classes }, { data: terms }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, grade_code, stream, grade_levels(label, sort_order)")
      .eq("academic_year_id", year.id),
    supabase
      .from("terms")
      .select("id, name, is_current")
      .eq("academic_year_id", year.id)
      .order("term_number"),
  ]);

  const sortedClasses = [...(classes ?? [])].sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      (a.stream ?? "").localeCompare(b.stream ?? ""),
  );
  const classLabel = (c: (typeof sortedClasses)[number]) =>
    `${c.grade_levels?.label ?? c.grade_code}${c.stream ? ` ${c.stream}` : ""}`;

  const term = termFilter
    ? terms?.find((t) => t.id === termFilter)
    : (terms?.find((t) => t.is_current) ?? terms?.[0]);

  // Today's register compliance, which is the number the office actually chases.
  const classIds = sortedClasses.map((c) => c.id);
  const { data: todaySessions } = classIds.length
    ? await supabase
        .from("attendance_sessions")
        .select("class_id")
        .eq("session_date", today)
        .in("class_id", classIds)
    : { data: [] };
  const takenToday = new Set((todaySessions ?? []).map((s) => s.class_id));
  const missing = sortedClasses.filter((c) => !takenToday.has(c.id));

  let rows: {
    student_id: string;
    name: string;
    admission_no: string;
    className: string;
    recorded: number;
    present: number;
    late: number;
    absent: number;
    unexplained: number;
    rate: number;
  }[] = [];

  if (term) {
    let q = supabase
      .from("attendance_term_summary")
      .select(
        "student_id, class_id, days_recorded, days_present, days_late, days_absent, days_unexplained, attendance_rate, students(first_name, last_name, admission_no)",
      )
      .eq("term_id", term.id);

    if (classFilter) q = q.eq("class_id", classFilter);

    const { data: summary } = await q;
    const labelById = new Map(sortedClasses.map((c) => [c.id, classLabel(c)]));

    rows = (summary ?? [])
      .map((s) => ({
        student_id: s.student_id!,
        name: `${s.students?.last_name ?? ""}, ${s.students?.first_name ?? ""}`,
        admission_no: s.students?.admission_no ?? "",
        className: labelById.get(s.class_id!) ?? "",
        recorded: s.days_recorded ?? 0,
        present: s.days_present ?? 0,
        late: s.days_late ?? 0,
        absent: s.days_absent ?? 0,
        unexplained: s.days_unexplained ?? 0,
        rate: Number(s.attendance_rate ?? 0),
      }))
      .sort((a, b) => a.rate - b.rate || a.name.localeCompare(b.name));
  }

  const concerns = rows.filter((r) => r.rate < CONCERN_THRESHOLD);

  const control =
    "min-h-[44px] rounded-lg border border-line-strong bg-white px-3.5 text-base " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson";

  return (
    <>
      <Toolbar
        title="Attendance"
        description={`${year.name}. Late counts as attending; only absence reduces the rate.`}
      />

      <div className="flex flex-col gap-6">
        <Panel title="Registers today">
          {sortedClasses.length === 0 ? (
            <p className="text-sm text-ink-soft">No classes for this year yet.</p>
          ) : missing.length === 0 ? (
            <Alert tone="success">
              Every class has taken its register today.
            </Alert>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-soft">
                {missing.length} of {sortedClasses.length} class
                {sortedClasses.length === 1 ? "" : "es"} have not taken a register today.
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((c) => (
                  <Pill key={c.id} tone="warn">
                    {classLabel(c)}
                  </Pill>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="By term">
          <form method="GET" action="/admin/attendance" className="mb-5 flex flex-wrap items-end gap-3">
            <div className="flex min-w-[10rem] flex-col gap-1.5">
              <label htmlFor="term" className="text-sm font-semibold text-ink">
                Term
              </label>
              <select id="term" name="term" defaultValue={term?.id ?? ""} className={control}>
                {(terms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[12rem] flex-col gap-1.5">
              <label htmlFor="class" className="text-sm font-semibold text-ink">
                Class
              </label>
              <select id="class" name="class" defaultValue={classFilter ?? ""} className={control}>
                <option value="">All classes</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="min-h-[44px] rounded-lg border border-line-strong bg-white px-5
                         text-base font-semibold text-ink transition-colors duration-150 hover:bg-surface"
            >
              Show
            </button>
          </form>

          {!term ? (
            <Alert tone="warning">
              No terms exist for {year.name}. Attendance is grouped by term, so add them on the{" "}
              <Link href="/admin/academic-year" className="underline underline-offset-4">
                academic year page
              </Link>
              .
            </Alert>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No attendance recorded for this term"
              description="Figures appear here once teachers begin taking registers. Note that a register taken outside any term's date range will not be counted."
            />
          ) : (
            <>
              {concerns.length > 0 && (
                <div className="mb-5">
                  <Alert tone="warning">
                    {concerns.length} learner{concerns.length === 1 ? "" : "s"} below{" "}
                    {CONCERN_THRESHOLD}% attendance this term. They are listed first.
                  </Alert>
                </div>
              )}

              <TableWrap>
                <thead>
                  <tr>
                    <Th>Learner</Th>
                    <Th>Class</Th>
                    <Th align="right">Days</Th>
                    <Th align="right">Present</Th>
                    <Th align="right">Late</Th>
                    <Th align="right">Absent</Th>
                    <Th align="right">Unexplained</Th>
                    <Th align="right">Rate</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.student_id}>
                      <Td>
                        <Link
                          href={`/admin/students/${r.student_id}`}
                          className="font-medium text-crimson underline underline-offset-4"
                        >
                          {r.name}
                        </Link>
                      </Td>
                      <Td muted>{r.className}</Td>
                      <Td align="right" numeric muted>
                        {r.recorded}
                      </Td>
                      <Td align="right" numeric>
                        {r.present}
                      </Td>
                      <Td align="right" numeric>
                        {r.late}
                      </Td>
                      <Td align="right" numeric>
                        {r.absent}
                      </Td>
                      <Td align="right" numeric>
                        {r.unexplained > 0 ? <Pill tone="alert">{r.unexplained}</Pill> : "0"}
                      </Td>
                      <Td align="right" numeric>
                        <Pill tone={r.rate >= CONCERN_THRESHOLD ? "ok" : "warn"}>{r.rate}%</Pill>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
