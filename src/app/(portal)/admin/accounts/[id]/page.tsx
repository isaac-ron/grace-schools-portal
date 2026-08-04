import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EditAccountForm, ActiveToggle, ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, can_release_results, is_active, must_change_password")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  // What this account can currently reach, so an admin can see the effect of a
  // role change rather than inferring it.
  const [{ data: children }, { data: assignments }] = await Promise.all([
    profile.role === "parent"
      ? supabase
          .from("guardian_students")
          .select("student_id, students(admission_no, first_name, last_name)")
          .eq("guardian_id", id)
      : Promise.resolve({ data: [] }),
    profile.role === "teacher"
      ? supabase
          .from("staff_class_assignments")
          .select("id, classes(grade_code, stream, grade_levels(label)), subjects(name)")
          .eq("staff_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  const isSelf = actor.id === profile.id;

  return (
    <>
      <Toolbar title={profile.full_name} description={profile.email ?? undefined}>
        {!profile.is_active && <Pill tone="alert">Inactive</Pill>}
        {profile.must_change_password && <Pill tone="warn">Must set a password</Pill>}
        <Link
          href="/admin/accounts"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--color-line-strong)]
                     bg-white px-5 text-base font-semibold text-[var(--color-ink)]
                     transition-colors duration-150 hover:bg-[var(--color-surface)]"
        >
          All accounts
        </Link>
      </Toolbar>

      <div className="flex flex-col gap-6">
        <Panel title="Details">
          <EditAccountForm profile={profile} />
        </Panel>

        {profile.role === "parent" && (
          <Panel
            title="Linked learners"
            description="This account can see exactly these learners and no others."
          >
            {!children || children.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                Not linked to any learner yet. Link them from the learner&rsquo;s page.
              </p>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Admission no.</Th>
                    <Th>Name</Th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((c) => (
                    <Tr key={c.student_id}>
                      <Td numeric>{c.students?.admission_no}</Td>
                      <Td>
                        <Link
                          href={`/admin/students/${c.student_id}`}
                          className="font-medium text-[var(--color-crimson)] underline underline-offset-4"
                        >
                          {c.students?.first_name} {c.students?.last_name}
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Panel>
        )}

        {profile.role === "teacher" && (
          <Panel
            title="Teaching assignments"
            description="This teacher can see these classes and no others."
          >
            {!assignments || assignments.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                No classes assigned. Assign them from a class page.
              </p>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Class</Th>
                    <Th>Learning area</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <Tr key={a.id}>
                      <Td>
                        {a.classes?.grade_levels?.label ?? a.classes?.grade_code}
                        {a.classes?.stream ? ` ${a.classes.stream}` : ""}
                      </Td>
                      <Td muted>{a.subjects?.name ?? "All subjects"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Panel>
        )}

        <Panel
          title="Password"
          description="Issues a new temporary password and forces a change at next sign-in. Use this when someone is locked out."
        >
          <ResetPasswordForm profileId={profile.id} />
        </Panel>

        <Panel
          title={profile.is_active ? "Deactivate" : "Reactivate"}
          description={
            isSelf
              ? "This is your own account."
              : profile.is_active
                ? "Deactivating ends access immediately, even if they are already signed in. Their records are kept."
                : "This account cannot sign in."
          }
        >
          {isSelf ? (
            <p className="text-sm text-[var(--color-ink-soft)]">
              You cannot deactivate your own account. Ask another administrator.
            </p>
          ) : (
            <ActiveToggle profile={profile} />
          )}
        </Panel>
      </div>
    </>
  );
}
