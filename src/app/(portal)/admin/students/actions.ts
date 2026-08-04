"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const PATH = "/admin/students";

const nameField = (label: string) =>
  z.string().trim().min(1, { error: `${label} is required` }).max(80);

const studentSchema = z.object({
  admission_no: z.string().trim().min(1, { error: "Admission number is required" }).max(40),
  first_name: nameField("First name"),
  middle_name: z.string().trim().max(80).optional(),
  last_name: nameField("Last name"),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a valid date" })
    .optional(),
  gender: z.enum(["male", "female"]).optional(),
  class_id: z.uuid({ error: "Choose a class" }),
});

/**
 * Enrol a learner.
 *
 * The student row and the enrollment are two writes. If the enrollment fails,
 * the student is removed again rather than left orphaned outside any class,
 * where they would be invisible to every teacher-facing policy.
 */
export async function createStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let newId: string | null = null;

  const result = await adminAction(studentSchema, formData, async (input, supabase) => {
    const { data: cls, error: clsError } = await supabase
      .from("classes")
      .select("id, academic_year_id")
      .eq("id", input.class_id)
      .maybeSingle();
    if (clsError) return dbError(clsError);
    if (!cls) return { error: "That class no longer exists." };

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        admission_no: input.admission_no,
        first_name: input.first_name,
        middle_name: input.middle_name || null,
        last_name: input.last_name,
        date_of_birth: input.date_of_birth || null,
        gender: input.gender || null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return { error: "That admission number is already in use." };
      return dbError(error);
    }

    const { error: enrollError } = await supabase.from("enrollments").insert({
      student_id: student.id,
      class_id: cls.id,
      academic_year_id: cls.academic_year_id,
    });

    if (enrollError) {
      await supabase.from("students").delete().eq("id", student.id);
      return { error: `Could not place the learner in that class: ${enrollError.message}` };
    }

    newId = student.id;
    revalidatePath(PATH);
    return { ok: "Learner enrolled." };
  });

  if (newId) redirect(`${PATH}/${newId}`);
  return result;
}

export async function updateStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(
    studentSchema.omit({ class_id: true }).extend({ id: z.uuid() }),
    formData,
    async (input, supabase) => {
      const { id, ...fields } = input;
      const { error } = await supabase
        .from("students")
        .update({
          ...fields,
          middle_name: fields.middle_name || null,
          date_of_birth: fields.date_of_birth || null,
          gender: fields.gender || null,
        })
        .eq("id", id);
      if (error) {
        if (error.code === "23505") return { error: "That admission number is already in use." };
        return dbError(error);
      }
      revalidatePath(`${PATH}/${id}`);
      revalidatePath(PATH);
      return { ok: "Learner updated." };
    },
  );
}

/**
 * Archive rather than delete.
 *
 * Deleting a learner would cascade away their marks, attendance and report
 * cards, which is exactly the history a school needs to keep. Archiving hides
 * them from lists and leaves the record intact.
 */
export async function setStudentActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ id: z.uuid(), is_active: z.enum(["true", "false"]) }),
    formData,
    async (input, supabase) => {
      const active = input.is_active === "true";
      const { error } = await supabase
        .from("students")
        .update({ is_active: active })
        .eq("id", input.id);
      if (error) return dbError(error);
      revalidatePath(`${PATH}/${input.id}`);
      revalidatePath(PATH);
      return { ok: active ? "Learner restored." : "Learner archived. Their records are kept." };
    },
  );
}

export async function moveStudentClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ student_id: z.uuid(), class_id: z.uuid({ error: "Choose a class" }) }),
    formData,
    async (input, supabase) => {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, academic_year_id")
        .eq("id", input.class_id)
        .maybeSingle();
      if (!cls) return { error: "That class no longer exists." };

      // One enrollment per learner per year, so this replaces rather than adds.
      const { error } = await supabase
        .from("enrollments")
        .update({ class_id: cls.id })
        .eq("student_id", input.student_id)
        .eq("academic_year_id", cls.academic_year_id);

      if (error) return dbError(error);
      revalidatePath(`${PATH}/${input.student_id}`);
      return { ok: "Learner moved." };
    },
  );
}

export async function linkGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(
    z.object({
      student_id: z.uuid(),
      guardian_id: z.uuid({ error: "Choose a parent account" }),
      relationship: z.enum(["mother", "father", "guardian", "other"]),
    }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase.from("guardian_students").insert(input);
      if (error) {
        if (error.code === "23505") return { error: "That guardian is already linked." };
        return dbError(error);
      }
      revalidatePath(`${PATH}/${input.student_id}`);
      return { ok: "Guardian linked. They can now see this learner." };
    },
  );
}

export async function unlinkGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(
    z.object({ student_id: z.uuid(), guardian_id: z.uuid() }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase
        .from("guardian_students")
        .delete()
        .eq("student_id", input.student_id)
        .eq("guardian_id", input.guardian_id);
      if (error) return dbError(error);
      revalidatePath(`${PATH}/${input.student_id}`);
      return { ok: "Guardian unlinked. They can no longer see this learner." };
    },
  );
}
