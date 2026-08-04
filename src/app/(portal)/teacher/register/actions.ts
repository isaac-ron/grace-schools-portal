"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type RegisterResult = { ok: true; sessionId: string } | { ok: false; error: string };

const recordSchema = z.object({
  student_id: z.uuid(),
  status: z.enum(["present", "absent", "late"]),
  reason: z.enum(["sick", "permission", "unexplained"]).nullable().optional(),
});

const payloadSchema = z.object({
  class_id: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(recordSchema).min(1).max(200),
});

export type RegisterPayload = z.infer<typeof payloadSchema>;

/**
 * Saves a register.
 *
 * Called directly from the client component rather than through a form action,
 * so that a network failure surfaces as a thrown fetch error the caller can
 * catch and queue. A form action would swallow that distinction, and telling a
 * teacher "saved" when nothing reached the server is the one outcome this
 * feature cannot have.
 *
 * The whole register is one RPC, so a retry after a dropped connection either
 * applies fully or not at all.
 */
export async function saveRegister(payload: RegisterPayload): Promise<RegisterResult> {
  const user = await requireRole("teacher", "admin");

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "That register could not be read. Reload the page and try again." };
  }

  const { class_id, date, records } = parsed.data;

  // A reason only belongs on an absence; strip it elsewhere so the database
  // check constraint never has to reject an otherwise valid save.
  const clean = records.map((r) => ({
    student_id: r.student_id,
    status: r.status,
    reason: r.status === "absent" ? (r.reason ?? "unexplained") : null,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_register", {
    p_class_id: class_id,
    p_date: date,
    p_records: clean,
  });

  if (error) {
    // Row Level Security returns an empty result rather than a permission error
    // on some paths, so surface the database's own message: the enrollment and
    // future-date checks are written for a human to read.
    return { ok: false, error: error.message };
  }

  revalidatePath("/teacher");
  revalidatePath(`/teacher/register`);
  void user;
  return { ok: true, sessionId: data as unknown as string };
}
