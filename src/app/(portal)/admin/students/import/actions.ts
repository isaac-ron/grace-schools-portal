"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCsvRecords } from "@/lib/csv";

export type ImportRow = {
  line: number;
  admission_no: string;
  name: string;
  grade: string;
  status: "ready" | "duplicate" | "error";
  message?: string;
};

export type ImportState =
  | {
      error?: string;
      ok?: string;
      preview?: ImportRow[];
      readyCount?: number;
      payload?: string;
    }
  | undefined;

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1500;

const rowSchema = z.object({
  admission_no: z.string().trim().min(1),
  first_name: z.string().trim().min(1),
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().min(1),
  grade: z.string().trim().min(1),
  stream: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  date_of_birth: z.string().trim().optional(),
});

/**
 * Dry run.
 *
 * Nothing is written. The office sees exactly what will happen, row by row, and
 * a spreadsheet from a school's existing register is never clean the first time.
 * Committing an import blind is how you end up with 400 half-created learners.
 */
export async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireRole("admin");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 2MB. Split it into smaller batches." };
  }

  const text = await file.text();
  const { headers, records } = parseCsvRecords(text);

  const required = ["admission_no", "first_name", "last_name", "grade"];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    return {
      error: `The file is missing these columns: ${missing.join(", ")}. Download the template below.`,
    };
  }
  if (records.length === 0) return { error: "That file has no data rows." };
  if (records.length > MAX_ROWS) {
    return { error: `That file has ${records.length} rows. Import at most ${MAX_ROWS} at a time.` };
  }

  const supabase = await createClient();
  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (!year) return { error: "Set a current academic year before importing." };

  const [{ data: classes }, { data: existing }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, grade_code, stream")
      .eq("academic_year_id", year.id),
    supabase.from("students").select("admission_no"),
  ]);

  const taken = new Set((existing ?? []).map((s) => s.admission_no.toLowerCase()));
  const seenInFile = new Set<string>();

  const classKey = (grade: string, stream?: string) =>
    `${grade.trim().toUpperCase()}|${(stream ?? "").trim().toUpperCase()}`;
  const classMap = new Map(
    (classes ?? []).map((c) => [classKey(c.grade_code, c.stream ?? ""), c.id]),
  );

  const preview: ImportRow[] = [];
  const accepted: Record<string, string>[] = [];

  records.forEach((rec, i) => {
    const line = i + 2; // header is line 1
    const parsed = rowSchema.safeParse(rec);

    if (!parsed.success) {
      preview.push({
        line,
        admission_no: rec.admission_no ?? "",
        name: `${rec.first_name ?? ""} ${rec.last_name ?? ""}`.trim(),
        grade: rec.grade ?? "",
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      return;
    }

    const r = parsed.data;
    const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ");
    const key = r.admission_no.toLowerCase();

    if (taken.has(key)) {
      preview.push({
        line, admission_no: r.admission_no, name, grade: r.grade,
        status: "duplicate", message: "Already enrolled, will be skipped",
      });
      return;
    }
    if (seenInFile.has(key)) {
      preview.push({
        line, admission_no: r.admission_no, name, grade: r.grade,
        status: "error", message: "Repeated admission number in this file",
      });
      return;
    }

    const classId = classMap.get(classKey(r.grade, r.stream));
    if (!classId) {
      preview.push({
        line, admission_no: r.admission_no, name, grade: r.grade,
        status: "error",
        message: `No class '${r.grade}${r.stream ? ` ${r.stream}` : ""}' exists for this year`,
      });
      return;
    }

    if (r.gender && !["male", "female"].includes(r.gender.toLowerCase())) {
      preview.push({
        line, admission_no: r.admission_no, name, grade: r.grade,
        status: "error", message: "Gender must be male or female, or left blank",
      });
      return;
    }
    if (r.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth)) {
      preview.push({
        line, admission_no: r.admission_no, name, grade: r.grade,
        status: "error", message: "Date of birth must be YYYY-MM-DD",
      });
      return;
    }

    seenInFile.add(key);
    accepted.push({ ...r, class_id: classId });
    preview.push({ line, admission_no: r.admission_no, name, grade: r.grade, status: "ready" });
  });

  const readyCount = accepted.length;
  return {
    preview,
    readyCount,
    payload: JSON.stringify({ year_id: year.id, rows: accepted }),
    ok:
      readyCount > 0
        ? `${readyCount} learner${readyCount === 1 ? "" : "s"} ready to import. Nothing has been saved yet.`
        : undefined,
    error: readyCount === 0 ? "No rows can be imported. Fix the problems below and try again." : undefined,
  };
}

/**
 * Commit.
 *
 * Students are inserted first, then enrollments. If enrollment fails the
 * students just created are removed, so a failed import leaves nothing behind
 * rather than a set of learners in no class.
 */
export async function commitImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireRole("admin");

  const raw = formData.get("payload");
  if (typeof raw !== "string" || !raw) return { error: "Nothing to import. Upload a file first." };

  let parsed: { year_id: string; rows: Record<string, string>[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "That import has expired. Upload the file again." };
  }
  if (!parsed.rows?.length) return { error: "Nothing to import." };

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("students")
    .insert(
      parsed.rows.map((r) => ({
        admission_no: r.admission_no,
        first_name: r.first_name,
        middle_name: r.middle_name || null,
        last_name: r.last_name,
        gender: (r.gender?.toLowerCase() as "male" | "female") || null,
        date_of_birth: r.date_of_birth || null,
      })),
    )
    .select("id, admission_no");

  if (error) {
    if (error.code === "23505") {
      return { error: "One of those admission numbers was taken while you were reviewing. Re-upload the file." };
    }
    return { error: `Import failed, nothing was saved: ${error.message}` };
  }

  const byAdmission = new Map((inserted ?? []).map((s) => [s.admission_no, s.id]));
  const { error: enrollError } = await supabase.from("enrollments").insert(
    parsed.rows.map((r) => ({
      student_id: byAdmission.get(r.admission_no)!,
      class_id: r.class_id,
      academic_year_id: parsed.year_id,
    })),
  );

  if (enrollError) {
    await supabase
      .from("students")
      .delete()
      .in("id", (inserted ?? []).map((s) => s.id));
    return { error: `Could not place learners in classes, so nothing was saved: ${enrollError.message}` };
  }

  revalidatePath("/admin/students");
  return { ok: `Imported ${inserted?.length ?? 0} learners.` };
}
