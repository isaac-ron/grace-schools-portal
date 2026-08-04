import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { Alert, EmptyState } from "@/components/ui";
import { ClassForm } from "./forms";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: year }, { data: grades }, { data: teachers }] = await Promise.all([
    supabase.from("academic_years").select("id, name").eq("is_current", true).maybeSingle(),
    supabase.from("grade_levels").select("code, label, band").order("sort_order"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "teacher")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const { data: classes } = year
    ? await supabase
        .from("classes")
        .select(
          "id, grade_code, stream, grade_levels(label, sort_order), profiles(full_name), enrollments(count)",
        )
        .eq("academic_year_id", year.id)
    : { data: null };

  const sorted = [...(classes ?? [])].sort(
    (a, b) =>
      (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0) ||
      (a.stream ?? "").localeCompare(b.stream ?? ""),
  );

  return (
    <>
      <Toolbar
        title="Classes"
        description={
          year
            ? `Classes for ${year.name}. A learner sits in exactly one class per year.`
            : "Classes belong to an academic year."
        }
      >
        <Link
          href="/admin/classes/subjects"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-line-strong
                     bg-white px-5 text-base font-semibold text-ink
                     transition-colors duration-150 hover:bg-surface
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-crimson"
        >
          Learning areas
        </Link>
      </Toolbar>

      {!year ? (
        <Alert tone="warning">
          No academic year is marked as current. Set one on the{" "}
          <Link href="/admin/academic-year" className="underline underline-offset-4">
            academic year page
          </Link>{" "}
          before creating classes.
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <Panel>
            {sorted.length === 0 ? (
              <EmptyState
                title="No classes for this year"
                description="Create one class per grade and stream the school actually runs."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th>Class teacher</Th>
                    <Th align="right">Learners</Th>
                    <Th align="right">Manage</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <Tr key={c.id}>
                      <Td>
                        {c.grade_levels?.label ?? c.grade_code}
                        {c.stream ? ` ${c.stream}` : ""}
                      </Td>
                      <Td muted>
                        {c.profiles?.full_name ?? <Pill tone="warn">Not assigned</Pill>}
                      </Td>
                      <Td align="right" numeric>
                        {c.enrollments?.[0]?.count ?? 0}
                      </Td>
                      <Td align="right">
                        <Link
                          href={`/admin/classes/${c.id}`}
                          className="font-semibold text-crimson underline underline-offset-4"
                        >
                          Open
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}

            <div className="mt-6 border-t border-line pt-6">
              <ClassForm
                yearId={year.id}
                grades={(grades ?? []).map((g) => ({ value: g.code, label: g.label }))}
                teachers={(teachers ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
              />
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
