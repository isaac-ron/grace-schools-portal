"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCsvRecords } from "@/lib/csv";

export type FeeState =
  | { error?: string; ok?: string; unmatched?: string[]; matched?: number }
  | undefined;

/**
 * Fee balances are display only (see PORTAL_SCOPE.md section 3).
 *
 * The bursar keeps the real ledger in whatever system they already use and
 * uploads a snapshot here. Parents see the figure alongside its "as of" date, so
 * a stale number is never mistaken for a live one, which is the whole reason
 * this is a snapshot rather than a half-built accounting module.
 */
export async function uploadFeeBalances(_prev: FeeState, formData: FormData): Promise<FeeState> {
  await requireRole("admin");

  const file = formData.get("file");
  const asOf = formData.get("as_of");

  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 1024 * 1024) return { error: "That file is larger than 1MB." };
  if (typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return { error: "Choose the date these balances are correct as of." };
  }

  const { headers, records } = parseCsvRecords(await file.text());
  if (!headers.includes("admission_no") || !headers.includes("balance")) {
    return { error: "The file needs an admission_no column and a balance column." };
  }
  if (records.length === 0) return { error: "That file has no data rows." };

  const supabase = await createClient();
  const { data: students } = await supabase.from("students").select("id, admission_no");
  const byAdmission = new Map(
    (students ?? []).map((s) => [s.admission_no.toLowerCase(), s.id]),
  );

  const rows: { student_id: string; balance_kes: number; as_of: string }[] = [];
  const unmatched: string[] = [];

  for (const rec of records) {
    const adm = (rec.admission_no ?? "").trim();
    if (!adm) continue;

    const id = byAdmission.get(adm.toLowerCase());
    if (!id) {
      unmatched.push(adm);
      continue;
    }

    // Tolerate "12,500", "KES 12500" and "12500.00" from a bursar's export.
    const amount = Number((rec.balance ?? "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount)) {
      unmatched.push(`${adm} (unreadable balance)`);
      continue;
    }

    rows.push({ student_id: id, balance_kes: amount, as_of: asOf });
  }

  if (rows.length === 0) {
    return { error: "No rows matched a learner. Check the admission numbers.", unmatched };
  }

  const { error } = await supabase
    .from("fee_balances")
    .upsert(rows, { onConflict: "student_id,as_of" });

  if (error) return { error: `Upload failed: ${error.message}`, unmatched };

  revalidatePath("/admin/fees");
  return {
    ok: `Updated ${rows.length} balance${rows.length === 1 ? "" : "s"} as of ${asOf}.`,
    matched: rows.length,
    unmatched,
  };
}
