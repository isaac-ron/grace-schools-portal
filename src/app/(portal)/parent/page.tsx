import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { Panel, Pill } from "@/components/table";

export const metadata: Metadata = { title: "Home" };

export default async function ParentHome() {
  const user = await requireRole("parent");
  const supabase = await createClient();

  // RLS limits this to children linked to this guardian. No filter is written
  // here, and none is needed: the policy is the filter.
  const [{ data: children }, { data: notices }] = await Promise.all([
    supabase
      .from("students")
      .select("id, admission_no, first_name, last_name, enrollments(classes(grade_code, stream, grade_levels(label)))")
      .order("first_name"),
    supabase
      .from("notices")
      .select("id, title, body, published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);

  const ids = (children ?? []).map((c) => c.id);
  const { data: summaries } = ids.length
    ? await supabase
        .from("attendance_term_summary")
        .select("student_id, term_name, attendance_rate, days_absent")
        .in("student_id", ids)
    : { data: [] };

  const byStudent = new Map((summaries ?? []).map((s) => [s.student_id, s]));

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
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3">
            {children.map((child) => {
              const cls = child.enrollments?.[0]?.classes;
              const att = byStudent.get(child.id);
              return (
                <li
                  key={child.id}
                  className="rounded-xl border border-line bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {child.first_name} {child.last_name}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {cls
                          ? `${cls.grade_levels?.label ?? cls.grade_code}${cls.stream ? ` ${cls.stream}` : ""}`
                          : "Not enrolled"}
                        <span className="tabular"> · {child.admission_no}</span>
                      </p>
                    </div>
                    {att && (
                      <Pill tone={Number(att.attendance_rate) >= 90 ? "ok" : "warn"}>
                        {att.attendance_rate}% attended
                      </Pill>
                    )}
                  </div>

                  {att && Number(att.days_absent) > 0 && (
                    <p className="mt-3 text-sm text-ink-soft">
                      {att.days_absent} day{Number(att.days_absent) === 1 ? "" : "s"} absent this
                      term.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/parent/child/${child.id}/attendance`}
                      className="inline-flex min-h-[44px] items-center rounded-lg border
                                 border-line-strong bg-white px-5 text-base font-semibold
                                 text-ink transition-colors duration-150
                                 hover:bg-surface
                                 focus-visible:outline-2 focus-visible:outline-offset-2
                                 focus-visible:outline-crimson"
                    >
                      Attendance
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          {notices && notices.length > 0 && (
            <Panel title="From the school">
              <ul className="flex flex-col gap-4">
                {notices.map((n) => (
                  <li key={n.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <p className="font-semibold text-ink">{n.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-pretty text-ink-soft">
                      {n.body}
                    </p>
                    {n.published_at && (
                      <p className="mt-1.5 text-xs text-ink-muted tabular">
                        {new Date(n.published_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                        })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
