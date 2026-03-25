"use client";

import { backofficeSupabase } from "../../../lib/supabase-browser";
import type { ArtistDto, GenreDto } from "@grub/contracts";

const API_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function getToken(): Promise<string> {
  const { data } = await backofficeSupabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión vencida");
  return token;
}

async function adminFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_BASE}/functions/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

// ── Genres ──────────────────────────────────────────────────────────────────

export async function apiSaveGenre(draft: {
  id?: number;
  name: string;
  slug: string;
}): Promise<GenreDto> {
  const res = await adminFetch(
    draft.id ? `api-admin-genres/${draft.id}` : "api-admin-genres",
    { method: draft.id ? "PATCH" : "POST", body: JSON.stringify({ name: draft.name.trim(), slug: draft.slug.trim() }) },
  );
  const json = await parseResponse<{ genre: GenreDto }>(res);
  return json.genre;
}

export async function apiDeleteGenre(id: number): Promise<void> {
  const res = await adminFetch(`api-admin-genres/${id}`, { method: "DELETE" });
  await parseResponse<unknown>(res);
}

export async function apiDeleteGenres(ids: number[]): Promise<void> {
  await Promise.all(ids.map(apiDeleteGenre));
}

// ── Artists ──────────────────────────────────────────────────────────────────

export async function apiSaveArtist(draft: {
  id?: string;
  name: string;
  slug: string;
  photo_url: string;
  musicbrainz_id: string;
  genre_ids: number[];
}): Promise<ArtistDto> {
  const payload = {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    photo_url: draft.photo_url.trim() || null,
    musicbrainz_id: draft.musicbrainz_id.trim() || null,
    genre_ids: draft.genre_ids,
  };
  const res = await adminFetch(
    draft.id ? `api-admin-artists/${draft.id}` : "api-admin-artists",
    { method: draft.id ? "PATCH" : "POST", body: JSON.stringify(payload) },
  );
  const json = await parseResponse<{ artist: ArtistDto }>(res);
  return json.artist;
}

export async function apiDeleteArtist(id: string): Promise<void> {
  const res = await adminFetch(`api-admin-artists/${id}`, { method: "DELETE" });
  await parseResponse<unknown>(res);
}

export async function apiDeleteArtists(ids: string[]): Promise<void> {
  await Promise.all(ids.map(apiDeleteArtist));
}
