import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { Alert, EmptyState } from "@/components/ui";
import { StudentFilters } from "./filters";

export const metadata: Metadata = { title: "Learners" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; archived?: string }>;
}) {
  await requireRole("admin");
  const { q, class: classFilter, archived } = await searchParams;
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

  const classOptions = [...(classes ?? [])]
    .sort((a, b) => (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0))
    .map((c) => ({
      value: c.id,
      label: `${c.grade_levels?.label ?? c.grade_code}${c.stream ? ` ${c.stream}` : ""}`,
    }));

  let query = supabase
    .from("students")
    .select("id, admission_no, first_name, last_name, is_active, enrollments(class_id, classes(grade_code, stream, grade_levels(label)))")
    .eq("is_active", archived === "1" ? false : true)
    .order("last_name")
    .limit(300);

  if (q) {
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,admission_no.ilike.%${term}%`,
      );
    }
  }

  const { data: students, error } = await query;

  const rows = (students ?? []).filter((s) =>
    classFilter ? s.enrollments?.some((e) => e.class_id === classFilter) : true,
  );

  return (
    <>
      <Toolbar
        title="Learners"
        description={year ? `Enrolled for ${year.name}.` : "No current academic year set."}
      >
        <Link
          href="/admin/students/import"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-line-strong
                     bg-white px-5 text-base font-semibold text-ink
                     transition-colors duration-150 hover:bg-surface
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-crimson"
        >
          Import
        </Link>
        <Link
          href="/admin/students/new"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-crimson px-5
                     text-base font-semibold text-white transition-colors duration-150
                     hover:bg-crimson-dark
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-crimson"
        >
          Enrol a learner
        </Link>
      </Toolbar>

      {error && (
        <div className="mb-6">
          <Alert tone="error">Could not load learners: {error.message}</Alert>
        </div>
      )}

      <Panel>
        <StudentFilters classes={classOptions} />

        <div className="mt-5">
          {rows.length === 0 ? (
            <EmptyState
              title={q || classFilter ? "No learners match that search" : "No learners yet"}
              description={
                q || classFilter
                  ? "Try a different name, admission number, or class."
                  : "Enrol learners one at a time, or import a spreadsheet from the school's existing register."
              }
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Admission no.</Th>
                  <Th>Name</Th>
                  <Th>Class</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const en = s.enrollments?.[0];
                  const cls = en?.classes;
                  return (
                    <Tr key={s.id}>
                      <Td numeric>{s.admission_no}</Td>
                      <Td>
                        <Link
                          href={`/admin/students/${s.id}`}
                          className="font-medium text-crimson underline underline-offset-4"
                        >
                          {s.first_name} {s.last_name}
                        </Link>
                      </Td>
                      <Td muted>
                        {cls
                          ? `${cls.grade_levels?.label ?? cls.grade_code}${cls.stream ? ` ${cls.stream}` : ""}`
                          : "Not enrolled"}
                      </Td>
                      <Td align="right">
                        {s.is_active ? <Pill tone="ok">Active</Pill> : <Pill>Archived</Pill>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>

        {rows.length >= 300 && (
          <p className="mt-4 text-sm text-ink-soft">
            Showing the first 300. Narrow the search to see more.
          </p>
        )}
      </Panel>
    </>
  );
}
