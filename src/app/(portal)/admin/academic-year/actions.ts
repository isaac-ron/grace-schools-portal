"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const PATH = "/admin/academic-year";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a valid date" });

const yearSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Give the year a name, for example 2027" }),
    starts_on: dateStr,
    ends_on: dateStr,
  })
  .refine((v) => v.ends_on > v.starts_on, {
    error: "The end date must be after the start date",
    path: ["ends_on"],
  });

export async function createAcademicYear(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(yearSchema, formData, async (input, supabase) => {
    const { error } = await supabase.from("academic_years").insert(input);
    if (error) return dbError(error);
    revalidatePath(PATH);
    return { ok: `Academic year ${input.name} created.` };
  });
}

const termSchema = z
  .object({
    academic_year_id: z.uuid({ error: "Choose an academic year" }),
    name: z.string().trim().min(1, { error: "Give the term a name" }),
    term_number: z.coerce.number().int().min(1).max(3),
    starts_on: dateStr,
    ends_on: dateStr,
  })
  .refine((v) => v.ends_on > v.starts_on, {
    error: "The end date must be after the start date",
    path: ["ends_on"],
  });

export async function createTerm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(termSchema, formData, async (input, supabase) => {
    const { error } = await supabase.from("terms").insert(input);
    if (error) return dbError(error);
    revalidatePath(PATH);
    return { ok: `${input.name} created.` };
  });
}

/**
 * Switching the current year or term goes through a database function so the
 * old current is cleared and the new one set in one transaction. Doing it as
 * two calls from here can leave the school with no current year at all.
 */
export async function setCurrentYear(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ year_id: z.uuid() }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase.rpc("set_current_academic_year", {
        p_year_id: input.year_id,
      });
      if (error) return dbError(error);
      revalidatePath(PATH);
      revalidatePath("/admin");
      return { ok: "Current academic year updated." };
    },
  );
}

export async function setCurrentTerm(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ term_id: z.uuid() }),
    formData,
    async (input, supabase) => {
      const { error } = await supabase.rpc("set_current_term", { p_term_id: input.term_id });
      if (error) return dbError(error);
      revalidatePath(PATH);
      revalidatePath("/admin");
      return { ok: "Current term updated." };
    },
  );
}
