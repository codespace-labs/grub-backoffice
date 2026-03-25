import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getBackofficeSession } from "../../lib/auth";
import { Sidebar } from "../../components/backoffice/Sidebar";
import { Header } from "../../components/backoffice/Header";

export default async function BackofficeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header session={session} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
