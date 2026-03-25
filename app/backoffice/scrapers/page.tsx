import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { ScraperDashboard } from "../../../components/backoffice/ScraperDashboard";

export default async function BackofficeScrapersPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Scrapers</h2>
        <p className="text-muted-foreground">
          Revisa el catálogo ingestado por las fuentes y corrige visibilidad o calidad básica.
        </p>
      </div>
      <ScraperDashboard role={session.role} />
    </div>
  );
}
