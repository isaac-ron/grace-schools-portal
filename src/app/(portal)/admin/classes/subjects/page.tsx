import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { SubjectForm } from "../forms";

export const metadata: Metadata = { title: "Learning areas" };

export default async function SubjectsPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, code, name, sort_order, is_active")
    .order("sort_order")
    .order("name");

  return (
    <>
      <Toolbar
        title="Learning areas"
        description="CBE subjects. These appear as the rows on a report card, in this order."
      >
        <Link
          href="/admin/classes"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)]
                     bg-white px-5 text-base font-semibold text-[var(--color-ink)]
                     transition-colors duration-150 hover:bg-[var(--color-surface)]
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-[var(--color-crimson)]"
        >
          Back to classes
        </Link>
      </Toolbar>

      <Panel>
        {!subjects || subjects.length === 0 ? (
          <EmptyState
            title="No learning areas yet"
            description="Add the subjects the school teaches. Grade 7 CBE has thirteen; add the ones actually taught."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th align="right">Order</Th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <Tr key={s.id}>
                  <Td>{s.code}</Td>
                  <Td muted>{s.name}</Td>
                  <Td align="right" numeric>
                    {s.sort_order}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        <div className="mt-6 border-t border-[var(--color-line)] pt-6">
          <SubjectForm />
        </div>
      </Panel>
    </>
  );
}
