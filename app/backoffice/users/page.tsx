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
  try {
    users = await getAdminUsers(session.accessToken);
  } catch {
    users = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
        <p className="text-muted-foreground">
          Gestiona los usuarios del backoffice
        </p>
      </div>
      <UsersTable initialUsers={users} currentRole={session.role} />
    </div>
  );
}
