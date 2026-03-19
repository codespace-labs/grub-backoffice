import "server-only";

import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth-constants";

export type BackofficeRole = "admin" | "operator" | "viewer";

export interface BackofficeSession {
  accessToken: string;
  refreshToken?: string;
  email: string | null;
  role: BackofficeRole;
  userId: string;
}

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

function resolveRole(user: SupabaseUserResponse): BackofficeRole {
  const rawRole = user.app_metadata?.role ?? user.user_metadata?.role ?? "viewer";
  if (rawRole === "admin" || rawRole === "operator" || rawRole === "viewer") {
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

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value?.trim();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value?.trim();

  if (!accessToken) {
    return null;
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const user = (await res.json()) as SupabaseUserResponse;

  return {
    accessToken,
    refreshToken,
    email: user.email ?? null,
    role: resolveRole(user),
    userId: user.id,
  };
}
