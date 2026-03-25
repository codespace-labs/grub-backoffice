import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  resolveBackofficeAuth,
  unauthorizedBackofficeResponse,
} from "../../../../lib/backoffice-session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(req: Request) {
  const auth = await resolveBackofficeAuth();
  if (!auth) return unauthorizedBackofficeResponse();

  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    countries?: string[];
  };

  if (!body.source) {
    return NextResponse.json({ error: "Missing source" }, { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-admin-source-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({
      source: body.source,
      countries: body.countries ?? ["PE"],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  return applyBackofficeAuthCookies(
    NextResponse.json(payload, { status: res.status }),
    auth,
  );
}
