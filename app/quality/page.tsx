import { redirect } from "next/navigation";
import { BackofficeHeader } from "../components/BackofficeHeader";
import { QualityIssueActions } from "../components/QualityIssueActions";
import { getBackofficeSession } from "../../lib/auth";
import { getQualityIssues } from "../../lib/api";

export default async function QualityPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const issues = await getQualityIssues(session.accessToken).catch(() => []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <BackofficeHeader
        title="Calidad"
        description="Issues automáticos de género, venue y ubicación para operar calidad de catálogo."
        email={session.email}
        role={session.role}
      />

      <section style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {issues.map((issue) => (
            <div
              key={issue.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                paddingBottom: 14,
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <div style={{ display: "grid", gap: 5 }}>
                <div style={{ fontWeight: 700 }}>{issue.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {issue.issue_type} · {issue.issue_code} · {issue.source ?? "sin fuente"}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  Detectado: {new Date(issue.detected_at).toLocaleString("es-PE")}
                </div>
              </div>
              <QualityIssueActions issueId={issue.id} status={issue.status} disabled={session.role === "viewer"} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
