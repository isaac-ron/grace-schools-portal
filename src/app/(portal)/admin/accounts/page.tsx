import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Toolbar, Panel, TableWrap, Th, Td, Tr, Pill } from "@/components/table";
import { EmptyState } from "@/components/ui";
import { CreateAccountForm } from "./forms";

export const metadata: Metadata = { title: "Accounts" };

const ROLE_LABEL = {
  parent: "Parent",
  teacher: "Teacher",
  admin: "Administration",
} as const;

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requireRole("admin");
  const { role } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, can_release_results, is_active")
    .order("full_name");

  if (role === "parent" || role === "teacher" || role === "admin") {
    query = query.eq("role", role);
  }

  const { data: profiles } = await query;

  const tabs = [
    { key: "", label: "Everyone" },
    { key: "teacher", label: "Teachers" },
    { key: "admin", label: "Administration" },
    { key: "parent", label: "Parents" },
  ];

  return (
    <>
      <Toolbar
        title="Accounts"
        description="Everyone who can sign in. Accounts are created here; there is no self-registration, because it would let anyone claim to be a parent of any child."
      />

      <div className="flex flex-col gap-6">
        <Panel>
          <div className="mb-5 flex flex-wrap gap-2">
            {tabs.map((t) => {
              const active = (role ?? "") === t.key;
              return (
                <Link
                  key={t.key}
                  href={t.key ? `/admin/accounts?role=${t.key}` : "/admin/accounts"}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-semibold
                              transition-colors duration-150
                              focus-visible:outline-2 focus-visible:outline-offset-2
                              focus-visible:outline-[var(--color-crimson)]
                              ${
                                active
                                  ? "border-[var(--color-crimson)] bg-[var(--color-crimson-tint)] text-[var(--color-crimson)]"
                                  : "border-[var(--color-line-strong)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)]"
                              }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {!profiles || profiles.length === 0 ? (
            <EmptyState
              title="No accounts here yet"
              description="Create one below. Parents need an account before they can be linked to a learner."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Contact</Th>
                  <Th align="right">Status</Th>
                  <Th align="right">Manage</Th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <Tr key={p.id}>
                    <Td>{p.full_name}</Td>
                    <Td muted>
                      {ROLE_LABEL[p.role]}
                      {p.can_release_results && (
                        <span className="ml-2">
                          <Pill tone="info">Can release results</Pill>
                        </span>
                      )}
                    </Td>
                    <Td muted>{p.email ?? p.phone ?? "Not recorded"}</Td>
                    <Td align="right">
                      {p.is_active ? <Pill tone="ok">Active</Pill> : <Pill tone="alert">Inactive</Pill>}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/accounts/${p.id}`}
                        className="font-semibold text-[var(--color-crimson)] underline underline-offset-4"
                      >
                        Open
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title="Create an account"
          description="A temporary password is generated and shown once. Read it to the person; they choose their own at first sign-in."
        >
          <CreateAccountForm />
        </Panel>
      </div>
    </>
  );
}
