import { redirect } from "next/navigation";
import { BackofficeHeader } from "../components/BackofficeHeader";
import { EventActiveToggle } from "../components/EventActiveToggle";
import { getBackofficeSession } from "../../lib/auth";
import { getAdminEvents } from "../../lib/api";

export default async function EventsPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const events = await getAdminEvents(session.accessToken, { limit: 200 }).catch(() => []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <BackofficeHeader
        title="Eventos"
        description="Revisión operativa de catálogo, estado activo y calidad básica de publicación."
        email={session.email}
        role={session.role}
      />

      <section style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 18, padding: 20 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                paddingBottom: 14,
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <div style={{ display: "grid", gap: 5 }}>
                <div style={{ fontWeight: 700 }}>{event.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {event.city ?? "Sin ciudad"} · {event.venue ?? "Sin venue"} · {event.source ?? "sin fuente"}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                  {event.date} {event.start_time ?? ""} · {event.ticket_url ?? "sin ticket_url"}
                </div>
              </div>
              <EventActiveToggle
                eventId={event.id}
                isActive={event.is_active !== false}
                disabled={session.role === "viewer"}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
