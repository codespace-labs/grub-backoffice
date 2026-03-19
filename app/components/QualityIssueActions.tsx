"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { backofficeSupabase } from "../../lib/supabase-browser";

export function QualityIssueActions({
  issueId,
  status,
  disabled,
}: {
  issueId: string;
  status: "open" | "ignored" | "resolved";
  disabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: "ignored" | "resolved") {
    setMessage(null);

    startTransition(async () => {
      const { data } = await backofficeSupabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sesión vencida");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-admin-quality-issue-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          issueId,
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        setMessage("No se pudo actualizar");
        return;
      }

      setMessage(nextStatus === "resolved" ? "Resuelto" : "Ignorado");
      router.refresh();
    });
  }

  if (status !== "open") {
    return <div style={{ color: "var(--muted)", fontSize: 12 }}>Estado final: {status}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" disabled={disabled || isPending} onClick={() => updateStatus("ignored")} style={buttonStyle}>
          Ignorar
        </button>
        <button type="button" disabled={disabled || isPending} onClick={() => updateStatus("resolved")} style={buttonStyle}>
          Resolver
        </button>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, minHeight: 16 }}>{message ?? " "}</div>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(15,23,42,0.72)",
  color: "var(--text)",
  padding: "8px 10px",
  fontSize: 13,
  cursor: "pointer",
};
