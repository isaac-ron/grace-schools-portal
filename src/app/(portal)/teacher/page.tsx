import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { Pill } from "@/components/table";
import { PendingRegisterNotice } from "./pending-notice";

export const metadata: Metadata = { title: "Today" };

export default async function TeacherHome() {
  const user = await requireRole("teacher", "admin");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // RLS limits classes to those this teacher is assigned to or is class teacher of.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, grade_code, stream, grade_levels(label, sort_order), enrollments(count)")
    .order("grade_code");

  const ids = (classes ?? []).map((c) => c.id);
  const { data: sessions } = ids.length
    ? await supabase
        .from("attendance_sessions")
        .select("class_id, taken_at")
        .eq("session_date", today)
        .in("class_id", ids)
    : { data: [] };

  const takenToday = new Map((sessions ?? []).map((s) => [s.class_id, s.taken_at]));

  const sorted = [...(classes ?? [])].sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      (a.stream ?? "").localeCompare(b.stream ?? ""),
  );

  const outstanding = sorted.filter((c) => !takenToday.has(c.id)).length;

  const greeting = new Date().getHours() < 12 ? "Good morning" : "Good afternoon";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.fullName}`}
        description={
          sorted.length === 0
            ? undefined
            : outstanding === 0
              ? "Every register is done for today."
              : `${outstanding} register${outstanding === 1 ? "" : "s"} still to take today.`
        }
      />

      <PendingRegisterNotice />

      {sorted.length === 0 ? (
        <EmptyState
          title="No classes assigned yet"
          description="Administration assigns classes and subjects. Once that is done, your registers and mark sheets appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((cls) => {
            const taken = takenToday.get(cls.id);
            const label = `${cls.grade_levels?.label ?? cls.grade_code}${cls.stream ? ` ${cls.stream}` : ""}`;
            const count = cls.enrollments?.[0]?.count ?? 0;

            return (
              <li
                key={cls.id}
                className="flex flex-col gap-4 rounded-xl border border-line
                           bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {count} learner{count === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {taken ? (
                    <Pill tone="ok">
                      Taken{" "}
                      {new Date(taken).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Pill>
                  ) : (
                    <Pill tone="warn">Not taken</Pill>
                  )}

                  <Link
                    href={`/teacher/register?class=${cls.id}`}
                    className={`inline-flex min-h-[44px] items-center rounded-lg px-5 text-base font-semibold
                                transition-colors duration-150
                                focus-visible:outline-2 focus-visible:outline-offset-2
                                focus-visible:outline-crimson
                                ${
                                  taken
                                    ? "border border-line-strong bg-white text-ink hover:bg-surface"
                                    : "bg-crimson text-white hover:bg-crimson-dark"
                                }`}
                  >
                    {taken ? "View register" : "Take register"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
