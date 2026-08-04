import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";
import {
  EditStudentForm,
  MoveClassForm,
  ArchiveToggle,
  LinkGuardianForm,
  UnlinkGuardian,
} from "../forms";

export const metadata: Metadata = { title: "Learner" };

const RELATION: Record<string, string> = {
  mother: "Mother",
  father: "Father",
  guardian: "Guardian",
  other: "Other",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, admission_no, first_name, middle_name, last_name, date_of_birth, gender, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  const { data: year } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();

  const [{ data: enrollment }, { data: guardians }, { data: classes }, { data: parents }] =
    await Promise.all([
      year
        ? supabase
            .from("enrollments")
            .select("class_id")
            .eq("student_id", id)
            .eq("academic_year_id", year.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("guardian_students")
        .select("guardian_id, relationship, is_primary, profiles(full_name, email, phone)")
        .eq("student_id", id),
      year
        ? supabase
            .from("classes")
            .select("id, grade_code, stream, grade_levels(label, sort_order)")
            .eq("academic_year_id", year.id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "parent")
        .eq("is_active", true)
        .order("full_name"),
    ]);

  const classOptions = [...(classes ?? [])]
    .sort((a, b) => (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0))
    .map((c) => ({
      value: c.id,
      label: `${c.grade_levels?.label ?? c.grade_code}${c.stream ? ` ${c.stream}` : ""}`,
    }));

  const linkedIds = new Set((guardians ?? []).map((g) => g.guardian_id));
  const parentOptions = (parents ?? [])
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ value: p.id, label: `${p.full_name}${p.email ? ` (${p.email})` : ""}` }));

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Toolbar title={fullName} description={`Admission number ${student.admission_no}`}>
        {!student.is_active && <Pill>Archived</Pill>}
        <Link
          href="/admin/students"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)]
                     bg-white px-5 text-base font-semibold text-[var(--color-ink)]
                     transition-colors duration-150 hover:bg-[var(--color-surface)]"
        >
          All learners
        </Link>
      </Toolbar>

      <div className="flex flex-col gap-6">
        <Panel title="Details">
          <EditStudentForm student={student} />
        </Panel>

        <Panel
          title="Class"
          description={year ? `Placement for ${year.name}.` : "No current academic year set."}
        >
          {classOptions.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No classes exist for the current year.
            </p>
          ) : (
            <MoveClassForm
              studentId={student.id}
              currentClassId={enrollment?.class_id ?? null}
              classes={classOptions}
            />
          )}
        </Panel>

        <Panel
          title="Guardians"
          description="Linking a parent account is what lets them see this learner. Nothing else grants it."
        >
          {!guardians || guardians.length === 0 ? (
            <EmptyState
              title="No guardians linked"
              description="Until a parent account is linked, no family member can see this learner's records."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Relationship</Th>
                  <Th>Contact</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {guardians.map((g) => (
                  <Tr key={g.guardian_id}>
                    <Td>{g.profiles?.full_name ?? "Unknown"}</Td>
                    <Td muted>{RELATION[g.relationship] ?? g.relationship}</Td>
                    <Td muted>{g.profiles?.phone ?? g.profiles?.email ?? "Not recorded"}</Td>
                    <Td align="right">
                      <UnlinkGuardian studentId={student.id} guardianId={g.guardian_id} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            <LinkGuardianForm studentId={student.id} parents={parentOptions} />
          </div>
        </Panel>

        <Panel
          title={student.is_active ? "Archive" : "Restore"}
          description={
            student.is_active
              ? "Archiving keeps every mark, register entry and report card. It only removes the learner from active lists."
              : "This learner is archived and hidden from active lists."
          }
        >
          <ArchiveToggle student={student} />
        </Panel>
      </div>
    </>
  );
}
