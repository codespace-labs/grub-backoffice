"use client";

import { useMemo, useState } from "react";
import type { GenreDto } from "@grub/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useConfirm } from "./ConfirmModalContext";
import { GenreFormDialog } from "./GenreFormDialog";
import { apiDeleteGenre, apiDeleteGenres } from "./cmsApi";

type Props = {
  genres: GenreDto[];
  artistCountByGenre: Map<number, number>;
  canEdit: boolean;
  onGenresChange: (genres: GenreDto[]) => void;
};

export function GenresTable({ genres, artistCountByGenre, canEdit, onGenresChange }: Props) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingGenre, setEditingGenre] = useState<GenreDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      genres.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [genres, search],
  );

  const allSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((g) => next.delete(g.id));
      } else {
        filtered.forEach((g) => next.add(g.id));
      }
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(genre: GenreDto) {
    const ok = await confirm({
      title: "Eliminar género",
      message: `¿Eliminar "${genre.name}"? También se quitará de artistas y eventos vinculados. Esta acción no se puede deshacer.`,
      type: "danger",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;

    setDeletingIds((prev) => new Set(prev).add(genre.id));
    setError(null);
    try {
      await apiDeleteGenre(genre.id);
      onGenresChange(genres.filter((g) => g.id !== genre.id));
      setSelected((prev) => { const next = new Set(prev); next.delete(genre.id); return next; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(genre.id); return next; });
    }
  }

  async function handleBatchDelete() {
    const ids = [...selected];
    const names = genres
      .filter((g) => ids.includes(g.id))
      .map((g) => g.name)
      .slice(0, 3)
      .join(", ");
    const suffix = ids.length > 3 ? ` y ${ids.length - 3} más` : "";
    const ok = await confirm({
      title: `Eliminar ${ids.length} género${ids.length > 1 ? "s" : ""}`,
      message: `¿Eliminar "${names}${suffix}"? Esta acción no se puede deshacer.`,
      type: "danger",
      confirmLabel: `Eliminar ${ids.length}`,
    });
    if (!ok) return;

    ids.forEach((id) => setDeletingIds((prev) => new Set(prev).add(id)));
    setError(null);
    try {
      await apiDeleteGenres(ids);
      onGenresChange(genres.filter((g) => !ids.includes(g.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingIds(new Set());
    }
  }

  function handleSaved(genre: GenreDto) {
    const updated = editingGenre
      ? genres.map((g) => (g.id === genre.id ? genre : g))
      : [...genres, genre];
    onGenresChange([...updated].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          {someSelected && canEdit ? (
            <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar {selected.size}
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={!canEdit}
            onClick={() => { setEditingGenre(null); setFormOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo género
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-primary"
                  disabled={!canEdit || filtered.length === 0}
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Artistas</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {search ? "Sin resultados para la búsqueda." : "No hay géneros registrados."}
                </td>
              </tr>
            ) : (
              filtered.map((genre) => (
                <tr key={genre.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(genre.id)}
                      onChange={() => toggleOne(genre.id)}
                      className="accent-primary"
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{genre.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{genre.slug}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {artistCountByGenre.get(genre.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => { setEditingGenre(genre); setFormOpen(true); }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={!canEdit || deletingIds.has(genre.id)}
                        onClick={() => handleDelete(genre)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {genres.length} géneros
        {someSelected ? ` · ${selected.size} seleccionado${selected.size > 1 ? "s" : ""}` : ""}
      </p>

      <GenreFormDialog
        open={formOpen}
        initial={editingGenre}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
