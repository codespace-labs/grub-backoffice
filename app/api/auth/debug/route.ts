import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  resolveBackofficeAuth,
} from "../../../../lib/backoffice-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await resolveBackofficeAuth();

  if (!auth) {
    return NextResponse.json({
      ok: false,
      auth: null,
      reason: "No valid backoffice session found in cookies",
    });
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    cache: "no-store",
  });

  const adminEventsRes = await fetch(`${SUPABASE_URL}/functions/v1/api-admin-events?limit=1`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    cache: "no-store",
  });

  const response = NextResponse.json({
    ok: userRes.ok && adminEventsRes.ok,
    auth: {
      refreshed: auth.refreshed,
      hasAccessToken: Boolean(auth.accessToken),
      hasRefreshToken: Boolean(auth.refreshToken),
      accessTokenPreview: auth.accessToken.slice(0, 24),
    },
    userCheck: {
      status: userRes.status,
      body: await parseJsonSafe(userRes),
    },
    adminEventsCheck: {
      status: adminEventsRes.status,
      body: await parseJsonSafe(adminEventsRes),
    },
  });

  return applyBackofficeAuthCookies(response, auth);
}
