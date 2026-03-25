import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../lib/auth";
import {
  getAdminEvents,
  getSyncRuns,
  getQualityIssues,
} from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/backoffice/ui/card";
import { Badge } from "../../components/backoffice/ui/badge";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return format(parseISO(val), "dd MMM yyyy HH:mm", { locale: es });
  } catch {
    return val;
  }
}

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

function issueStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "open":
      return "destructive";
    case "resolved":
      return "default";
    case "ignored":
      return "secondary";
    default:
      return "outline";
  }
}

export default async function BackofficePage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  const [events, syncRuns, qualityIssues] = await Promise.all([
    getAdminEvents(session.accessToken).catch(() => []),
    getSyncRuns(session.accessToken).catch(() => []),
    getQualityIssues(session.accessToken).catch(() => []),
  ]);

  const totalEvents = events.length;
  const activeEvents = events.filter((e) => e.is_active).length;
  const noGenres = events.filter(
    (e) => !e.event_genres || e.event_genres.length === 0
  ).length;
  const withCover = events.filter((e) => Boolean(e.cover_url)).length;

  const latestSyncs = syncRuns.slice(0, 5);
  const openIssues = qualityIssues
    .filter((i) => i.status === "open")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Resumen general del estado de grub
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEvents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eventos activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeEvents}</p>
            <p className="text-xs text-muted-foreground">
              {totalEvents > 0
                ? `${Math.round((activeEvents / totalEvents) * 100)}%`
                : "0%"}{" "}
              del total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sin géneros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{noGenres}</p>
            <p className="text-xs text-muted-foreground">
              Requieren clasificación
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con cover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{withCover}</p>
            <p className="text-xs text-muted-foreground">
              {totalEvents > 0
                ? `${Math.round((withCover / totalEvents) * 100)}%`
                : "0%"}{" "}
              del total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Latest Sync Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas sincronizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {latestSyncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay sincronizaciones recientes
              </p>
            ) : (
              <div className="space-y-3">
                {latestSyncs.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {run.trigger_source}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(run.started_at)}
                      </p>
                    </div>
                    <Badge variant={syncStatusVariant(run.status)}>
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Quality Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Issues de calidad abiertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay issues abiertos
              </p>
            ) : (
              <div className="space-y-3">
                {openIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {issue.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {issue.issue_code} · {issue.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(issue.detected_at)}
                      </p>
                    </div>
                    <Badge variant={issueStatusVariant(issue.status)}>
                      {issue.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
