"use client";

import { useEffect, useState } from "react";
import type { ArtistDto, GenreDto } from "@grub/contracts";
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
import { apiSaveArtist } from "./cmsApi";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ArtistDraft = {
  id?: string;
  name: string;
  slug: string;
  photo_url: string;
  musicbrainz_id: string;
  genre_ids: number[];
};

const empty: ArtistDraft = { name: "", slug: "", photo_url: "", musicbrainz_id: "", genre_ids: [] };

type Props = {
  open: boolean;
  initial?: ArtistDto | null;
  genres: GenreDto[];
  onClose: () => void;
  onSaved: (artist: ArtistDto) => void;
};

export function ArtistFormDialog({ open, initial, genres, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ArtistDraft>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genreSearch, setGenreSearch] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(
        initial
          ? {
              id: initial.id,
              name: initial.name,
              slug: initial.slug,
              photo_url: initial.photo_url ?? "",
              musicbrainz_id: initial.musicbrainz_id ?? "",
              genre_ids: initial.genres.map((g) => g.id),
            }
          : empty,
      );
      setError(null);
      setGenreSearch("");
    }
  }, [open, initial]);

  async function handleSave() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await apiSaveArtist({ ...draft, slug: draft.slug.trim() || slugify(draft.name) });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const filteredGenres = genreSearch
    ? genres.filter((g) => g.name.toLowerCase().includes(genreSearch.toLowerCase()))
    : genres;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar artista" : "Nuevo artista"}</DialogTitle>
          <DialogDescription>
            Edita datos principales del artista y los géneros que lo representan.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={draft.name}
                autoFocus
                onChange={(e) =>
                  setDraft((c) => ({
                    ...c,
                    name: e.target.value,
                    slug: c.id ? c.slug : slugify(e.target.value),
                  }))
                }
                placeholder="ej. Bad Bunny"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={draft.slug}
                onChange={(e) => setDraft((c) => ({ ...c, slug: slugify(e.target.value) }))}
                placeholder="ej. bad-bunny"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Foto URL</label>
              <Input
                value={draft.photo_url}
                onChange={(e) => setDraft((c) => ({ ...c, photo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">MusicBrainz ID</label>
              <Input
                value={draft.musicbrainz_id}
                onChange={(e) => setDraft((c) => ({ ...c, musicbrainz_id: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Géneros{" "}
              <span className="font-normal text-muted-foreground">
                ({draft.genre_ids.length} seleccionados)
              </span>
            </label>
            <Input
              placeholder="Buscar género..."
              value={genreSearch}
              onChange={(e) => setGenreSearch(e.target.value)}
            />
            <div className="grid max-h-44 gap-1 overflow-auto rounded-xl border border-border p-3 md:grid-cols-2">
              {filteredGenres.map((genre) => {
                const checked = draft.genre_ids.includes(genre.id);
                return (
                  <label
                    key={genre.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="accent-primary"
                      onChange={() =>
                        setDraft((c) => ({
                          ...c,
                          genre_ids: checked
                            ? c.genre_ids.filter((id) => id !== genre.id)
                            : [...c.genre_ids, genre.id],
                        }))
                      }
                    />
                    <span>{genre.name}</span>
                  </label>
                );
              })}
              {filteredGenres.length === 0 ? (
                <p className="col-span-2 py-2 text-center text-sm text-muted-foreground">
                  Sin resultados
                </p>
              ) : null}
            </div>
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
