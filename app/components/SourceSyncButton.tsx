"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../../components/backoffice/ui/button";

export function SourceSyncButton({
  source,
  fallbackSources,
  disabled,
  label = "Correr sync",
  idleMessage = " ",
}: {
  source?: string;
  fallbackSources?: string[];
  disabled: boolean;
  label?: string;
  idleMessage?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function triggerSync(sourceToRun?: string) {
    const res = await fetch("/api/sync/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(sourceToRun ? { source: sourceToRun } : {}),
        countries: ["PE"],
      }),
    });

    const payload = await res.json().catch(() => ({})) as {
      error?: string;
      response?: {
        results?: Array<{
          inserted?: number;
          updated?: number;
          failed?: number;
          skipped?: number;
          diagnostics?: Record<string, unknown>;
        }>;
      };
    };

    return { res, payload };
  }

  function onSync() {
    setMessage(null);

    startTransition(async () => {
      let res: Response;
      let payload: Awaited<ReturnType<typeof triggerSync>>["payload"];

      if (!source && fallbackSources?.length) {
        const fallbackRuns = await Promise.all(fallbackSources.map((item) => triggerSync(item)));
        const failedFallback = fallbackRuns.find(({ res: fallbackRes }) => !fallbackRes.ok);

        if (failedFallback) {
          res = failedFallback.res;
          payload = failedFallback.payload;
        } else {
          res = new Response(null, { status: 200 });
          payload = {
            response: {
              results: fallbackRuns.flatMap((run) => run.payload.response?.results ?? []),
            },
          };
        }
      } else {
        ({ res, payload } = await triggerSync(source));
      }

      if (!res.ok) {
        const errMsg = payload.error;
        setMessage(
          errMsg === "Unauthorized" || errMsg === "Forbidden"
            ? "Sin permisos para ejecutar el sync."
            : errMsg
              ? `No se pudo disparar el sync: ${errMsg}`
              : "No se pudo disparar el sync. Revisa el worker.",
        );
        return;
      }

      const results = payload.response?.results ?? [];
      const inserted = results.reduce((sum, result) => sum + Number(result.inserted ?? 0), 0);
      const updated = results.reduce((sum, result) => sum + Number(result.updated ?? 0), 0);
      const failed = results.reduce((sum, result) => sum + Number(result.failed ?? 0), 0);
      const skipped = results.reduce((sum, result) => sum + Number(result.skipped ?? 0), 0);
      const skippedReasons = results.flatMap((result) => {
        if (!result.diagnostics || typeof result.diagnostics.skipped_reasons !== "object") {
          return [];
        }

        return Object.entries(result.diagnostics.skipped_reasons as Record<string, unknown>)
          .filter(([, value]) => typeof value === "number" && value > 0)
          .map(([reason, value]) => `${reason}: ${value}`);
      }).slice(0, 2).join(" · ");

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
    <div className="grid gap-1.5">
      <Button
        type="button"
        disabled={disabled || isPending}
        onClick={onSync}
        className="w-full"
      >
        {isPending ? "Ejecutando..." : label}
      </Button>
      <div className="min-h-4 text-xs text-muted-foreground">{message ?? idleMessage}</div>
    </div>
  );
}
