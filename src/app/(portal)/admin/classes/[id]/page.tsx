import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { ClassTeacherForm, AssignSubjectForm, RemoveAssignment } from "./forms";

export const metadata: Metadata = { title: "Class" };

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, grade_code, stream, class_teacher_id, grade_levels(label, scale, default_entry_mode)")
    .eq("id", id)
    .maybeSingle();

  if (!cls) notFound();

  const [{ data: roster }, { data: assignments }, { data: teachers }, { data: subjects }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, students(id, admission_no, first_name, last_name, is_active)")
        .eq("class_id", id),
      supabase
        .from("staff_class_assignments")
        .select("id, profiles(full_name), subjects(code, name)")
        .eq("class_id", id),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("subjects").select("id, code, name").eq("is_active", true).order("sort_order"),
    ]);

  const title = `${cls.grade_levels?.label ?? cls.grade_code}${cls.stream ? ` ${cls.stream}` : ""}`;
  const learners = (roster ?? [])
    .map((r) => r.students)
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));

  return (
    <>
      <Toolbar
        title={title}
        description={
          cls.grade_levels?.default_entry_mode === "level"
            ? "Marked by observed level (CBE four-point scale), not by percentage."
            : `Marked by percentage on the ${
                cls.grade_levels?.scale === "eight_point" ? "eight-point" : "four-point"
              } CBE scale.`
        }
      >
        <Link
          href="/admin/classes"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)]
                     bg-white px-5 text-base font-semibold text-[var(--color-ink)]
                     transition-colors duration-150 hover:bg-[var(--color-surface)]
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-[var(--color-crimson)]"
        >
          All classes
        </Link>
      </Toolbar>

      <div className="flex flex-col gap-6">
        <Panel
          title="Class teacher"
          description="Sees the whole class and writes the class teacher remark on report cards."
        >
          <ClassTeacherForm
            classId={cls.id}
            current={cls.class_teacher_id}
            teachers={(teachers ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
          />
        </Panel>

        <Panel
          title="Subject teachers"
          description="Assigning a teacher here is what grants them sight of this class. Removing the row revokes it immediately."
        >
          {!assignments || assignments.length === 0 ? (
            <EmptyState
              title="No subject teachers assigned"
              description="Until a teacher is assigned, nobody can enter marks for this class."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Teacher</Th>
                  <Th>Learning area</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <Tr key={a.id}>
                    <Td>{a.profiles?.full_name ?? "Unknown"}</Td>
                    <Td muted>
                      {a.subjects ? `${a.subjects.name} (${a.subjects.code})` : "All subjects"}
                    </Td>
                    <Td align="right">
                      <RemoveAssignment assignmentId={a.id} classId={cls.id} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            <AssignSubjectForm
              classId={cls.id}
              teachers={(teachers ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
              subjects={(subjects ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
            />
          </div>
        </Panel>

        <Panel title={`Learners (${learners.length})`}>
          {learners.length === 0 ? (
            <EmptyState
              title="No learners enrolled"
              description="Enrol learners from the Learners page, or import a spreadsheet."
              action={
                <Link
                  href="/admin/students"
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--color-crimson)]
                             px-5 font-semibold text-white transition-colors duration-150
                             hover:bg-[var(--color-crimson-dark)]"
                >
                  Go to Learners
                </Link>
              }
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Admission no.</Th>
                  <Th>Name</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {learners.map((s) => (
                  <Tr key={s.id}>
                    <Td numeric>{s.admission_no}</Td>
                    <Td>
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="font-medium text-[var(--color-crimson)] underline underline-offset-4"
                      >
                        {s.first_name} {s.last_name}
                      </Link>
                    </Td>
                    <Td align="right">
                      {s.is_active ? <Pill tone="ok">Active</Pill> : <Pill>Archived</Pill>}
                    </Td>
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
