import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { YearForm, TermForm, SetCurrentYear, SetCurrentTerm } from "./forms";

export const metadata: Metadata = { title: "Academic year" };

function fmt(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AcademicYearPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: years }, { data: terms }] = await Promise.all([
    supabase.from("academic_years").select("*").order("starts_on", { ascending: false }),
    supabase
      .from("terms")
      .select("*, academic_years(name)")
      .order("starts_on", { ascending: false }),
  ]);

  const yearOptions = (years ?? []).map((y) => ({ value: y.id, label: y.name }));

  return (
    <>
      <Toolbar
        title="Academic year"
        description="Terms, classes and marks all hang off the academic year. Set the current year and term before anything else."
      />

      <div className="flex flex-col gap-6">
        <Panel title="Years">
          {!years || years.length === 0 ? (
            <EmptyState
              title="No academic years yet"
              description="Create one to begin. Everything else in the portal depends on it."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <Tr key={y.id}>
                    <Td>{y.name}</Td>
                    <Td muted>{fmt(y.starts_on)}</Td>
                    <Td muted>{fmt(y.ends_on)}</Td>
                    <Td>{y.is_current ? <Pill tone="ok">Current</Pill> : <Pill>Past</Pill>}</Td>
                    <Td align="right">
                      {!y.is_current && <SetCurrentYear yearId={y.id} name={y.name} />}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            <YearForm />
          </div>
        </Panel>

        <Panel title="Terms">
          {!terms || terms.length === 0 ? (
            <EmptyState
              title="No terms yet"
              description="Add the three terms for the current year so marks and registers have somewhere to sit."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Term</Th>
                  <Th>Year</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <Tr key={t.id}>
                    <Td>{t.name}</Td>
                    <Td muted>{t.academic_years?.name}</Td>
                    <Td muted>{fmt(t.starts_on)}</Td>
                    <Td muted>{fmt(t.ends_on)}</Td>
                    <Td>{t.is_current ? <Pill tone="ok">Current</Pill> : <Pill>Not current</Pill>}</Td>
                    <Td align="right">
                      {!t.is_current && <SetCurrentTerm termId={t.id} name={t.name} />}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <div className="mt-6 border-t border-[var(--color-line)] pt-6">
            {yearOptions.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                Create an academic year first.
              </p>
            ) : (
              <TermForm years={yearOptions} />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
