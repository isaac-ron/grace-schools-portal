"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin-guard";
import type { ActionState } from "@/components/form";

const schema = z
  .object({
    from_year: z.uuid({ error: "Choose the year to promote from" }),
    to_year: z.uuid({ error: "Choose the year to promote into" }),
    confirm: z.literal("PROMOTE", {
      error: "Type PROMOTE in capitals to confirm",
    }),
  })
  .refine((v) => v.from_year !== v.to_year, {
    error: "The two years must be different",
    path: ["to_year"],
  });

/**
 * Runs the whole promotion inside one database function.
 *
 * Deliberately not a loop of calls from here: moving a thousand learners over
 * hundreds of round trips, then failing halfway, would leave the school in a
 * state nobody can reason about. The function either places everyone or raises
 * and places nobody.
 */
export async function runPromotion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(schema, formData, async (input, supabase) => {
    const { data, error } = await supabase.rpc("promote_school", {
      p_from_year: input.from_year,
      p_to_year: input.to_year,
    });

    if (error) return { error: error.message };

    const moved = typeof data === "number" ? data : 0;
    revalidatePath("/admin/promotion");
    revalidatePath("/admin/students");
    revalidatePath("/admin/classes");

    if (moved === 0) {
      return {
        ok: "Nothing to do. Every eligible learner is already placed in the destination year.",
      };
    }
    return {
      ok: `Promoted ${moved} learner${moved === 1 ? "" : "s"}. Grade 9 learners were left in place.`,
    };
  });
}
