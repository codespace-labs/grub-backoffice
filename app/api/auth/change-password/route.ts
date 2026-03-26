import { NextResponse } from "next/server";
import {
  applyBackofficeAuthCookies,
  clearBackofficeAuthCookies,
} from "../../../../lib/backoffice-session";
import { getBackofficeSession } from "../../../../lib/auth";
import { createAdminSupabase } from "../../../../lib/supabase-admin";

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  const session = await getBackofficeSession();
  if (!session) {
    return clearBackofficeAuthCookies(
      NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    );
  }

  try {
    const supabase = createAdminSupabase();
    const { error } = await supabase.auth.admin.updateUserById(session.userId, {
      password,
    });

    if (error) {
      const status = error.message === "User not found" ? 404 : 400;
      return applyBackofficeAuthCookies(
        NextResponse.json(
          { error: error.message || "No se pudo cambiar la contraseña" },
          { status },
        ),
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? null,
          refreshed: false,
        },
      );
    }

    return applyBackofficeAuthCookies(
      NextResponse.json({ ok: true }),
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        refreshed: false,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar la contraseña";
    if (message === "No autenticado") {
      return clearBackofficeAuthCookies(
        NextResponse.json({ error: message }, { status: 401 }),
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
