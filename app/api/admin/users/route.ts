import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  clearBackofficeAuthCookies,
  resolveBackofficeAuth,
  unauthorizedBackofficeResponse,
} from "../../../../lib/backoffice-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function GET() {
  const auth = await resolveBackofficeAuth();
  if (!auth) return unauthorizedBackofficeResponse();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-admin-users`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    cache: "no-store",
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
