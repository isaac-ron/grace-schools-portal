"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, dbError } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const PATH = "/admin/notices";

const noticeSchema = z
  .object({
    title: z.string().trim().min(1, { error: "Give the notice a title" }).max(160),
    body: z.string().trim().min(1, { error: "Write the notice" }).max(4000),
    audience: z.enum(["all_parents", "all_staff", "single_class"]),
    class_id: z.uuid().optional(),
    publish_now: z.literal("on").optional(),
  })
  .refine((v) => v.audience !== "single_class" || Boolean(v.class_id), {
    error: "Choose which class this is for",
    path: ["class_id"],
  });

export async function createNotice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(noticeSchema, formData, async (input, supabase, actorId) => {
    const { error } = await supabase.from("notices").insert({
      title: input.title,
      body: input.body,
      audience: input.audience,
      // The schema requires class_id exactly when the audience is a single class.
      class_id: input.audience === "single_class" ? (input.class_id ?? null) : null,
      published_at: input.publish_now === "on" ? new Date().toISOString() : null,
      created_by: actorId,
    });
    if (error) return dbError(error);
    revalidatePath(PATH);
    return {
      ok:
        input.publish_now === "on"
          ? "Notice published. Parents can see it now."
          : "Notice saved as a draft. Publish it when you are ready.",
    };
  });
}

export async function setNoticePublished(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return adminAction(
    z.object({ id: z.uuid(), publish: z.enum(["true", "false"]) }),
    formData,
    async (input, supabase) => {
      const publish = input.publish === "true";
      const { error } = await supabase
        .from("notices")
        .update({ published_at: publish ? new Date().toISOString() : null })
        .eq("id", input.id);
      if (error) return dbError(error);
      revalidatePath(PATH);
      return { ok: publish ? "Notice published." : "Notice withdrawn." };
    },
  );
}
