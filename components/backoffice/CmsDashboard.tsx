"use client";

import { useMemo, useState } from "react";
import type { ArtistDto, GenreDto } from "@grub/contracts";
import type { BackofficeRole } from "../../lib/backoffice-types";
import { ConfirmModalProvider } from "./cms/ConfirmModalContext";
import { GenresTable } from "./cms/GenresTable";
import { ArtistsTable } from "./cms/ArtistsTable";

type Tab = "genres" | "artists";

export function CmsDashboard({
  role,
  initialGenres,
  initialArtists,
}: {
  role: BackofficeRole;
  initialGenres: GenreDto[];
  initialArtists: ArtistDto[];
}) {
  const [genres, setGenres] = useState(initialGenres);
  const [artists, setArtists] = useState(initialArtists);
  const [tab, setTab] = useState<Tab>("genres");

  const canEdit = role === "admin" || role === "operator";

  const artistCountByGenre = useMemo(() => {
    const counts = new Map<number, number>();
    for (const artist of artists) {
      for (const genre of artist.genres) {
        counts.set(genre.id, (counts.get(genre.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [artists]);

  function handleGenresChange(next: GenreDto[]) {
    setGenres(next);
    // Keep artist genre lists in sync when a genre is deleted
    const genreIds = new Set(next.map((g) => g.id));
    setArtists((prev) =>
      prev.map((a) => ({ ...a, genres: a.genres.filter((g) => genreIds.has(g.id)) })),
    );
  }

  return (
    <ConfirmModalProvider>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Géneros</div>
            <div className="mt-2 text-3xl font-bold">{genres.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">catálogo editable</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Artistas</div>
            <div className="mt-2 text-3xl font-bold">{artists.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">con edición editorial</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              Vinculaciones
            </div>
            <div className="mt-2 text-3xl font-bold">
              {artists.reduce((acc, a) => acc + a.genres.length, 0)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">artista ↔ género</div>
          </div>
        </div>

        {/* Tabbed panel */}
        <div className="rounded-2xl border border-border bg-card">
          {/* Tab headers */}
          <div className="flex border-b border-border">
            {(["genres", "artists"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  "px-6 py-4 text-sm font-medium transition-colors focus-visible:outline-none",
                  tab === t
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t === "genres" ? `Géneros (${genres.length})` : `Artistas (${artists.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {tab === "genres" ? (
              <GenresTable
                genres={genres}
                artistCountByGenre={artistCountByGenre}
                canEdit={canEdit}
                onGenresChange={handleGenresChange}
              />
            ) : (
              <ArtistsTable
                artists={artists}
                genres={genres}
                canEdit={canEdit}
                onArtistsChange={setArtists}
              />
            )}
          </div>
        </div>
      </div>
    </ConfirmModalProvider>
  );
}
