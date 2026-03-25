import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getQualityIssues } from "../../../lib/api";
import { QualityIssueActions } from "../../components/QualityIssueActions";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/backoffice/ui/card";
import { Badge } from "../../../components/backoffice/ui/badge";
import { NormalizationBlockersClient } from "../../../components/backoffice/NormalizationBlockersClient";

export default async function BackofficeQualityPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const issues = await getQualityIssues(session.accessToken).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Calidad</h2>
        <p className="text-muted-foreground">
          Gestiona issues automáticos de género, venue y ubicación del catálogo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issues detectados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay issues registrados.</p>
          ) : (
            issues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-col gap-3 border-b border-border pb-4 last:border-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{issue.title}</p>
                    <Badge variant={issue.status === "open" ? "destructive" : issue.status === "resolved" ? "default" : "secondary"}>
                      {issue.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {issue.issue_type} · {issue.issue_code} · {issue.source ?? "sin fuente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Detectado: {new Date(issue.detected_at).toLocaleString("es-PE")}
                  </p>
                </div>
                <QualityIssueActions
                  issueId={issue.id}
                  status={issue.status}
                  disabled={session.role === "viewer"}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <NormalizationBlockersClient />
    </div>
  );
}
