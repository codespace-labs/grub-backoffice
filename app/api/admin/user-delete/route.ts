import { NextResponse } from "next/server";
import { getBackofficeSession } from "../../../../lib/auth";
import {
  applyBackofficeAuthCookies,
  clearBackofficeAuthCookies,
} from "../../../../lib/backoffice-session";
import { createAdminSupabase } from "../../../../lib/supabase-admin";

type BackofficeRole = "superadmin" | "admin" | "operator" | "viewer";

function resolveRole(
  appMetadata: Record<string, unknown> | undefined,
  userMetadata: Record<string, unknown> | undefined,
): BackofficeRole {
  const rawRole = appMetadata?.role ?? userMetadata?.role ?? "viewer";
  if (rawRole === "superadmin" || rawRole === "admin" || rawRole === "operator" || rawRole === "viewer") {
    return rawRole;
  }
  return "viewer";
}

export async function POST(req: Request) {
  const session = await getBackofficeSession();
  if (!session) {
    return clearBackofficeAuthCookies(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  if (session.role !== "admin" && session.role !== "superadmin") {
    return applyBackofficeAuthCookies(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        refreshed: false,
      },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    source?: "backoffice" | "customer";
    clerk_user_id?: string | null;
  };

  const userId = body.user_id?.trim();
  const source = body.source === "customer" ? "customer" : "backoffice";
  const clerkUserId = body.clerk_user_id?.trim() ?? null;

  if (!userId) {
    return applyBackofficeAuthCookies(
      NextResponse.json({ error: "user_id requerido" }, { status: 400 }),
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        refreshed: false,
      },
    );
  }

  try {
    const supabase = createAdminSupabase();

    if (source === "customer") {
      let targetId = userId;

      if (clerkUserId) {
        const { data: customerByClerk, error: byClerkError } = await supabase
          .from("users")
          .select("id, email, clerk_user_id")
          .eq("clerk_user_id", clerkUserId)
          .maybeSingle();

        if (byClerkError) throw byClerkError;
        if (!customerByClerk) {
          return applyBackofficeAuthCookies(
            NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 }),
            {
              accessToken: session.accessToken,
              refreshToken: session.refreshToken ?? null,
              refreshed: false,
            },
          );
        }

        targetId = customerByClerk.id;
      }

      const { data: existingCustomer, error: customerError } = await supabase
        .from("users")
        .select("id, email, clerk_user_id")
        .eq("id", targetId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!existingCustomer) {
        return applyBackofficeAuthCookies(
          NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 }),
          {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken ?? null,
            refreshed: false,
          },
        );
      }

      const { error: deleteCustomerError } = await supabase
        .from("users")
        .delete()
        .eq("id", targetId);

      if (deleteCustomerError) throw deleteCustomerError;

      await supabase.schema("admin").from("audit_logs").insert({
        actor_user_id: session.userId,
        actor_role: session.role,
        action: "admin.customer.deleted",
        entity_type: "public_user",
        entity_id: targetId,
        payload: {
          email: existingCustomer.email ?? null,
          clerk_user_id: existingCustomer.clerk_user_id ?? null,
        },
      });

      return applyBackofficeAuthCookies(
        NextResponse.json({ ok: true }),
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? null,
          refreshed: false,
        },
      );
    }

    if (userId === session.userId) {
      return applyBackofficeAuthCookies(
        NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 }),
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? null,
          refreshed: false,
        },
      );
    }

    const { data: existing, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    if (fetchError || !existing.user) {
      return applyBackofficeAuthCookies(
        NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }),
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? null,
          refreshed: false,
        },
      );
    }

    const targetRole = resolveRole(existing.user.app_metadata, existing.user.user_metadata);
    if (session.role !== "superadmin" && targetRole === "superadmin") {
      return applyBackofficeAuthCookies(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken ?? null,
          refreshed: false,
        },
      );
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    await supabase.schema("admin").from("audit_logs").insert({
      actor_user_id: session.userId,
      actor_role: session.role,
      action: "admin.user.deleted",
      entity_type: "auth_user",
      entity_id: userId,
      payload: { email: existing.user.email ?? null },
    });

    return applyBackofficeAuthCookies(
      NextResponse.json({ ok: true }),
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        refreshed: false,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return applyBackofficeAuthCookies(
      NextResponse.json({ error: message }, { status: 500 }),
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        refreshed: false,
      },
    );
  }
}
