import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { NormalizationDashboard } from "../../../components/backoffice/NormalizationDashboard";

export default async function BackofficeNormalizationPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Clasificación de géneros</h2>
        <p className="text-muted-foreground">
          Asigna géneros automáticamente a eventos que aún no los tienen, usando datos de artistas de fuentes externas.
        </p>
      </div>
      <NormalizationDashboard role={session.role} />
    </div>
  );
}
