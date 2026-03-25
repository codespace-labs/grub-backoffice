import { redirect } from "next/navigation";

export default function SyncLegacyPage() {
  redirect("/backoffice/sync");
}
