import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel } from "@/components/table";
import { Alert, EmptyState } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  await requireRole("teacher", "admin");
  const { class: classId, date: rawDate } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate ?? "") ? rawDate! : today();
  const supabase = await createClient();

  // RLS limits this to classes the teacher is actually assigned to.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, grade_code, stream, grade_levels(label, sort_order)")
    .order("grade_code");

  const options = [...(classes ?? [])].sort(
    (a, b) => (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0),
  );

  const selected = classId ? options.find((c) => c.id === classId) : options[0];

  if (!selected) {
    return (
      <>
        <Toolbar title="Register" />
        <EmptyState
          title="No classes assigned to you"
          description="Administration assigns classes. Once that is done, your daily register appears here."
        />
      </>
    );
  }

  const [{ data: roster }, { data: session }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("students(id, admission_no, first_name, last_name, is_active)")
      .eq("class_id", selected.id),
    supabase
      .from("attendance_sessions")
      .select("id, taken_at, attendance_records(student_id, status, reason)")
      .eq("class_id", selected.id)
      .eq("session_date", date)
      .maybeSingle(),
  ]);

  const learners = (roster ?? [])
    .map((r) => r.students)
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.is_active)
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  const existing: Record<string, { status: "present" | "absent" | "late"; reason: null | "sick" | "permission" | "unexplained" }> = {};
  for (const r of session?.attendance_records ?? []) {
    existing[r.student_id] = { status: r.status, reason: r.reason };
  }

  const label = `${selected.grade_levels?.label ?? selected.grade_code}${selected.stream ? ` ${selected.stream}` : ""}`;
  const isFuture = date > today();

  return (
    <>
      <Toolbar
        title="Daily register"
        description="Everyone starts marked present. Change only the exceptions, then save."
      />

      <div className="mb-6 flex flex-col gap-4">
        <form method="GET" action="/teacher/register" className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[12rem] flex-col gap-1.5">
            <label htmlFor="class" className="text-sm font-semibold text-ink">
              Class
            </label>
            <select
              id="class"
              name="class"
              defaultValue={selected.id}
              className="min-h-[44px] rounded-lg border border-line-strong bg-white px-3.5 text-base
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade_levels?.label ?? c.grade_code}
                  {c.stream ? ` ${c.stream}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="date" className="text-sm font-semibold text-ink">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={date}
              max={today()}
              className="min-h-[44px] rounded-lg border border-line-strong bg-white px-3.5 text-base
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] rounded-lg border border-line-strong bg-white px-5
                       text-base font-semibold text-ink transition-colors duration-150
                       hover:bg-surface"
          >
            Show
          </button>
        </form>

        {session && (
          <p className="text-sm text-ink-soft">
            Already taken{" "}
            {new Date(session.taken_at).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Saving again replaces it.
          </p>
        )}
      </div>

      {isFuture ? (
        <Alert tone="warning">A register cannot be taken for a future date.</Alert>
      ) : learners.length === 0 ? (
        <Panel>
          <EmptyState
            title="No learners in this class"
            description="Nobody is enrolled here yet, so there is no register to take."
            action={
              <Link
                href="/teacher"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-crimson
                           px-5 font-semibold text-white hover:bg-crimson-dark"
              >
                Back to today
              </Link>
            }
          />
        </Panel>
      ) : (
        <RegisterForm
          classId={selected.id}
          className={label}
          date={date}
          learners={learners}
          existing={existing}
        />
      )}
    </>
  );
}
