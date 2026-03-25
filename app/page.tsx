import { redirect } from "next/navigation";
import { getBackofficeSession } from "../lib/auth";

export default async function HomePage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  redirect("/backoffice");
}
