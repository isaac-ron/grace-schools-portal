import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel } from "@/components/table";
import { Alert } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import learners" };

export default async function ImportPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: year } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_current", true)
    .maybeSingle();

  const { count: classCount } = year
    ? await supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("academic_year_id", year.id)
    : { count: 0 };

  return (
    <>
      <Toolbar
        title="Import learners"
        description="Bring the school's existing register in from a spreadsheet. The file is checked first and nothing is saved until you confirm."
      >
        <Link
          href="/admin/students"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)]
                     bg-white px-5 text-base font-semibold text-[var(--color-ink)]
                     transition-colors duration-150 hover:bg-[var(--color-surface)]"
        >
          All learners
        </Link>
      </Toolbar>

      {!year ? (
        <Alert tone="warning">Set a current academic year before importing.</Alert>
      ) : !classCount ? (
        <Alert tone="warning">
          There are no classes for {year.name}. Learners are placed into classes on import, so{" "}
          <Link href="/admin/classes" className="underline underline-offset-4">
            create the classes
          </Link>{" "}
          first.
        </Alert>
      ) : (
        <Panel>
          <ImportForm />
        </Panel>
      )}
    </>
  );
}
