import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getSyncRuns, getAdminEvents } from "../../../lib/api";
import { SourceSyncButton } from "../../components/SourceSyncButton";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/backoffice/ui/card";
import { Badge } from "../../../components/backoffice/ui/badge";

const sources = ["ticketmaster-pe", "teleticket", "joinnus", "passline", "vastion", "tikpe"];

function syncStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function formatRunItems(
  items: Array<{
    source: string;
    inserted_count: number;
    updated_count: number;
    skipped_count: number;
    failed_count: number;
  }>,
) {
  if (!items.length) return null;

  return items
    .map((item) => {
      const parts = [
        `${item.inserted_count} ins`,
        `${item.updated_count} upd`,
      ];

      if (item.skipped_count > 0) parts.push(`${item.skipped_count} skip`);
      if (item.failed_count > 0) parts.push(`${item.failed_count} fail`);

      return `${item.source}: ${parts.join(" · ")}`;
    })
    .join(" | ");
}

export default async function BackofficeSyncPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const [runs, recentEvents] = await Promise.all([
    getSyncRuns(session.accessToken).catch(() => []),
    getAdminEvents(session.accessToken, { sort: "recent", limit: 15 }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Syncs</h2>
        <p className="text-muted-foreground">
          Ejecuta scrapers manualmente y revisa el historial reciente de corridas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dispara todas las fuentes activas de Peru en una sola corrida.
          </p>
          <SourceSyncButton
            disabled={session.role === "viewer"}
            label="Correr sync global"
            idleMessage="Ejecuta Ticketmaster PE, Teleticket, Joinnus, Passline, Vastion y Tikpe."
            fallbackSources={sources}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <Card key={source}>
            <CardHeader>
              <CardTitle className="text-base">{source}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Disparo manual del worker para esta fuente.
              </p>
              <SourceSyncButton source={source} disabled={session.role === "viewer"} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Eventos recientes ── */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos scrapeados</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos registrados.</p>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.date ? new Date(event.date).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—"} · {event.city ?? "—"} · {event.source ?? "—"}
                    </p>
                    {event.updated_at || event.created_at ? (
                      <p className="text-xs text-muted-foreground/60">
                        Último cambio: {new Date(event.updated_at ?? event.created_at ?? "").toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {event.cover_url ? (
                      <span className="text-xs text-emerald-400">✓ cover</span>
                    ) : (
                      <span className="text-xs text-rose-400">sin cover</span>
                    )}
                    <Badge variant={event.is_active ? "default" : "outline"}>
                      {event.is_active ? "activo" : "inactivo"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Historial de corridas ── */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas corridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay corridas registradas.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{run.trigger_source}</p>
                    <p className="text-sm text-muted-foreground">
                      Inicio: {new Date(run.started_at).toLocaleString("es-PE")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fin: {run.finished_at ? new Date(run.finished_at).toLocaleString("es-PE") : "en ejecución"}
                    </p>
                  </div>
                  <Badge variant={syncStatusVariant(run.status)}>{run.status}</Badge>
                </div>
                {formatRunItems(run.items) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatRunItems(run.items)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
