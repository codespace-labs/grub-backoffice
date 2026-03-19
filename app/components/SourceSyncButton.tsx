"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { backofficeSupabase } from "../../lib/supabase-browser";

export function SourceSyncButton({
  source,
  disabled,
}: {
  source: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSync() {
    setMessage(null);

    startTransition(async () => {
      const { data } = await backofficeSupabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sesión vencida");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-admin-source-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          source,
          countries: ["PE"],
        }),
      });

      if (!res.ok) {
        setMessage("No se pudo disparar");
        return;
      }

      setMessage("Sync lanzado");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={onSync}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(20,184,166,0.14)",
          color: "#99f6e4",
          padding: "8px 10px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Correr sync
      </button>
      <div style={{ color: "var(--muted)", fontSize: 12, minHeight: 16 }}>{message ?? " "}</div>
    </div>
  );
}
