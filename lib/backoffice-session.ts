import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth-constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const AUTH_REQUEST_TIMEOUT_MS = 5000;

type SessionTokens = {
  accessToken: string;
  refreshToken: string | null;
};

export type ResolvedBackofficeAuth = SessionTokens & {
  refreshed: boolean;
};

type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
};

function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge: number,
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

async function validateAccessToken(accessToken: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  let check: Response;
  try {
    check = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch {
    return false;
  }

  return check.ok;
}

async function refreshSession(refreshToken: string): Promise<SessionTokens | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  let refresh: Response;
  try {
    refresh = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!refresh.ok) return null;

  const data = (await refresh.json()) as RefreshResponse;
  const nextAccessToken = data.access_token?.trim();
  const nextRefreshToken = data.refresh_token?.trim() ?? refreshToken;

  if (!nextAccessToken) return null;

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
  };
}

export async function resolveBackofficeAuth(): Promise<ResolvedBackofficeAuth | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value?.trim();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value?.trim() ?? null;

  if (!accessToken) return null;

  if (await validateAccessToken(accessToken)) {
    return {
      accessToken,
      refreshToken,
      refreshed: false,
    };
  }

  if (!refreshToken) return null;

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed) return null;

  return {
    ...refreshed,
    refreshed: true,
  };
}

export function applyBackofficeAuthCookies(
  response: NextResponse,
  auth: ResolvedBackofficeAuth,
): NextResponse {
  if (!auth.refreshed) return response;

  setCookie(response, ACCESS_TOKEN_COOKIE, auth.accessToken, THIRTY_DAYS);

  if (auth.refreshToken) {
    setCookie(response, REFRESH_TOKEN_COOKIE, auth.refreshToken, THIRTY_DAYS);
  }

  return response;
}

export function clearBackofficeAuthCookies(response: NextResponse): NextResponse {
  setCookie(response, ACCESS_TOKEN_COOKIE, "", 0);
  setCookie(response, REFRESH_TOKEN_COOKIE, "", 0);
  return response;
}

export function unauthorizedBackofficeResponse(): NextResponse {
  return clearBackofficeAuthCookies(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}
