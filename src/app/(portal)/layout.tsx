import { requireUser } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SessionKeeper } from "@/components/session-keeper";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session is verified here and memoised by `cache()`, so pages beneath this
  // layout reuse the same lookup rather than re-verifying per component.
  //
  // This is also the route guard. There is no Proxy in this app (see
  // components/session-keeper.tsx for why), so every authenticated surface is
  // protected by living under this layout. Row Level Security in the database
  // remains the actual boundary.
  const user = await requireUser();

  return (
    <>
      <SessionKeeper />
      <PortalShell user={user}>{children}</PortalShell>
    </>
  );
}
