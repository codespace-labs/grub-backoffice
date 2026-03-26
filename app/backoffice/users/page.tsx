import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../../lib/auth";
import { getAdminUsers } from "../../../lib/api";
import { UsersTable } from "../../../components/backoffice/UsersTable";
import type { AdminUserDto } from "@grub/contracts";

export default async function BackofficeUsersPage() {
  const session = await getBackofficeSession();

  if (!session) {
    redirect("/login");
  }

  let users: AdminUserDto[] = [];
  let fetchError: string | null = null;
  try {
    users = await getAdminUsers(session.accessToken);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Error al cargar usuarios";
    console.error("[backoffice:users-page]", fetchError);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
        <p className="text-muted-foreground">
          Gestiona el equipo del backoffice y visualiza clientes sincronizados desde la app
        </p>
      </div>
      {fetchError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">Error al cargar usuarios: </span>
          {fetchError}
        </div>
      )}
      <UsersTable initialUsers={users} currentRole={session.role} />
    </div>
  );
}
