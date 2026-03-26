import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  clearBackofficeAuthCookies,
  resolveBackofficeAuth,
  unauthorizedBackofficeResponse,
} from "../../../../lib/backoffice-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(req: Request) {
  const auth = await resolveBackofficeAuth();
  if (!auth) return unauthorizedBackofficeResponse();

  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-admin-user-ban`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (res.status === 401) {
    return clearBackofficeAuthCookies(
      NextResponse.json(payload, { status: 401 }),
    );
  }

  return applyBackofficeAuthCookies(
    NextResponse.json(payload, { status: res.status }),
    auth,
  );
}
