"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (next.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: next }),
      });

      const body = await res.json() as { error?: string };

      if (!res.ok) {
        setError(body.error ?? "No se pudo cambiar la contraseña");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Cambiar contraseña"
          aria-label="Cambiar contraseña"
          className="gap-2"
        >
          <KeyRound className="h-4 w-4" />
          <span className="hidden sm:inline">Contraseña</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
        </DialogHeader>

        {success ? (
          <p className="py-4 text-center text-sm text-green-400">
            Contraseña actualizada correctamente
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cp-next">Nueva contraseña</Label>
              <input
                id="cp-next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cp-confirm">Confirmar contraseña</Label>
              <input
                id="cp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
