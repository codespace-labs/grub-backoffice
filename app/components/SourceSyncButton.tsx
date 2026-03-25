"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
      const res = await fetch("/api/sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, countries: ["PE"] }),
      });

      const payload = await res.json().catch(() => ({})) as {
        response?: {
          total_failed?: number;
          results?: Array<{
            inserted?: number;
            updated?: number;
            failed?: number;
            skipped?: number;
            diagnostics?: Record<string, unknown>;
          }>;
        };
      };

      if (!res.ok) {
        const errMsg = (payload as { error?: string }).error;
        setMessage(
          errMsg === "Unauthorized" || errMsg === "Forbidden"
            ? "Sin permisos para ejecutar el sync."
            : "No se pudo disparar el sync. Revisa el worker.",
        );
        return;
      }

      const result = payload.response?.results?.[0];
      const inserted = Number(result?.inserted ?? 0);
      const updated = Number(result?.updated ?? 0);
      const failed = Number(result?.failed ?? 0);
      const skipped = Number(result?.skipped ?? 0);
      const skippedReasons = result?.diagnostics && typeof result.diagnostics.skipped_reasons === "object"
        ? Object.entries(result.diagnostics.skipped_reasons as Record<string, unknown>)
          .filter(([, value]) => typeof value === "number" && value > 0)
          .map(([reason, value]) => `${reason}: ${value}`)
          .slice(0, 2)
          .join(" · ")
        : "";

      if (inserted === 0 && updated === 0 && failed === 0) {
        setMessage(
          skipped > 0
            ? `Sin cambios en base. ${skipped} omitidos${skippedReasons ? ` (${skippedReasons})` : ""}.`
            : "Sync ejecutado, pero no hubo inserts ni updates.",
        );
      } else {
        setMessage(`${inserted} insertados · ${updated} actualizados${failed > 0 ? ` · ${failed} fallidos` : ""}`);
      }
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
          background: isPending ? "rgba(20,184,166,0.07)" : "rgba(20,184,166,0.14)",
          color: "#99f6e4",
          padding: "8px 10px",
          fontSize: 13,
          cursor: isPending ? "wait" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {isPending ? "Ejecutando..." : "Correr sync"}
      </button>
      <div style={{ color: "var(--muted)", fontSize: 12, minHeight: 16 }}>{message ?? " "}</div>
    </div>
  );
}
