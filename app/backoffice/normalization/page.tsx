import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { NormalizationDashboard } from "../../../components/backoffice/NormalizationDashboard";

export default async function BackofficeNormalizationPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Normalización y auditoría IA</h2>
        <p className="text-muted-foreground">
          Supervisa el pipeline completo: clasificación automática, corrección inteligente y revisión
          de los cambios que la IA aplica sobre los eventos para mantener información real y completa.
        </p>
      </div>
      <NormalizationDashboard role={session.role} />
    </div>
  );
}
