import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { FeeUploadForm } from "./forms";

export const metadata: Metadata = { title: "Fee balances" };

const kes = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export default async function FeesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  // Latest snapshot per learner. Ordered so the most recent as_of wins.
  const { data: balances } = await supabase
    .from("fee_balances")
    .select("student_id, balance_kes, as_of, students(admission_no, first_name, last_name)")
    .order("as_of", { ascending: false })
    .limit(500);

  const latest = new Map<string, NonNullable<typeof balances>[number]>();
  for (const b of balances ?? []) {
    if (!latest.has(b.student_id)) latest.set(b.student_id, b);
  }
  const rows = [...latest.values()].sort((a, b) =>
    (a.students?.last_name ?? "").localeCompare(b.students?.last_name ?? ""),
  );

  return (
    <>
      <Toolbar
        title="Fee balances"
        description="Display only. The bursar's own system stays the record of truth; this is a snapshot parents can see, always shown with the date it was correct."
      />

      <div className="flex flex-col gap-6">
        <Panel title="Upload a snapshot">
          <FeeUploadForm />
        </Panel>

        <Panel title="Current balances">
          {rows.length === 0 ? (
            <EmptyState
              title="No balances uploaded"
              description="Export a CSV from the bursar's system with admission_no and balance columns, then upload it above."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Admission no.</Th>
                  <Th>Learner</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">As of</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <Tr key={b.student_id}>
                    <Td numeric>{b.students?.admission_no}</Td>
                    <Td>
                      {b.students?.first_name} {b.students?.last_name}
                    </Td>
                    <Td align="right" numeric>
                      {kes.format(Number(b.balance_kes))}
                    </Td>
                    <Td align="right" muted numeric>
                      {b.as_of}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}
