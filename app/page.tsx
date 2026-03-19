import type { AdminUserDto } from "@grub/contracts";
import { redirect } from "next/navigation";
import { BackofficeHeader } from "./components/BackofficeHeader";
import { UserRoleSelect } from "./components/UserRoleSelect";
import { getBackofficeSession } from "../lib/auth";
import { getAdminEvents, getAdminUsers, getQualityIssues, getSyncRuns } from "../lib/api";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--panel-border)",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 13 }}>{hint}</div>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";
  return new Date(value).toLocaleString("es-PE");
}

function TeamRow({
  user,
  canManageRoles,
}: {
  user: AdminUserDto;
  canManageRoles: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        paddingBottom: 12,
        borderBottom: "1px solid rgba(148,163,184,0.12)",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 600 }}>{user.email ?? "sin email"}</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          Alta: {formatDateTime(user.created_at)} · Último acceso: {formatDateTime(user.last_sign_in_at)}
        </div>
      </div>
      <UserRoleSelect userId={user.id} role={user.role} disabled={!canManageRoles} />
    </div>
  );
}

export default async function HomePage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  const activeSession = session;

  const [events, issues, runs, users] = await Promise.all([
    getAdminEvents(activeSession.accessToken).catch(() => []),
    getQualityIssues(activeSession.accessToken).catch(() => []),
    getSyncRuns(activeSession.accessToken).catch(() => []),
    getAdminUsers(activeSession.accessToken).catch(() => []),
  ]);

  const activeEvents = events.filter((event) => event.is_active !== false).length;
  const inactiveEvents = events.length - activeEvents;
  const openIssues = issues.filter((issue) => issue.status === "open").length;
  const latestRun = runs[0];

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <BackofficeHeader
        title="Operaciones + calidad"
        description="Vista general del backend compartido: catálogo, calidad, syncs y roles del backoffice."
        email={activeSession.email}
        role={activeSession.role}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <StatCard label="Eventos cargados" value={events.length} hint={`${activeEvents} activos · ${inactiveEvents} inactivos`} />
        <StatCard label="Issues abiertos" value={openIssues} hint="género, venue, ciudad y calidad" />
        <StatCard label="Sync runs" value={runs.length} hint={latestRun ? `último: ${latestRun.status}` : "sin corridas registradas"} />
        <StatCard label="Usuarios backoffice" value={users.length} hint="auth + roles vía Supabase Auth" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Eventos</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {events.slice(0, 12).map((event) => (
              <div
                key={event.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid rgba(148,163,184,0.12)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{event.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    {event.city ?? "Sin ciudad"} · {event.source ?? "sin fuente"}
                  </div>
                </div>
                <div style={{ color: event.is_active === false ? "var(--warn)" : "var(--good)", fontSize: 13 }}>
                  {event.is_active === false ? "Inactivo" : "Activo"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Issues</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {issues.slice(0, 8).map((issue) => (
                <div key={issue.id} style={{ paddingBottom: 12, borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                  <div style={{ fontWeight: 600 }}>{issue.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    {issue.issue_type} · {issue.issue_code}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Últimas corridas</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {runs.slice(0, 6).map((run) => (
                <div key={run.id} style={{ paddingBottom: 12, borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                  <div style={{ fontWeight: 600 }}>{run.trigger_source}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    {run.status} · {new Date(run.started_at).toLocaleString("es-PE")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0 }}>Equipo y roles</h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Los roles viven en `app_metadata.role`. Solo `admin` puede cambiarlos.
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {users.map((user) => (
            <TeamRow key={user.id} user={user} canManageRoles={activeSession.role === "admin"} />
          ))}
        </div>
      </section>
    </main>
  );
}
