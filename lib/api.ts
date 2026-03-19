import "server-only";

import type {
  AdminUserDto,
  AuditLogDto,
  EventListItemDto,
  ManualEventOverrideDto,
  QualityIssueDto,
  SyncRunDto,
} from "@grub/contracts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

async function callAdmin<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Admin API ${path} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getAdminEvents(
  accessToken: string,
  params?: {
    source?: string;
    status?: "active" | "inactive";
    limit?: number;
  },
): Promise<EventListItemDto[]> {
  const search = new URLSearchParams();
  if (params?.source) search.set("source", params.source);
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));

  const suffix = search.size ? `?${search.toString()}` : "";
  const data = await callAdmin<{ events: EventListItemDto[] }>(`api-admin-events${suffix}`, accessToken);
  return data.events;
}

export async function getQualityIssues(accessToken: string): Promise<QualityIssueDto[]> {
  const data = await callAdmin<{ issues: QualityIssueDto[] }>("api-admin-quality-issues", accessToken);
  return data.issues;
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
