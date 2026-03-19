"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { backofficeSupabase } from "../../lib/supabase-browser";

export function EventActiveToggle({
  eventId,
  isActive,
  disabled,
}: {
  eventId: string;
  isActive: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    const nextValue = !active;
    setActive(nextValue);
    setMessage(null);

    startTransition(async () => {
      const { data } = await backofficeSupabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setActive(isActive);
        setMessage("Sesión vencida");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-admin-event-deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventId,
          isActive: nextValue,
          reason: "backoffice_toggle",
        }),
      });

      if (!res.ok) {
        setActive(isActive);
        setMessage("No se pudo guardar");
        return;
      }

      setMessage(nextValue ? "Activado" : "Desactivado");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={onToggle}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.22)",
          background: active ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
          color: active ? "#86efac" : "#fcd34d",
          padding: "8px 10px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {active ? "Activo" : "Inactivo"}
      </button>
      <div style={{ color: "var(--muted)", fontSize: 12, minHeight: 16 }}>{message ?? " "}</div>
    </div>
  );
}
