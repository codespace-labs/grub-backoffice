import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getAuditLogs, getManualOverrides } from "../../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/backoffice/ui/card";

export default async function BackofficeAuditPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const [logs, overrides] = await Promise.all([
    getAuditLogs(session.accessToken).catch(() => []),
    getManualOverrides(session.accessToken).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Auditoría</h2>
        <p className="text-muted-foreground">
          Revisa acciones administrativas y overrides manuales sobre el catálogo.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Audit logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay logs.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="space-y-1 border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">
                    {log.actor_role ?? "sin rol"} · {log.entity_type} · {log.entity_id ?? "sin entidad"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("es-PE")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overrides manuales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overrides.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay overrides.</p>
            ) : (
              overrides.map((override) => (
                <div key={override.id} className="space-y-1 border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="font-medium">{override.field_name}</p>
                  <p className="text-sm text-muted-foreground">
                    event_id: {override.event_id} · estado: {override.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {override.reason ?? "sin motivo"} · {new Date(override.created_at).toLocaleString("es-PE")}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
