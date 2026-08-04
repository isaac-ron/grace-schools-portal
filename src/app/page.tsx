import { redirect } from "next/navigation";
import { homePathFor, requireUser } from "@/lib/dal";

/** Sends each role to its own home. Unauthenticated users never reach this. */
export default async function RootPage() {
  const user = await requireUser();
  redirect(homePathFor(user.role));
}
