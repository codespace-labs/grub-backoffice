import Link from "next/link";

export const NORMALIZATION_INSIGHTS_STORAGE_KEY = "grub:last-normalization-insights";

export type NormalizationBatchResultItem = {
  event_id?: string;
  event_name?: string | null;
  status?: "classified" | "ambiguous" | "skipped_no_artist" | "failed";
  normalization_status?: "matched" | "matched_low_confidence" | "ambiguous" | "unresolved";
  genres?: string[];
  confidence?: number;
  review_required?: boolean;
  review_reason_code?: string;
  unmapped_signals?: string[];
  discarded_tags?: string[];
  source_providers?: string[];
  error?: string;
};

export function humanizeNormalizationReason(reason: string | undefined): string {
  switch (reason) {
    case "missing_artist":       return "Sin artista identificado";
    case "unmapped_signals":     return "Señales sin mapear";
    case "ambiguous_confidence": return "Confianza ambigua";
    case "unresolved_artist":    return "Artista no resuelto";
    case "manual_review":        return "Revisión manual";
    case "ambiguous":            return "Ambiguo";
    case "unresolved":           return "Sin resolver";
    case "skipped_no_artist":    return "Sin artista";
    default: return reason ? reason.replace(/_/g, " ") : "Sin detalle";
  }
}

function statusBadge(status: NormalizationBatchResultItem["status"]) {
  switch (status) {
    case "ambiguous":
      return "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300";
    case "skipped_no_artist":
      return "rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400";
    case "failed":
      return "rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300";
    default:
      return "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  }
}

function statusLabel(status: NormalizationBatchResultItem["status"]) {
  switch (status) {
    case "ambiguous":         return "Ambiguo";
    case "skipped_no_artist": return "Sin artista";
    case "failed":            return "Error";
    default:                  return status ?? "—";
  }
}

export function extractNormalizationInsights(items: unknown): NormalizationBatchResultItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is NormalizationBatchResultItem => typeof item === "object" && item !== null)
    .filter((item) => item.status === "ambiguous" || item.status === "skipped_no_artist" || item.status === "failed")
    .slice(0, 12);
}

export function NormalizationBlockersPanel({
  items,
  showModuleLink = false,
  onClear,
}: {
  items: NormalizationBatchResultItem[];
  showModuleLink?: boolean;
  onClear?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Detalle de eventos no clasificados
        </div>
        <p className="text-sm text-muted-foreground">
          Aquí verás los eventos que no pudieron clasificarse tras ejecutar una clasificación.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Detalle de eventos no clasificados
          </div>
          <p className="text-sm text-muted-foreground">
            Estos eventos quedaron pendientes tras la última clasificación. Puedes vincularles
            artistas desde CMS e intentar de nuevo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Limpiar
            </button>
          ) : null}
          {showModuleLink ? (
            <Link
              href="/backoffice/quality"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver en Calidad →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={item.event_id ?? `${item.event_name ?? "item"}-${index}`}
            className="rounded-lg border border-border px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {item.event_name ?? "Evento sin nombre"}
              </span>
              <span className={statusBadge(item.status)}>
                {statusLabel(item.status)}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {item.confidence != null ? (
                <span>Confianza: {Number(item.confidence).toFixed(2)}</span>
              ) : null}
              {item.review_reason_code ? (
                <span>{humanizeNormalizationReason(item.review_reason_code)}</span>
              ) : null}
              {item.source_providers && item.source_providers.length > 0 ? (
                <span>Consultado: {item.source_providers.join(", ")}</span>
              ) : null}
            </div>

            {item.unmapped_signals && item.unmapped_signals.length > 0 ? (
              <div className="mt-1 text-xs text-amber-300/80">
                Señales sin mapear: {item.unmapped_signals.slice(0, 4).join(", ")}
              </div>
            ) : null}

            {item.error ? (
              <div className="mt-1 text-xs text-rose-300">
                {item.error}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
