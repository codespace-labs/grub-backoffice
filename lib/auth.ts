import "server-only";

import type { BackofficeRole, BackofficeSession } from "./backoffice-types";
import { resolveBackofficeAuth } from "./backoffice-session";

interface SupabaseUserResponse {
  id: string;
  email?: string | null;
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    role?: string;
  };
}

const AUTH_REQUEST_TIMEOUT_MS = 5000;

function resolveRole(user: SupabaseUserResponse): BackofficeRole {
  const rawRole = user.app_metadata?.role ?? user.user_metadata?.role ?? "viewer";
  if (rawRole === "superadmin" || rawRole === "admin" || rawRole === "operator" || rawRole === "viewer") {
    return rawRole;
  }
  return "viewer";
}

export async function getBackofficeSession(): Promise<BackofficeSession | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const auth = await resolveBackofficeAuth();
  if (!auth) return null;

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${auth.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const user = (await res.json()) as SupabaseUserResponse;

  return {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken ?? undefined,
    email: user.email ?? null,
    role: resolveRole(user),
    userId: user.id,
  };
}
