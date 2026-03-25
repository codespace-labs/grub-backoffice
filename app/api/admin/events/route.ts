import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  resolveBackofficeAuth,
  unauthorizedBackofficeResponse,
} from "../../../../lib/backoffice-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function GET(req: Request) {
  const auth = await resolveBackofficeAuth();
  if (!auth) return unauthorizedBackofficeResponse();

  const { searchParams } = new URL(req.url);
  const upstream = new URL(`${SUPABASE_URL}/functions/v1/api-admin-events`);
  for (const [key, value] of searchParams.entries()) {
    upstream.searchParams.set(key, value);
  }

  const res = await fetch(upstream.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    cache: "no-store",
  });

  const payload = await res.json().catch(() => ({}));
  return applyBackofficeAuthCookies(
    NextResponse.json(payload, { status: res.status }),
    auth,
  );
}

export async function POST(req: Request) {
  const auth = await resolveBackofficeAuth();
  if (!auth) return unauthorizedBackofficeResponse();

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-admin-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  return applyBackofficeAuthCookies(
    NextResponse.json(payload, { status: res.status }),
    auth,
  );
}
