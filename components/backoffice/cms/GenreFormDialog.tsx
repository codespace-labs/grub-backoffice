"use client";

import { useEffect, useState } from "react";
import type { GenreDto } from "@grub/contracts";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { apiSaveGenre } from "./cmsApi";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type GenreDraft = { id?: number; name: string; slug: string };
const empty: GenreDraft = { name: "", slug: "" };

type Props = {
  open: boolean;
  initial?: GenreDto | null;
  onClose: () => void;
  onSaved: (genre: GenreDto) => void;
};

export function GenreFormDialog({ open, initial, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<GenreDraft>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial ? { id: initial.id, name: initial.name, slug: initial.slug } : empty);
      setError(null);
    }
  }, [open, initial]);

  async function handleSave() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await apiSaveGenre({ ...draft, slug: draft.slug.trim() || slugify(draft.name) });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar género" : "Nuevo género"}</DialogTitle>
          <DialogDescription>
            Ajusta el nombre visible y el slug utilizado por el sistema.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  name: e.target.value,
                  slug: c.id ? c.slug : slugify(e.target.value),
                }))
              }
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              placeholder="ej. Electrónica"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={draft.slug}
              onChange={(e) => setDraft((c) => ({ ...c, slug: slugify(e.target.value) }))}
              placeholder="ej. electronica"
            />
            <p className="text-xs text-muted-foreground">
              Identificador único en URLs y filtros. Se genera automáticamente desde el nombre.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !draft.name.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
