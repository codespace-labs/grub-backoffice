"use client";

import { useRouter } from "next/navigation";
import { backofficeSupabase } from "../../lib/supabase-browser";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await backofficeSupabase.auth.signOut();
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      style={{
        border: "1px solid rgba(148,163,184,0.2)",
        background: "rgba(15,23,42,0.72)",
        color: "var(--text)",
        borderRadius: 999,
        padding: "10px 14px",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      Cerrar sesión
    </button>
  );
}
