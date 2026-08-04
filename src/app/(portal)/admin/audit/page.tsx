import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;

const ENTITY_LABEL: Record<string, string> = {
  scores: "Mark",
  report_cards: "Report card",
  submission_grades: "Submission grade",
  profiles: "Account",
  students: "Learner",
};

const ACTION_TONE = {
  insert: "ok",
  update: "info",
  delete: "alert",
} as const;

/**
 * Describes a change in the terms a headteacher would use, rather than dumping
 * JSON. A mark going from 62 to 82 is the thing a dispute turns on.
 */
function describe(entity: string, before: unknown, after: unknown): string {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;

  if (entity === "scores") {
    const from = b.raw_score ?? null;
    const to = a.raw_score ?? null;
    if (from === null && to !== null) return `Mark set to ${to} (${a.level_code ?? "no level"})`;
    if (to === null && from !== null) return `Mark cleared (was ${from})`;
    if (from !== to) return `Mark changed from ${from} to ${to} (${a.level_code ?? "no level"})`;
    if (b.comment !== a.comment) return "Comment changed";
    return "Mark record touched";
  }

  if (entity === "report_cards") {
    if (b.status !== a.status) {
      if (a.status === "released") return "Results RELEASED to parents";
      if (a.status === "draft") return "Results withdrawn from parents";
    }
    return "Remarks updated";
  }

  if (entity === "profiles") {
    const bits: string[] = [];
    if (b.role !== a.role) bits.push(`role ${b.role ?? "none"} to ${a.role}`);
    if (b.can_release_results !== a.can_release_results) {
      bits.push(a.can_release_results ? "granted results release" : "results release removed");
    }
    if (b.is_active !== a.is_active) bits.push(a.is_active ? "reactivated" : "deactivated");
    return bits.length ? bits.join(", ") : "Account details updated";
  }

  if (entity === "students") {
    if (b.is_active !== a.is_active) return a.is_active ? "Restored" : "Archived";
    return "Details updated";
  }

  return "Changed";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("admin");
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();

  const { data: entries, count } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_type, entity_id, before, after, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  // Resolve actor names in one query rather than a join, since audit_log
  // deliberately has no foreign key to profiles.
  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <Toolbar
        title="Audit log"
        description="Every change to a mark, a report card, an account or a learner. Append only: nothing here can be edited or deleted, including by an administrator."
      />

      <Panel>
        {!entries || entries.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Entries appear as soon as marks are entered or accounts are changed."
          />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>What</Th>
                  <Th>Change</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <Tr key={e.id}>
                    <Td muted numeric>
                      {new Date(e.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td muted>
                      {e.actor_id
                        ? (actorName.get(e.actor_id) ?? "Deleted account")
                        : "System"}
                    </Td>
                    <Td>
                      <Pill tone={ACTION_TONE[e.action as keyof typeof ACTION_TONE] ?? "neutral"}>
                        {ENTITY_LABEL[e.entity_type] ?? e.entity_type}
                      </Pill>
                    </Td>
                    <Td>{describe(e.entity_type, e.before, e.after)}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-4">
                <p className="text-sm text-ink-soft">
                  Page {pageNum} of {totalPages} ({count} entries)
                </p>
                <div className="flex gap-2">
                  {pageNum > 1 && (
                    <Link
                      href={`/admin/audit?page=${pageNum - 1}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg border
                                 border-line-strong bg-white px-4 text-sm font-semibold"
                    >
                      Newer
                    </Link>
                  )}
                  {pageNum < totalPages && (
                    <Link
                      href={`/admin/audit?page=${pageNum + 1}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg border
                                 border-line-strong bg-white px-4 text-sm font-semibold"
                    >
                      Older
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
