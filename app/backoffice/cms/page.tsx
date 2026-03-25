import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getAdminArtists, getAdminGenres } from "../../../lib/api";
import { Badge } from "../../../components/backoffice/ui/badge";
import { CmsDashboard } from "../../../components/backoffice/CmsDashboard";

export default async function BackofficeCmsPage() {
  const session = await getBackofficeSession();
  if (!session) redirect("/login");

  const [genres, artists] = await Promise.all([
    getAdminGenres(session.accessToken).catch(() => []),
    getAdminArtists(session.accessToken).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="outline">CMS</Badge>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Centro editorial
          </h2>
          <p className="text-muted-foreground">
            Administra géneros y artistas del catálogo sin salir del backoffice.
          </p>
        </div>
      </div>
      <CmsDashboard role={session.role} initialGenres={genres} initialArtists={artists} />
    </div>
  );
}
