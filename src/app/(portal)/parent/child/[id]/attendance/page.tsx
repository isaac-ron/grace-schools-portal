import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Attendance" };

const REASON: Record<string, string> = {
  sick: "Sick",
  permission: "With permission",
  unexplained: "Not explained",
};

export default async function ChildAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("parent");
  const { id } = await params;
  const supabase = await createClient();

  // RLS returns nothing for a learner this account is not linked to, so an
  // unauthorised id is a 404 rather than an error page.
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, admission_no")
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  const [{ data: summary }, { data: records }] = await Promise.all([
    supabase
      .from("attendance_term_summary")
      .select("term_id, term_name, days_recorded, days_present, days_late, days_absent, attendance_rate")
      .eq("student_id", id),
    supabase
      .from("attendance_records")
      .select("id, status, reason, attendance_sessions(session_date)")
      .eq("student_id", id)
      .order("id", { ascending: false })
      .limit(60),
  ]);

  const days = [...(records ?? [])]
    .map((r) => ({
      date: r.attendance_sessions?.session_date ?? "",
      status: r.status,
      reason: r.reason,
      id: r.id,
    }))
    .filter((d) => d.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Toolbar
        title="Attendance"
        description={`${student.first_name} ${student.last_name}`}
      >
        <Link
          href="/parent"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-line-strong
                     bg-white px-5 text-base font-semibold text-ink
                     transition-colors duration-150 hover:bg-surface"
        >
          Back
        </Link>
      </Toolbar>

      <div className="flex flex-col gap-6">
        {summary && summary.length > 0 && (
          <Panel title="This term">
            <div className="flex flex-col gap-5">
              {summary.map((s) => {
                // View aggregates are nullable in the generated types, since a
                // view column carries no NOT NULL guarantee. Normalise once here
                // rather than defending at every use.
                const recorded = s.days_recorded ?? 0;
                const present = s.days_present ?? 0;
                const late = s.days_late ?? 0;
                const absent = s.days_absent ?? 0;
                const denom = Math.max(recorded, 1);
                const pct = (n: number) => `${(n / denom) * 100}%`;

                return (
                <div key={s.term_id}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink">{s.term_name}</p>
                    <p className="text-2xl font-bold tabular text-ink">
                      {s.attendance_rate ?? 0}
                      <span className="text-base font-semibold text-ink-soft">
                        % attended
                      </span>
                    </p>
                  </div>

                  {/* A simple proportional bar rather than a chart library:
                      one number matters here, and a chart would cost the parent
                      bandwidth to say the same thing. */}
                  <div
                    className="flex h-3 w-full overflow-hidden rounded-full bg-surface-dark"
                    role="img"
                    aria-label={`${present} present, ${late} late, ${absent} absent out of ${recorded} days`}
                  >
                    <div className="bg-ok" style={{ width: pct(present) }} />
                    <div className="bg-warn" style={{ width: pct(late) }} />
                    <div className="bg-alert" style={{ width: pct(absent) }} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Days recorded", value: recorded },
                      { label: "Present", value: present },
                      { label: "Late", value: late },
                      { label: "Absent", value: absent },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-line p-3"
                      >
                        <dt className="text-sm text-ink-soft">{stat.label}</dt>
                        <dd className="mt-0.5 text-xl font-bold tabular text-ink">
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                );
              })}
            </div>
          </Panel>
        )}

        <Panel title="Day by day">
          {days.length === 0 ? (
            <EmptyState
              title="No attendance recorded yet"
              description="Attendance appears here once teachers begin taking the daily register."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Attendance</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <Tr key={d.id}>
                    <Td numeric>
                      {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Td>
                    <Td>
                      {d.status === "present" && <Pill tone="ok">Present</Pill>}
                      {d.status === "late" && <Pill tone="warn">Late</Pill>}
                      {d.status === "absent" && <Pill tone="alert">Absent</Pill>}
                    </Td>
                    <Td muted>{d.reason ? REASON[d.reason] : ""}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}
