import { redirect } from "next/navigation";
import { BackofficeHeader } from "../components/BackofficeHeader";
import { SourceSyncButton } from "../components/SourceSyncButton";
import { getBackofficeSession } from "../../lib/auth";
import { getSyncRuns } from "../../lib/api";

const sources = ["ticketmaster", "ticketmaster-pe", "teleticket"];

export default async function SyncPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const runs = await getSyncRuns(session.accessToken).catch(() => []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <BackofficeHeader
        title="Syncs"
        description="Disparo manual de scrapers y trazabilidad de corridas operativas."
        email={session.email}
        role={session.role}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {sources.map((source) => (
          <div
            key={source}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: 18,
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>{source}</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Disparo manual del worker compartido</div>
            <SourceSyncButton source={source} disabled={session.role === "viewer"} />
          </div>
        ))}
      </section>

      <section style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {runs.map((run) => (
            <div
              key={run.id}
              style={{
                display: "grid",
                gap: 5,
                paddingBottom: 14,
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <div style={{ fontWeight: 700 }}>{run.trigger_source}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {run.status} · Inicio: {new Date(run.started_at).toLocaleString("es-PE")}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                Fin: {run.finished_at ? new Date(run.finished_at).toLocaleString("es-PE") : "en ejecución"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
