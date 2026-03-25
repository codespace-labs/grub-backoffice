import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getAdminEvents } from "../../../lib/api";
import { AnalyticsDashboard } from "../../../components/backoffice/AnalyticsDashboard";
import type { EventListItemDto } from "@grub/contracts";

export default async function BackofficeAnalyticsPage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  let events: EventListItemDto[] = [];
  try {
    events = await getAdminEvents(session.accessToken);
  } catch {
    events = [];
  }

  return (
    <AnalyticsDashboard
      initialEvents={events}
      accessToken={session.accessToken}
    />
  );
}
