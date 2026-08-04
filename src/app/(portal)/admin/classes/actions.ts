"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const PATH = "/admin/classes";

const classSchema = z.object({
  academic_year_id: z.uuid({ error: "Choose an academic year" }),
  grade_code: z.string().trim().min(1, { error: "Choose a grade" }),
  // A single-stream school leaves this blank, which stores NULL rather than "".
  stream: z.string().trim().optional(),
  class_teacher_id: z.uuid().optional(),
});

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(classSchema, formData, async (input, supabase) => {
    const { error } = await supabase.from("classes").insert({
      academic_year_id: input.academic_year_id,
      grade_code: input.grade_code,
      stream: input.stream || null,
      class_teacher_id: input.class_teacher_id || null,
    });
    if (error) {
      if (error.code === "23505") {
        return { error: "That grade and stream already exists for this year." };
      }
      return dbError(error);
    }
    revalidatePath(PATH);
    return { ok: "Class created." };
  });
}

export async function setClassTeacher(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({
      class_id: z.uuid(),
      class_teacher_id: z.uuid().optional(),
    }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase
        .from("classes")
        .update({ class_teacher_id: input.class_teacher_id || null })
        .eq("id", input.class_id);
      if (error) return dbError(error);
      revalidatePath(PATH);
      revalidatePath(`${PATH}/${input.class_id}`);
      return { ok: "Class teacher updated." };
    },
  );
}

/**
 * Subject teaching assignment.
 *
 * This table is what every teacher-facing RLS policy resolves through, so
 * adding a row here is what actually grants a teacher sight of a class. Removing
 * one revokes it immediately.
 */
export async function assignSubjectTeacher(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({
      class_id: z.uuid(),
      staff_id: z.uuid({ error: "Choose a teacher" }),
      subject_id: z.uuid({ error: "Choose a subject" }),
    }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase.from("staff_class_assignments").insert(input);
      if (error) {
        if (error.code === "23505") return { error: "That teacher already has this subject." };
        return dbError(error);
      }
      revalidatePath(`${PATH}/${input.class_id}`);
      return { ok: "Teacher assigned." };
    },
  );
}

export async function removeSubjectTeacher(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ assignment_id: z.uuid(), class_id: z.uuid() }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase
        .from("staff_class_assignments")
        .delete()
        .eq("id", input.assignment_id);
      if (error) return dbError(error);
      revalidatePath(`${PATH}/${input.class_id}`);
      return { ok: "Assignment removed. That teacher can no longer see this class." };
    },
  );
}

const subjectSchema = z.object({
  code: z.string().trim().min(1).max(12).toUpperCase(),
  name: z.string().trim().min(1, { error: "Give the learning area a name" }),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export async function createSubject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(subjectSchema, formData, async (input, supabase) => {
    const { error } = await supabase.from("subjects").insert(input);
    if (error) {
      if (error.code === "23505") return { error: "That subject code already exists." };
      return dbError(error);
    }
    revalidatePath("/admin/classes/subjects");
    return { ok: `${input.name} added.` };
  });
}
