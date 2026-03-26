import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-constants";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type LoginResponse = {
  access_token?: string;
  refresh_token?: string;
};

function setSessionCookies(response: NextResponse, accessToken: string, refreshToken?: string) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  if (refreshToken) {
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
  }
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let email: string | undefined;
  let password: string | undefined;

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    email = body?.email?.trim();
    password = body?.password;
  } else {
    const formData = await req.formData().catch(() => null);
    email = formData?.get("email")?.toString().trim();
    password = formData?.get("password")?.toString();
  }

  if (!email || !password) {
    return buildErrorResponse(req, "Email y contraseña son obligatorios", 400);
  }

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = (await authRes.json().catch(() => null)) as
    | LoginResponse
    | { msg?: string; error_description?: string; error?: string }
    | null;

  if (!authRes.ok) {
    const error =
      (payload && "msg" in payload && payload.msg) ||
      (payload && "error_description" in payload && payload.error_description) ||
      (payload && "error" in payload && payload.error) ||
      "No se pudo iniciar sesión";

    return buildErrorResponse(req, error, authRes.status);
  }

  const accessToken = payload && "access_token" in payload ? payload.access_token?.trim() : "";
  const refreshToken = payload && "refresh_token" in payload ? payload.refresh_token?.trim() : "";

  if (!accessToken) {
    return buildErrorResponse(req, "Supabase no devolvió una sesión válida", 502);
  }

  const response = isJsonRequest(req)
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL("/", req.url));
  setSessionCookies(response, accessToken, refreshToken || undefined);
  return response;
}

function isJsonRequest(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

function buildErrorResponse(req: Request, error: string, status: number) {
  if (isJsonRequest(req)) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url), {
    status: 303,
  });
}
