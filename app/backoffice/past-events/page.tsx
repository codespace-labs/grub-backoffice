import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getAdminEvents } from "../../../lib/api";
import { EventsTable } from "../../../components/backoffice/EventsTable";
import type { EventListItemDto } from "@grub/contracts";

export default async function BackofficePastEventsPage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  let events: EventListItemDto[] = [];
  let initialError: string | null = null;
  try {
    events = await getAdminEvents(session.accessToken);
  } catch (error) {
    events = [];
    initialError = error instanceof Error
      ? error.message
      : "No se pudieron cargar los eventos.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Eventos pasados</h2>
        <p className="text-muted-foreground">
          Revisa el histórico de eventos ya realizados.
        </p>
      </div>
      <EventsTable
        initialEvents={events}
        initialError={initialError}
        accessToken={session.accessToken}
        mode="past"
      />
    </div>
  );
}
