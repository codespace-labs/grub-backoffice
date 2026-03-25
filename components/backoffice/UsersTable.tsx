"use client";

import { useState, useCallback } from "react";
import type { AdminRole, AdminUserDto } from "@grub/contracts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "../../lib/utils";
import { UserFormDialog } from "./UserFormDialog";

interface UsersTableProps {
  initialUsers: AdminUserDto[];
  currentRole: AdminRole;
}

function roleBadgeClass(role: AdminRole) {
  switch (role) {
    case "superadmin": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    case "admin":      return "bg-purple-600/20 text-purple-300 border-purple-600/40";
    case "operator":   return "bg-blue-600/20 text-blue-300 border-blue-600/40";
    default:           return "bg-secondary text-muted-foreground";
  }
}

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return format(parseISO(val), "dd MMM yyyy HH:mm", { locale: es });
  } catch {
    return val;
  }
}

function canEditUser(actorRole: AdminRole, targetRole: AdminRole): boolean {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return targetRole !== "superadmin" && targetRole !== "admin";
  return false;
}

function availableRolesFor(actorRole: AdminRole): AdminRole[] {
  if (actorRole === "superadmin") return ["viewer", "operator", "admin", "superadmin"];
  if (actorRole === "admin") return ["viewer", "operator", "admin"];
  return [];
}

export function UsersTable({ initialUsers, currentRole }: UsersTableProps) {
  const [users, setUsers] = useState<AdminUserDto[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pendingVerified, setPendingVerified] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = currentRole === "superadmin" || currentRole === "admin";
  const canDelete = currentRole === "superadmin";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { users: AdminUserDto[] };
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  async function changeRole(userId: string, nextRole: AdminRole) {
    setPendingRole(userId);
    try {
      const res = await fetch("/api/admin/user-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: nextRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
        );
      }
    } finally {
      setPendingRole(null);
    }
  }

  async function toggleVerified(userId: string, current: boolean) {
    setPendingVerified(userId);
    try {
      const res = await fetch("/api/admin/user-verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_verified: !current }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_verified: !current } : u))
        );
      }
    } finally {
      setPendingVerified(null);
    }
  }

  async function deleteUser(user: AdminUserDto) {
    const confirmed = window.confirm(
      `¿Eliminar a ${user.email ?? user.id}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/user-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar el usuario.");
    }
  }

  function openCreate() {
    setSelectedUser(null);
    setDialogOpen(true);
  }

  function openEdit(user: AdminUserDto) {
    setSelectedUser(user);
    setDialogOpen(true);
  }

  function handleUpsertSuccess(saved: AdminUserDto) {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === saved.id);
      return exists
        ? prev.map((u) => (u.id === saved.id ? saved : u))
        : [saved, ...prev];
    });
  }

  const filtered = users.filter((u) =>
    roleFilter === "all" || u.role === roleFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="superadmin">Superadmin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          )}
        </div>
      </div>

      {deleteError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {deleteError}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Verificado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Último acceso</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? (
              filtered.map((user) => {
                const editable = canEditUser(currentRole, user.role);
                const roleOptions = availableRolesFor(currentRole);
                const isRolePending = pendingRole === user.id;
                const isVerifiedPending = pendingVerified === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.email ?? "—"}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {user.phone ?? "—"}
                    </TableCell>

                    <TableCell>
                      {editable && roleOptions.length > 0 ? (
                        <Select
                          value={user.role}
                          disabled={isRolePending}
                          onValueChange={(v) => changeRole(user.id, v as AdminRole)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn("capitalize text-xs", roleBadgeClass(user.role))}
                        >
                          {user.role}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <button
                        disabled={!canEdit || isVerifiedPending}
                        onClick={() => canEdit && toggleVerified(user.id, user.is_verified)}
                        title={user.is_verified ? "Quitar verificación" : "Marcar como verificado"}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                          user.is_verified
                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                          (!canEdit || isVerifiedPending) && "cursor-default opacity-50"
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {user.is_verified ? "Verificado" : "Sin verificar"}
                      </button>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.created_at)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(user.last_sign_in_at)}
                      </span>
                    </TableCell>

                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {editable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(user)}
                              title="Editar usuario"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && editable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteUser(user)}
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="h-24 text-center text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
      </p>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleUpsertSuccess}
        user={selectedUser}
        currentRole={currentRole}
      />
    </div>
  );
}
