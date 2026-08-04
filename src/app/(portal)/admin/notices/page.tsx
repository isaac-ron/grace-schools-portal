import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { NoticeForm, PublishToggle } from "./forms";

export const metadata: Metadata = { title: "Notices" };

const AUDIENCE: Record<string, string> = {
  all_parents: "All parents",
  all_staff: "All staff",
  single_class: "One class",
};

export default async function NoticesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();

  const [{ data: notices }, { data: classes }] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, body, audience, published_at, class_id, classes(grade_code, stream, grade_levels(label))")
      .order("created_at", { ascending: false })
      .limit(100),
    year
      ? supabase
          .from("classes")
          .select("id, grade_code, stream, grade_levels(label, sort_order)")
          .eq("academic_year_id", year.id)
      : Promise.resolve({ data: [] }),
  ]);

  const classOptions = [...(classes ?? [])]
    .sort((a, b) => (a.grade_levels?.sort_order ?? 0) - (b.grade_levels?.sort_order ?? 0))
    .map((c) => ({
      value: c.id,
      label: `${c.grade_levels?.label ?? c.grade_code}${c.stream ? ` ${c.stream}` : ""}`,
    }));

  return (
    <>
      <Toolbar
        title="Notices"
        description="Announcements parents and staff see in the portal. A notice is invisible until it is published."
      />

      <div className="flex flex-col gap-6">
        <Panel>
          {!notices || notices.length === 0 ? (
            <EmptyState
              title="No notices yet"
              description="Post term dates, meeting reminders, or closing times."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Audience</Th>
                  <Th align="right">Status</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <Tr key={n.id}>
                    <Td>{n.title}</Td>
                    <Td muted>
                      {n.audience === "single_class" && n.classes
                        ? `${n.classes.grade_levels?.label ?? n.classes.grade_code}${n.classes.stream ? ` ${n.classes.stream}` : ""}`
                        : AUDIENCE[n.audience]}
                    </Td>
                    <Td align="right">
                      {n.published_at ? <Pill tone="ok">Published</Pill> : <Pill tone="warn">Draft</Pill>}
                    </Td>
                    <Td align="right">
                      <PublishToggle noticeId={n.id} isPublished={Boolean(n.published_at)} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel title="Write a notice">
          <NoticeForm classes={classOptions} />
        </Panel>
      </div>
    </>
  );
}
