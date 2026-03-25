"use client";

import { useMemo, useState } from "react";
import type { ArtistDto, GenreDto } from "@grub/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useConfirm } from "./ConfirmModalContext";
import { ArtistFormDialog } from "./ArtistFormDialog";
import { apiDeleteArtist, apiDeleteArtists } from "./cmsApi";

type Props = {
  artists: ArtistDto[];
  genres: GenreDto[];
  canEdit: boolean;
  onArtistsChange: (artists: ArtistDto[]) => void;
};

export function ArtistsTable({ artists, genres, canEdit, onArtistsChange }: Props) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingArtist, setEditingArtist] = useState<ArtistDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return artists.filter((a) => {
      const matchesName =
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.slug.toLowerCase().includes(search.toLowerCase());
      const matchesGenre =
        genreFilter === "__none__"
          ? a.genres.length === 0
          : !genreFilter || a.genres.some((g) => g.id === Number(genreFilter));
      return matchesName && matchesGenre;
    });
  }, [artists, search, genreFilter]);

  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((a) => next.delete(a.id));
      } else {
        filtered.forEach((a) => next.add(a.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(artist: ArtistDto) {
    const ok = await confirm({
      title: "Eliminar artista",
      message: `¿Eliminar "${artist.name}"? También se quitarán sus vinculaciones de eventos y géneros. Esta acción no se puede deshacer.`,
      type: "danger",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;

    setDeletingIds((prev) => new Set(prev).add(artist.id));
    setError(null);
    try {
      await apiDeleteArtist(artist.id);
      onArtistsChange(artists.filter((a) => a.id !== artist.id));
      setSelected((prev) => { const next = new Set(prev); next.delete(artist.id); return next; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(artist.id); return next; });
    }
  }

  async function handleBatchDelete() {
    const ids = [...selected];
    const names = artists
      .filter((a) => ids.includes(a.id))
      .map((a) => a.name)
      .slice(0, 3)
      .join(", ");
    const suffix = ids.length > 3 ? ` y ${ids.length - 3} más` : "";
    const ok = await confirm({
      title: `Eliminar ${ids.length} artista${ids.length > 1 ? "s" : ""}`,
      message: `¿Eliminar "${names}${suffix}"? Esta acción no se puede deshacer.`,
      type: "danger",
      confirmLabel: `Eliminar ${ids.length}`,
    });
    if (!ok) return;

    ids.forEach((id) => setDeletingIds((prev) => new Set(prev).add(id)));
    setError(null);
    try {
      await apiDeleteArtists(ids);
      onArtistsChange(artists.filter((a) => !ids.includes(a.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingIds(new Set());
    }
  }

  function handleSaved(artist: ArtistDto) {
    const updated = editingArtist
      ? artists.map((a) => (a.id === artist.id ? artist : a))
      : [...artists, artist];
    onArtistsChange([...updated].sort((a, b) => a.name.localeCompare(b.name)));
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar artista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos los géneros</option>
            <option value="__none__">Sin género</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
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
            onClick={() => { setEditingArtist(null); setFormOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo artista
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Artista</th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                Géneros
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                MBID
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {search || genreFilter
                    ? "Sin resultados para los filtros actuales."
                    : "No hay artistas registrados."}
                </td>
              </tr>
            ) : (
              filtered.map((artist) => (
                <tr key={artist.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(artist.id)}
                      onChange={() => toggleOne(artist.id)}
                      className="accent-primary"
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {artist.photo_url ? (
                        <img
                          src={artist.photo_url}
                          alt={artist.name}
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                          {artist.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{artist.name}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {artist.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {artist.genres.length > 0 ? (
                        <>
                          {artist.genres.slice(0, 3).map((g) => (
                            <span
                              key={g.id}
                              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                            >
                              {g.name}
                            </span>
                          ))}
                          {artist.genres.length > 3 ? (
                            <span className="text-xs text-muted-foreground">
                              +{artist.genres.length - 3}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="font-mono text-xs text-muted-foreground">
                      {artist.musicbrainz_id ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => { setEditingArtist(artist); setFormOpen(true); }}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={!canEdit || deletingIds.has(artist.id)}
                        onClick={() => handleDelete(artist)}
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
        {filtered.length} de {artists.length} artistas
        {someSelected ? ` · ${selected.size} seleccionado${selected.size > 1 ? "s" : ""}` : ""}
      </p>

      <ArtistFormDialog
        open={formOpen}
        initial={editingArtist}
        genres={genres}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
