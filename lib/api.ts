import "server-only";

import type {
  AdminUserDto,
  ArtistDto,
  AuditLogDto,
  EventListItemDto,
  GenreDto,
  ManualEventOverrideDto,
  QualityIssueDto,
  SyncRunDto,
} from "@grub/contracts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function callAdmin<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json() as {
        error?: string;
        message?: string;
        code?: string | number;
      };
      if (typeof body.error === "string") {
        detail = `: ${body.error}`;
      } else if (typeof body.message === "string") {
        detail = `: ${body.message}`;
      } else if (body.code !== undefined) {
        detail = `: ${String(body.code)}`;
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(`Admin API ${path} failed: ${res.status}${detail}`);
  }

  return res.json() as Promise<T>;
}

export async function getAdminEvents(
  accessToken: string,
  params?: {
    source?: string;
    status?: "active" | "inactive";
    sort?: "recent";
    limit?: number;
  },
): Promise<EventListItemDto[]> {
  const search = new URLSearchParams();
  if (params?.source) search.set("source", params.source);
  if (params?.status) search.set("status", params.status);
  if (params?.sort)   search.set("sort", params.sort);
  if (params?.limit)  search.set("limit", String(params.limit));

  const suffix = search.size ? `?${search.toString()}` : "";
  const data = await callAdmin<{ events: EventListItemDto[] }>(`api-admin-events${suffix}`, accessToken);
  return data.events;
}

export async function getQualityIssues(accessToken: string): Promise<QualityIssueDto[]> {
  const data = await callAdmin<{ issues: QualityIssueDto[] }>("api-admin-quality-issues", accessToken);
  return data.issues;
}

export async function getAdminGenres(accessToken: string): Promise<GenreDto[]> {
  const data = await callAdmin<{ genres: GenreDto[] }>("api-admin-genres", accessToken);
  return data.genres;
}

export async function getAdminArtists(accessToken: string): Promise<ArtistDto[]> {
  const data = await callAdmin<{ artists: ArtistDto[] }>("api-admin-artists", accessToken);
  return data.artists;
}

export async function getSyncRuns(accessToken: string): Promise<SyncRunDto[]> {
  const data = await callAdmin<{ runs: SyncRunDto[] }>("api-admin-sync-runs", accessToken);
  return data.runs;
}

export async function getAdminUsers(accessToken: string): Promise<AdminUserDto[]> {
  const data = await callAdmin<{ users: AdminUserDto[] }>("api-admin-users", accessToken);
  return data.users;
}

export async function getAuditLogs(accessToken: string): Promise<AuditLogDto[]> {
  const data = await callAdmin<{ logs: AuditLogDto[] }>("api-admin-audit-logs", accessToken);
  return data.logs;
}

export async function getManualOverrides(accessToken: string): Promise<ManualEventOverrideDto[]> {
  const data = await callAdmin<{ overrides: ManualEventOverrideDto[] }>(
    "api-admin-manual-overrides",
    accessToken,
  );
  return data.overrides;
}
