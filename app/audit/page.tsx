import { redirect } from "next/navigation";
import { BackofficeHeader } from "../components/BackofficeHeader";
import { getBackofficeSession } from "../../lib/auth";
import { getAuditLogs, getManualOverrides } from "../../lib/api";

export default async function AuditPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const [logs, overrides] = await Promise.all([
    getAuditLogs(session.accessToken).catch(() => []),
    getManualOverrides(session.accessToken).catch(() => []),
  ]);

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <BackofficeHeader
        title="Auditoría"
        description="Trazabilidad de acciones admin y overrides manuales sobre eventos."
        email={session.email}
        role={session.role}
      />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Audit logs</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{ display: "grid", gap: 4, paddingBottom: 14, borderBottom: "1px solid rgba(148,163,184,0.12)" }}
              >
                <div style={{ fontWeight: 700 }}>{log.action}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {log.actor_role ?? "sin rol"} · {log.entity_type} · {log.entity_id ?? "sin entidad"}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {new Date(log.created_at).toLocaleString("es-PE")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Overrides manuales</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {overrides.map((override) => (
              <div
                key={override.id}
                style={{ display: "grid", gap: 4, paddingBottom: 14, borderBottom: "1px solid rgba(148,163,184,0.12)" }}
              >
                <div style={{ fontWeight: 700 }}>{override.field_name}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  event_id: {override.event_id} · estado: {override.status}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {override.reason ?? "sin motivo"} · {new Date(override.created_at).toLocaleString("es-PE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
