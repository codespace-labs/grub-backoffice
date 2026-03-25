"use client";

import { useCallback, useEffect, useState } from "react";
import type { BackofficeRole } from "../../lib/backoffice-types";
import type { EventListItemDto } from "@grub/contracts";
import {
  extractNormalizationInsights,
  NormalizationBlockersPanel,
  NORMALIZATION_INSIGHTS_STORAGE_KEY,
  type NormalizationBatchResultItem,
} from "./NormalizationBlockersPanel";

type ScraperEvent = EventListItemDto & { genres: string[] };

type NormalizationOverview = {
  classified_today_count: number;
  open_review_count: number;
};

type ClassifyState =
  | { phase: "idle" }
  | { phase: "running"; round: number; processed: number; classified: number; ambiguous: number; noArtist: number; total: number }
  | { phase: "done"; classified: number; ambiguous: number; noArtist: number; reviewed: number; stoppedEarly: boolean }
  | { phase: "error"; message: string };

async function parseApiError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  try {
    const body = await res.json() as { error?: string };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function StatCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  accent?: "yellow" | "green" | "purple";
}) {
  const colorMap = {
    yellow: "#f59e0b",
    green: "#22c55e",
    purple: "#a78bfa",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div
        className="text-3xl font-bold leading-none"
        style={{ color: accent ? colorMap[accent] : "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

export function NormalizationDashboard({ role }: { role: BackofficeRole }) {
  const [allEvents, setAllEvents] = useState<ScraperEvent[]>([]);
  const [overview, setOverview] = useState<NormalizationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [classifyState, setClassifyState] = useState<ClassifyState>({ phase: "idle" });
  const [insights, setInsights] = useState<NormalizationBatchResultItem[]>([]);

  const canRun = role === "admin" || role === "operator";

  const fetchSnapshot = useCallback(async () => {
    const [eventsRes, overviewRes] = await Promise.all([
      fetch("/api/admin/events?limit=500", { cache: "no-store" }),
      fetch("/api/admin/normalization", { cache: "no-store" }),
    ]);

    if (!eventsRes.ok) throw new Error(await parseApiError(eventsRes));
    if (!overviewRes.ok) throw new Error(await parseApiError(overviewRes));

    const json = await eventsRes.json();
    const raw: EventListItemDto[] = json.events ?? [];
    const normalized: ScraperEvent[] = raw.map((e) => ({
      ...e,
      genres: (e.event_genres ?? []).map((g) => g.genres?.slug).filter(Boolean) as string[],
    }));

    const overviewJson = await overviewRes.json() as NormalizationOverview;

    return { events: normalized, overview: overviewJson };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { events, overview: ov } = await fetchSnapshot();
      setAllEvents(events);
      setOverview(ov);
      setLastUpdated(new Date().toLocaleTimeString("es-PE"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (insights.length > 0) {
        window.sessionStorage.setItem(NORMALIZATION_INSIGHTS_STORAGE_KEY, JSON.stringify(insights));
      } else {
        window.sessionStorage.removeItem(NORMALIZATION_INSIGHTS_STORAGE_KEY);
      }
    } catch { /* no-op */ }
  }, [insights]);

  async function runClassification() {
    const batchSize = 10;
    const startNoGenre = allEvents.filter((e) => e.genres.length === 0).length;

    setInsights([]);
    setClassifyState({ phase: "running", round: 1, processed: 0, classified: 0, ambiguous: 0, noArtist: 0, total: startNoGenre });

    let totalProcessed = 0;
    let totalClassified = 0;
    let totalAmbiguous = 0;
    let totalNoArtist = 0;
    let stoppedEarly = false;
    const attemptedIds = new Set<string>();
    const insightMap = new Map<string, NormalizationBatchResultItem>();

    try {
      for (let round = 1; round <= 1_000; round++) {
        setClassifyState({
          phase: "running",
          round,
          processed: totalProcessed,
          classified: totalClassified,
          ambiguous: totalAmbiguous,
          noArtist: totalNoArtist,
          total: startNoGenre,
        });

        const res = await fetch("/api/admin/normalization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "classify_events_batch",
            options: {
              limit: batchSize,
              only_without_genres: true,
              dry_run: false,
              force_refresh: true,
              exclude_event_ids: [...attemptedIds],
            },
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);

        const batchResults: NormalizationBatchResultItem[] = Array.isArray(json.results)
          ? json.results.filter((item: unknown): item is NormalizationBatchResultItem => typeof item === "object" && item !== null)
          : [];

        for (const item of batchResults) {
          if (typeof item.event_id === "string" && item.event_id) {
            attemptedIds.add(item.event_id);
            if ((item.status === "ambiguous" || item.status === "skipped_no_artist" || item.status === "failed") && !insightMap.has(item.event_id)) {
              insightMap.set(item.event_id, item);
            }
          }
        }

        const currentInsights = [...insightMap.values()].slice(0, 12);
        setInsights(currentInsights.length > 0 ? currentInsights : extractNormalizationInsights(batchResults));

        totalProcessed += Number(json.count_processed ?? 0);
        totalClassified += Number(json.count_classified ?? 0);
        totalAmbiguous += Number(json.count_ambiguous ?? 0);
        totalNoArtist += Number(json.count_skipped_no_artist ?? 0);

        const selected = Number(json.count_selected ?? 0);
        const processed = Number(json.count_processed ?? 0);

        if (selected === 0 || processed === 0) {
          stoppedEarly = true;
          break;
        }

        if (attemptedIds.size >= startNoGenre) break;
      }

      // Refresh counts after done
      try {
        const { events, overview: ov } = await fetchSnapshot();
        setAllEvents(events);
        setOverview(ov);
        setLastUpdated(new Date().toLocaleTimeString("es-PE"));
      } catch { /* no-op */ }

      setClassifyState({
        phase: "done",
        classified: totalClassified,
        ambiguous: totalAmbiguous,
        noArtist: totalNoArtist,
        reviewed: attemptedIds.size,
        stoppedEarly,
      });
    } catch (err) {
      setClassifyState({
        phase: "error",
        message: err instanceof Error ? err.message : "No se pudo completar la clasificación",
      });
    }
  }

  const noGenre = allEvents.filter((e) => e.genres.length === 0).length;
  const isRunning = classifyState.phase === "running";

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Cargando...</div>;
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <div className="mb-2 text-lg text-rose-400">Error al conectar</div>
        <div className="text-sm text-muted-foreground">{loadError}</div>
        <button
          onClick={loadData}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
          Actualizado {lastUpdated ?? "—"}
        </div>
        <button
          onClick={loadData}
          disabled={isRunning}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-40"
        >
          Actualizar datos
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Sin género"
          value={noGenre}
          description="eventos que aún esperan clasificación"
          accent="yellow"
        />
        <StatCard
          label="Clasificados hoy"
          value={overview?.classified_today_count ?? 0}
          description="géneros asignados automáticamente"
          accent="green"
        />
        <StatCard
          label="En revisión manual"
          value={overview?.open_review_count ?? 0}
          description="señales ambiguas que requieren atención"
          accent="purple"
        />
      </div>

      {/* ── Classify action ── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">Clasificar eventos sin género</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              Revisa cada evento sin género e intenta asignarle uno automáticamente usando datos de
              sus artistas (MusicBrainz, Spotify, Discogs). Los que no se puedan resolver quedan
              marcados para revisión manual.
            </p>
          </div>
          <button
            onClick={runClassification}
            disabled={!canRun || isRunning || noGenre === 0}
            className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
          >
            {isRunning ? "Clasificando..." : noGenre === 0 ? "Todo clasificado ✓" : "Iniciar clasificación"}
          </button>
        </div>

        {/* Progress */}
        {classifyState.phase === "running" ? (
          <div className="mt-5 space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Revisando eventos sin género · ronda {classifyState.round}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.min(classifyState.processed, classifyState.total)}/{classifyState.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: classifyState.total > 0
                    ? `${Math.min(100, Math.round((classifyState.processed / classifyState.total) * 100))}%`
                    : "5%",
                  background: "linear-gradient(90deg, #7c3aed, #22c55e)",
                }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-emerald-400">✓ {classifyState.classified} clasificados</span>
              <span className="text-amber-400">⚠ {classifyState.ambiguous} ambiguos</span>
              <span className="text-muted-foreground">∅ {classifyState.noArtist} sin artista</span>
            </div>
          </div>
        ) : null}

        {/* Done */}
        {classifyState.phase === "done" ? (
          <div className="mt-5 space-y-2 border-t border-border pt-5">
            <p className="text-sm font-medium text-foreground">
              {classifyState.stoppedEarly
                ? "Clasificación detenida — no quedan eventos nuevos para revisar en este momento."
                : "Clasificación completada."}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                Revisados: <strong className="text-foreground">{classifyState.reviewed}</strong>
              </span>
              <span className="text-emerald-400">
                Clasificados: <strong>{classifyState.classified}</strong>
              </span>
              <span className="text-amber-400">
                Ambiguos: <strong>{classifyState.ambiguous}</strong>
              </span>
              <span className="text-muted-foreground">
                Sin artista: <strong className="text-foreground">{classifyState.noArtist}</strong>
              </span>
            </div>
            {classifyState.stoppedEarly && classifyState.noArtist > 0 ? (
              <p className="text-xs text-muted-foreground">
                Los eventos restantes no tienen artistas identificados en la base de datos.
                Puedes vincular artistas desde el módulo CMS e intentarlo de nuevo.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Error */}
        {classifyState.phase === "error" ? (
          <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {classifyState.message}
          </div>
        ) : null}
      </div>

      {/* ── Blockers ── */}
      <NormalizationBlockersPanel items={insights} />
    </div>
  );
}
