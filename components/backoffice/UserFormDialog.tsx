"use client";

import { useEffect, useState } from "react";
import type { AdminRole, AdminUserDto } from "@grub/contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: AdminUserDto) => void;
  user?: AdminUserDto | null;
  currentRole: AdminRole;
}

function availableRolesFor(actorRole: AdminRole): AdminRole[] {
  if (actorRole === "superadmin") return ["viewer", "operator", "admin", "superadmin"];
  if (actorRole === "admin") return ["viewer", "operator"];
  return [];
}

export function UserFormDialog({
  open,
  onOpenChange,
  onSuccess,
  user,
  currentRole,
}: UserFormDialogProps) {
  const isEditing = Boolean(user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "");
      setPassword("");
      // Normalize stored phone to E.164 display format
      const storedPhone = user?.phone ?? "";
      setPhone(storedPhone && !storedPhone.startsWith("+") ? `+${storedPhone}` : storedPhone);
      setRole(user?.role ?? "viewer");
      setIsVerified(user?.is_verified ?? false);
      setError(null);
    }
  }, [open, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEditing && !email.trim()) {
      setError("El email es obligatorio.");
      return;
    }
    if (!isEditing && !password.trim()) {
      setError("La contraseña es obligatoria al crear un usuario.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        role,
        is_verified: isVerified,
      };

      if (isEditing) body.user_id = user!.id;
      if (email.trim()) body.email = email.trim();
      if (password.trim()) body.password = password.trim();
      body.phone = phone.trim() || null;

      const res = await fetch("/api/admin/user-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({})) as { ok?: boolean; user?: AdminUserDto; error?: string };

      if (!res.ok || !json.user) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }

      onSuccess(json.user);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const roleOptions = availableRolesFor(currentRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos del usuario. Deja la contraseña vacía para no cambiarla."
              : "Completa los datos para crear un nuevo usuario del backoffice."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="uf-email">Email</Label>
            <Input
              id="uf-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uf-phone">
              Teléfono{" "}
              <span className="text-muted-foreground text-xs">(para login por celular)</span>
            </Label>
            <Input
              id="uf-phone"
              type="tel"
              placeholder="+51912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Formato internacional, ej: +51912345678
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uf-password">
              Contraseña{" "}
              {isEditing && (
                <span className="text-muted-foreground text-xs">(dejar vacío para no cambiar)</span>
              )}
            </Label>
            <Input
              id="uf-password"
              type="password"
              placeholder={isEditing ? "••••••••" : "Mínimo 6 caracteres"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={cn(
                  "h-4 w-4",
                  isVerified ? "text-emerald-400" : "text-muted-foreground"
                )}
              />
              <div>
                <p className="text-sm font-medium">Cliente verificado</p>
                <p className="text-xs text-muted-foreground">
                  Acceso a funcionalidades premium
                </p>
              </div>
            </div>
            <Switch
              checked={isVerified}
              onCheckedChange={setIsVerified}
              disabled={loading}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
