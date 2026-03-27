"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import type { BackofficeRole } from "../../lib/backoffice-types";
import type { EventListItemDto } from "@grub/contracts";
import {
  extractNormalizationInsights,
  NormalizationBlockersPanel,
  NORMALIZATION_INSIGHTS_STORAGE_KEY,
  type NormalizationBatchResultItem,
} from "./NormalizationBlockersPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type ScraperEvent = EventListItemDto & { genres: string[] };

type AiAuditDecision = {
  field: string;
  action: string;
  current_value: unknown;
  proposed_value: unknown;
  reason: string;
  evidence: string | null;
  confidence: number | null;
  auto_applied: boolean;
};

type AiAuditEntry = {
  id: string;
  event_id: string;
  event_name: string | null;
  provider: string;
  model: string;
  status: "pending" | "applied" | "review" | "skipped" | "failed";
  confidence: number | null;
  review_required: boolean;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  summary: string | null;
  decisions: AiAuditDecision[];
  applied_fields: string[];
  proposed_fields: string[];
};

type AiAuditOverview = {
  total_recent_runs: number;
  applied_recent_count: number;
  review_recent_count: number;
  failed_recent_count: number;
  entries: AiAuditEntry[];
};

type AiPrompts = {
  enrichment_system_prompt: string;
  judge_system_prompt: string;
};

type NormalizationOverview = {
  classified_today_count: number;
  open_review_count: number;
  open_missing_artist_count: number;
  open_unresolved_artist_count: number;
  ai_audit?: AiAuditOverview | null;
  ai_prompts?: AiPrompts | null;
};

type ClassifyState =
  | { phase: "idle" }
  | {
    phase: "running";
    scope: "active" | "inactive";
    round: number;
    processed: number;
    classified: number;
    ambiguous: number;
    noArtist: number;
    total: number;
    currentEventName?: string | null;
  }
  | { phase: "done"; scope: "active" | "inactive"; classified: number; ambiguous: number; noArtist: number; reviewed: number; stoppedEarly: boolean }
  | { phase: "error"; message: string };

type JudgeState =
  | { phase: "idle" }
  | {
    phase: "running";
    round: number;
    processed: number;
    corrected: number;
    valid: number;
    review: number;
    failed: number;
    currentEventName?: string | null;
    total?: number | null;
  }
  | { phase: "done"; processed: number; corrected: number; valid: number; review: number; failed: number; stoppedEarly: boolean }
  | { phase: "error"; message: string };

type DateFilter = "all" | "today" | "7d" | "30d";

type RunJudgeOptions = {
  eventIds?: string[];
  forceRefresh?: boolean;
};

type RunClassificationOptions = {
  activeStatus?: "active" | "inactive";
};

const PAGE_SIZE = 20;
const EVENTS_FETCH_PAGE_SIZE = 500;
const AUDIT_STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "applied", label: "Aplicados" },
  { value: "review", label: "En revisión" },
  { value: "failed", label: "Fallidos" },
  { value: "skipped", label: "Validados / sin cambio" },
  { value: "pending", label: "Pendientes" },
] as const;

async function parseApiError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  try {
    const body = await res.json() as { error?: string };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function fetchAllAdminEvents(): Promise<ScraperEvent[]> {
  const allEvents: ScraperEvent[] = [];

  for (let offset = 0; offset < 10_000; offset += EVENTS_FETCH_PAGE_SIZE) {
    const res = await fetch(
      `/api/admin/events?limit=${EVENTS_FETCH_PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(await parseApiError(res));

    const json = await res.json();
    const raw: EventListItemDto[] = json.events ?? [];
    const normalized: ScraperEvent[] = raw.map((event) => ({
      ...event,
      genres: (event.event_genres ?? []).map((genre) => genre.genres?.slug).filter(Boolean) as string[],
    }));

    allEvents.push(...normalized);

    if (raw.length < EVENTS_FETCH_PAGE_SIZE) break;
  }

  return allEvents;
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

function badgeTone(status: string) {
  switch (status) {
    case "applied":
    case "corrected":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
    case "review":
    case "needs_review":
      return "bg-amber-500/15 text-amber-300 border-amber-500/25";
    case "failed":
      return "bg-rose-500/15 text-rose-300 border-rose-500/25";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/25";
  }
}

function statusLabel(status: AiAuditEntry["status"] | string): string {
  switch (status) {
    case "applied":
      return "Aplicado";
    case "review":
      return "En revisión";
    case "failed":
      return "Fallido";
    case "skipped":
      return "Validado";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

function effectiveAuditStatus(entry: Pick<AiAuditEntry, "status" | "review_required">): AiAuditEntry["status"] {
  return entry.review_required ? "review" : entry.status;
}

function primaryDecision(entry: AiAuditEntry): AiAuditDecision | null {
  return entry.decisions.find((decision) => decision.action !== "ok") ?? entry.decisions[0] ?? null;
}

function collapseLatestAuditEntries(entries: AiAuditEntry[]): AiAuditEntry[] {
  const latestByEvent = new Map<string, AiAuditEntry>();
  const withoutEvent: AiAuditEntry[] = [];

  for (const entry of entries) {
    if (!entry.event_id) {
      withoutEvent.push(entry);
      continue;
    }

    if (!latestByEvent.has(entry.event_id)) {
      latestByEvent.set(entry.event_id, entry);
    }
  }

  return [...latestByEvent.values(), ...withoutEvent].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function formatAuditValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[objeto]";
    }
  }
  return String(value);
}

function tokenizeForDiff(value: string): string[] {
  return value.split(/(\s+)/).filter((token) => token.length > 0);
}

function buildWordDiff(previousValue: string, nextValue: string) {
  const previous = tokenizeForDiff(previousValue);
  const next = tokenizeForDiff(nextValue);
  const dp = Array.from({ length: previous.length + 1 }, () =>
    Array.from({ length: next.length + 1 }, () => 0));

  for (let i = previous.length - 1; i >= 0; i -= 1) {
    for (let j = next.length - 1; j >= 0; j -= 1) {
      dp[i][j] = previous[i] === next[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const removed: Array<{ text: string; type: "same" | "removed" }> = [];
  const added: Array<{ text: string; type: "same" | "added" }> = [];

  let i = 0;
  let j = 0;
  while (i < previous.length && j < next.length) {
    if (previous[i] === next[j]) {
      removed.push({ text: previous[i], type: "same" });
      added.push({ text: next[j], type: "same" });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push({ text: previous[i], type: "removed" });
      i += 1;
    } else {
      added.push({ text: next[j], type: "added" });
      j += 1;
    }
  }

  while (i < previous.length) {
    removed.push({ text: previous[i], type: "removed" });
    i += 1;
  }

  while (j < next.length) {
    added.push({ text: next[j], type: "added" });
    j += 1;
  }

  return { removed, added };
}

function DiffText({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const diff = useMemo(() => buildWordDiff(before, after), [before, after]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-300">
          Antes
        </div>
        <div className="text-sm leading-7 text-foreground/90">
          {diff.removed.length > 0 ? diff.removed.map((part, index) => (
            <span
              key={`before-${index}-${part.text}`}
              className={part.type === "removed"
                ? "rounded bg-rose-500/20 px-1 py-0.5 text-rose-200 line-through"
                : undefined}
            >
              {part.text}
            </span>
          )) : <span className="text-muted-foreground">Vacío</span>}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
          Después
        </div>
        <div className="text-sm leading-7 text-foreground/90">
          {diff.added.length > 0 ? diff.added.map((part, index) => (
            <span
              key={`after-${index}-${part.text}`}
              className={part.type === "added"
                ? "rounded bg-emerald-500/20 px-1 py-0.5 text-emerald-200"
                : undefined}
            >
              {part.text}
            </span>
          )) : <span className="text-muted-foreground">Vacío</span>}
        </div>
      </div>
    </div>
  );
}

function AuditDetailDialog({
  entry,
  open,
  onOpenChange,
  onReviewDecision,
  onRetryFailed,
  reviewActionPending,
  reviewActionError,
}: {
  entry: AiAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewDecision: (entry: AiAuditEntry, decision: "approve" | "reject") => Promise<void>;
  onRetryFailed: (entry: AiAuditEntry) => Promise<void>;
  reviewActionPending: "approve" | "reject" | null;
  reviewActionError: string | null;
}) {
  if (!entry) return null;

  const title = entry.event_name ?? "Evento sin nombre";
  const displayStatus = effectiveAuditStatus(entry);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-w-3xl translate-x-0 translate-y-0 rounded-none border-l border-border bg-background p-0 sm:max-w-3xl">
        <div className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="pr-10 text-xl">{title}</DialogTitle>
            <DialogDescription className="flex flex-wrap gap-3 text-xs">
              <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${badgeTone(displayStatus)}`}>
                {statusLabel(displayStatus)}
              </span>
              <span>{new Date(entry.created_at).toLocaleString("es-PE")}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span>{entry.provider} · {entry.model}</span>
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/85">
                  Confianza {entry.confidence != null ? `${Math.round(entry.confidence * 100)}%` : "—"}
                </span>
              </span>
            </DialogDescription>
            {entry.review_required || entry.status === "review" ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void onReviewDecision(entry, "approve")}
                  disabled={reviewActionPending !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-default disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {reviewActionPending === "approve" ? "Aprobando..." : "Aprobar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => void onReviewDecision(entry, "reject")}
                  disabled={reviewActionPending !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-default disabled:opacity-60"
                >
                  {reviewActionPending === "reject" ? "Descartando..." : "Descartar de la app"}
                </button>
              </div>
            ) : null}
            {reviewActionError ? (
              <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {reviewActionError}
              </div>
            ) : null}
            {entry.status === "failed" ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void onRetryFailed(entry)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  Reintentar corrida
                </button>
              </div>
            ) : null}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {entry.summary ? (
              <div className="mb-5 rounded-2xl border border-border bg-card/70 p-4">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Resumen del juez
                </div>
                <p className="text-sm text-foreground">{entry.summary}</p>
              </div>
            ) : null}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetaPill label="Campos aplicados" value={entry.applied_fields.length ? entry.applied_fields.join(", ") : "Ninguno"} />
              <MetaPill label="Campos propuestos" value={entry.proposed_fields.length ? entry.proposed_fields.join(", ") : "Ninguno"} />
              <MetaPill label="Error" value={entry.error_message ?? "Sin errores"} tone={entry.error_message ? "danger" : "neutral"} />
            </div>

            <div className="space-y-4">
              {entry.decisions.length > 0 ? entry.decisions.map((decision, index) => {
                const before = formatAuditValue(decision.current_value);
                const after = formatAuditValue(decision.proposed_value);
                const canDiff = before !== after && (before.length > 0 || after.length > 0);

                return (
                  <div key={`${entry.id}-${decision.field}-${index}`} className="rounded-2xl border border-border bg-card/60 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{decision.field}</div>
                        <div className="text-xs text-muted-foreground">
                          {decision.confidence != null ? `Confianza ${Math.round(decision.confidence * 100)}%` : "Sin score"}
                          {decision.auto_applied ? " · Autoaplicado" : " · Requiere confirmación o solo auditoría"}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeTone(decision.action)}`}>
                        {decision.action}
                      </span>
                    </div>

                    {canDiff ? (
                      <DiffText before={before} after={after} />
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <PlainValueCard label="Antes" value={before || "Vacío"} />
                        <PlainValueCard label="Después" value={after || "Vacío"} />
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-border/70 bg-background/60 p-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Razón del juez
                      </div>
                      <p className="text-sm text-foreground">{decision.reason}</p>
                      {decision.evidence ? (
                        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
                          Evidencia: {decision.evidence}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No hay decisiones detalladas para esta corrida.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone === "danger" ? "border-rose-500/20 bg-rose-500/5" : "border-border bg-card/70"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${tone === "danger" ? "text-rose-300" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function PlainValueCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground/90">{value}</div>
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
  const [judgeState, setJudgeState] = useState<JudgeState>({ phase: "idle" });
  const [insights, setInsights] = useState<NormalizationBatchResultItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AiAuditEntry | null>(null);
  const [reviewActionPending, setReviewActionPending] = useState<"approve" | "reject" | null>(null);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [bulkReviewPending, setBulkReviewPending] = useState<"approve" | "reject" | null>(null);
  const [bulkReviewError, setBulkReviewError] = useState<string | null>(null);

  const canRun = role === "superadmin" || role === "admin" || role === "operator";
  const aiAudit = overview?.ai_audit ?? null;
  const aiPrompts = overview?.ai_prompts ?? null;
  const latestAiAuditEntries = useMemo(
    () => collapseLatestAuditEntries(aiAudit?.entries ?? []),
    [aiAudit?.entries],
  );
  const activeEvents = useMemo(() => allEvents.filter((event) => event.is_active !== false), [allEvents]);
  const inactiveEvents = useMemo(() => allEvents.filter((event) => event.is_active === false), [allEvents]);
  const activeEventIds = useMemo(() => new Set(activeEvents.map((event) => event.id)), [activeEvents]);
  const inactiveEventIds = useMemo(() => new Set(inactiveEvents.map((event) => event.id)), [inactiveEvents]);

  const fetchSnapshot = useCallback(async () => {
    const [normalized, overviewRes] = await Promise.all([
      fetchAllAdminEvents(),
      fetch("/api/admin/normalization", { cache: "no-store" }),
    ]);

    if (!overviewRes.ok) throw new Error(await parseApiError(overviewRes));
    const overviewJson = await overviewRes.json() as NormalizationOverview;
    return { events: normalized, overview: overviewJson };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { events, overview: nextOverview } = await fetchSnapshot();
      setAllEvents(events);
      setOverview(nextOverview);
      setLastUpdated(new Date().toLocaleTimeString("es-PE"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot]);

  const refreshDataQuietly = useCallback(async () => {
    try {
      const { events, overview: nextOverview } = await fetchSnapshot();
      setAllEvents(events);
      setOverview(nextOverview);
      setLastUpdated(new Date().toLocaleTimeString("es-PE"));
    } catch {
      // silencioso — el estado de clasificación/juez permanece visible
    }
  }, [fetchSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (insights.length > 0) {
        window.sessionStorage.setItem(NORMALIZATION_INSIGHTS_STORAGE_KEY, JSON.stringify(insights));
      } else {
        window.sessionStorage.removeItem(NORMALIZATION_INSIGHTS_STORAGE_KEY);
      }
    } catch {
      // no-op
    }
  }, [insights]);

  const clearInsights = useCallback(() => {
    setInsights([]);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(NORMALIZATION_INSIGHTS_STORAGE_KEY);
    } catch {
      // no-op
    }
  }, []);

  const filteredAuditEntries = useMemo(() => {
    const entries = latestAiAuditEntries;
    const now = Date.now();

    return entries.filter((entry) => {
      const text = `${entry.event_name ?? ""} ${entry.summary ?? ""} ${entry.decisions.map((d) => `${d.field} ${d.reason}`).join(" ")}`.toLowerCase();
      const matchesSearch = searchQuery.trim().length === 0 || text.includes(searchQuery.trim().toLowerCase());

      const matchesStatus = statusFilter === "all" || effectiveAuditStatus(entry) === statusFilter;

      const createdAt = new Date(entry.created_at).getTime();
      const matchesDate =
        dateFilter === "all" ? true :
        dateFilter === "today" ? createdAt >= now - 24 * 60 * 60 * 1000 :
        dateFilter === "7d" ? createdAt >= now - 7 * 24 * 60 * 60 * 1000 :
        createdAt >= now - 30 * 24 * 60 * 60 * 1000;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [latestAiAuditEntries, searchQuery, statusFilter, dateFilter]);

  const activeInsights = useMemo(
    () => insights.filter((item) => !item.event_id || activeEventIds.has(item.event_id)),
    [insights, activeEventIds],
  );
  const inactiveInsights = useMemo(
    () => insights.filter((item) => Boolean(item.event_id) && inactiveEventIds.has(item.event_id!)),
    [insights, inactiveEventIds],
  );

  const totalPages = Math.max(1, Math.ceil(filteredAuditEntries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAuditEntries.slice(start, start + PAGE_SIZE);
  }, [filteredAuditEntries, currentPage]);
  const reviewableEntries = useMemo(
    () => filteredAuditEntries.filter((entry) => effectiveAuditStatus(entry) === "review"),
    [filteredAuditEntries],
  );
  const pageReviewableEntries = useMemo(
    () => paginatedEntries.filter((entry) => effectiveAuditStatus(entry) === "review"),
    [paginatedEntries],
  );
  const selectedReviewEntries = useMemo(
    () => filteredAuditEntries.filter((entry) => selectedAuditIds.includes(entry.id)),
    [filteredAuditEntries, selectedAuditIds],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedAuditIds((current) =>
      current.filter((id) => filteredAuditEntries.some((entry) => entry.id === id && effectiveAuditStatus(entry) === "review"))
    );
  }, [filteredAuditEntries]);

  async function runClassification(options?: RunClassificationOptions) {
    const scope = options?.activeStatus === "inactive" ? "inactive" : "active";
    const batchSize = 1;
    const sourceEvents = scope === "inactive" ? inactiveEvents : activeEvents;
    const startNoGenre = sourceEvents.filter((event) => event.genres.length === 0).length;
    const queue = sourceEvents.filter((event) => event.genres.length === 0);

    setInsights([]);
    setClassifyState({
      phase: "running",
      scope,
      round: 1,
      processed: 0,
      classified: 0,
      ambiguous: 0,
      noArtist: 0,
      total: startNoGenre,
      currentEventName: queue[0]?.name ?? null,
    });

    let totalProcessed = 0;
    let totalClassified = 0;
    let totalAmbiguous = 0;
    let totalNoArtist = 0;
    let stoppedEarly = false;
    const attemptedIds = new Set<string>();
    const insightMap = new Map<string, NormalizationBatchResultItem>();

    try {
      for (let round = 1; round <= 1_000; round += 1) {
        setClassifyState({
          phase: "running",
          scope,
          round,
          processed: totalProcessed,
          classified: totalClassified,
          ambiguous: totalAmbiguous,
          noArtist: totalNoArtist,
          total: startNoGenre,
          currentEventName: queue[attemptedIds.size]?.name ?? null,
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
              force_refresh: scope === "inactive",
              active_status: scope,
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

      setClassifyState({
        phase: "done",
        scope,
        classified: totalClassified,
        ambiguous: totalAmbiguous,
        noArtist: totalNoArtist,
        reviewed: attemptedIds.size,
        stoppedEarly,
      });
      await refreshDataQuietly();
    } catch (err) {
      setClassifyState({
        phase: "error",
        message: err instanceof Error ? err.message : "No se pudo completar la clasificación",
      });
    }
  }

  async function runJudge(options?: RunJudgeOptions) {
    try {
      const attemptedIds = new Set<string>();
      const targetedEventIds = [...new Set(options?.eventIds ?? [])];
      const targetEntries = targetedEventIds.length > 0
        ? latestAiAuditEntries.filter((entry) => targetedEventIds.includes(entry.event_id))
        : [];
      const batchSize = 1;
      let totalProcessed = 0;
      let totalCorrected = 0;
      let totalValid = 0;
      let totalReview = 0;
      let totalFailed = 0;
      let stoppedEarly = false;
      let escalatedToForceRefresh = options?.forceRefresh === true;

      for (let round = 1; round <= 200; round += 1) {
        setJudgeState({
          phase: "running",
          round,
          processed: totalProcessed,
          corrected: totalCorrected,
          valid: totalValid,
          review: totalReview,
          failed: totalFailed,
          currentEventName: targetEntries[attemptedIds.size]?.event_name ?? null,
          total: targetedEventIds.length > 0 ? targetedEventIds.length : null,
        });

        const res = await fetch("/api/admin/normalization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ai_judge_events_batch",
            judge_options: {
              limit: batchSize,
              dry_run: false,
              force_refresh: escalatedToForceRefresh,
              skip_resolved: false,
              event_ids: targetedEventIds.length > 0
                ? targetedEventIds.filter((id) => !attemptedIds.has(id))
                : undefined,
              exclude_event_ids: [...attemptedIds],
            },
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);

        const results = Array.isArray(json.results) ? json.results : [];
        for (const item of results) {
          if (item && typeof item === "object" && typeof item.event_id === "string") {
            attemptedIds.add(item.event_id);
          }
        }

        totalProcessed += Number(json.count_processed ?? 0);
        totalCorrected += Number(json.count_corrected ?? 0);
        totalValid += Number(json.count_valid ?? 0);
        totalReview += Number(json.count_review ?? 0);
        totalFailed += Number(json.count_failed ?? 0);

        const selected = Number(json.count_selected ?? 0);
        const processed = Number(json.count_processed ?? 0);
        if (selected === 0 || processed === 0) {
          if (!escalatedToForceRefresh && targetedEventIds.length === 0 && totalProcessed === 0) {
            escalatedToForceRefresh = true;
            continue;
          }
          stoppedEarly = true;
          break;
        }

        if (targetedEventIds.length > 0 && attemptedIds.size >= targetedEventIds.length) {
          break;
        }
      }

      setJudgeState({
        phase: "done",
        processed: totalProcessed,
        corrected: totalCorrected,
        valid: totalValid,
        review: totalReview,
        failed: totalFailed,
        stoppedEarly,
      });
      await refreshDataQuietly();
    } catch (err) {
      setJudgeState({
        phase: "error",
        message: err instanceof Error ? err.message : "No se pudo completar la auditoría IA",
      });
    }
  }

  async function retryFailedRuns() {
    const failedIds = [...new Set(
      latestAiAuditEntries
        .filter((entry) => entry.status === "failed")
        .map((entry) => entry.event_id)
        .filter(Boolean),
    )];

    if (failedIds.length === 0) return;
    await runJudge({ eventIds: failedIds, forceRefresh: true });
  }

  async function retryFailedEntry(entry: AiAuditEntry) {
    await runJudge({ eventIds: [entry.event_id], forceRefresh: true });
    setSelectedEntry(null);
  }

  async function handleReviewDecision(entry: AiAuditEntry, decision: "approve" | "reject") {
    setReviewActionPending(decision);
    setReviewActionError(null);
    try {
      const res = await fetch("/api/admin/normalization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai_review_decision",
          review: {
            review_id: entry.id,
            decision,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
      }

      await refreshDataQuietly();
      setSelectedAuditIds((current) => current.filter((id) => id !== entry.id));
      setSelectedEntry(null);
    } catch (err) {
      setReviewActionError(err instanceof Error ? err.message : "No se pudo completar la revisión");
    } finally {
      setReviewActionPending(null);
    }
  }

  function toggleAuditSelection(entryId: string, checked: boolean) {
    setSelectedAuditIds((current) => {
      if (checked) return current.includes(entryId) ? current : [...current, entryId];
      return current.filter((id) => id !== entryId);
    });
  }

  function togglePageSelection(checked: boolean) {
    const pageIds = pageReviewableEntries.map((entry) => entry.id);
    setSelectedAuditIds((current) => {
      if (checked) return [...new Set([...current, ...pageIds])];
      return current.filter((id) => !pageIds.includes(id));
    });
  }

  async function handleBulkReviewDecision(decision: "approve" | "reject") {
    if (selectedReviewEntries.length === 0) return;
    setBulkReviewPending(decision);
    setBulkReviewError(null);

    try {
      const results = await Promise.allSettled(
        selectedReviewEntries.map(async (entry) => {
          const res = await fetch("/api/admin/normalization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "ai_review_decision",
              review: {
                review_id: entry.id,
                decision,
              },
            }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
          }
        }),
      );

      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length > 0) {
        const firstError = rejected[0].reason instanceof Error
          ? rejected[0].reason.message
          : String(rejected[0].reason);
        throw new Error(firstError);
      }

      setSelectedAuditIds([]);
      setSelectedEntry(null);
      await refreshDataQuietly();
    } catch (err) {
      setBulkReviewError(err instanceof Error ? err.message : "No se pudo completar la acción masiva");
    } finally {
      setBulkReviewPending(null);
    }
  }

  const noGenre = activeEvents.filter((event) => event.genres.length === 0).length;
  const inactiveNoGenre = inactiveEvents.filter((event) => event.genres.length === 0).length;
  const isRunning = classifyState.phase === "running";
  const isJudgeRunning = judgeState.phase === "running";

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Cargando...</div>;
  }

  if (loadError) {
    return (
      <div className="py-20 text-center">
        <div className="mb-2 text-lg text-rose-400">Error al conectar</div>
        <div className="text-sm text-muted-foreground">{loadError}</div>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
            Actualizado {lastUpdated ?? "—"}
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={isRunning || isJudgeRunning}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-40"
          >
            Actualizar datos
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Eventos activos" value={activeEvents.length} description="eventos visibles hoy en tu app" accent="green" />
          <StatCard label="Eventos inactivos" value={inactiveEvents.length} description="eventos ocultos o fuera de catálogo" />
          <StatCard label="Sin género" value={noGenre} description="eventos que aún esperan clasificación" accent="yellow" />
          <StatCard label="Clasificados hoy" value={overview?.classified_today_count ?? 0} description="géneros asignados automáticamente" accent="green" />
          <StatCard label="En revisión manual" value={overview?.open_review_count ?? 0} description="señales ambiguas que requieren atención" accent="purple" />
          <StatCard label="Sin artista" value={overview?.open_missing_artist_count ?? 0} description="eventos abiertos por falta de artista" />
          <StatCard label="Artista no resuelto" value={overview?.open_unresolved_artist_count ?? 0} description="casos abiertos sin match confiable" />
          <StatCard label="IA corrigió" value={aiAudit?.applied_recent_count ?? 0} description="corridas recientes aplicadas por el juez" accent="green" />
          <StatCard label="IA en revisión" value={aiAudit?.review_recent_count ?? 0} description="casos donde el admin debe validar" accent="yellow" />
          <StatCard label="IA falló" value={aiAudit?.failed_recent_count ?? 0} description="corridas recientes con error" />
        </div>

        {aiPrompts ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="space-y-1">
              <h3 className="font-semibold">Prompts IA en producción</h3>
              <p className="text-sm text-muted-foreground">
                Este es el prompt literal que hoy enviamos al modelo. No es resumen ni documentación.
              </p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Prompt de enriquecimiento
                </div>
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-card/70 p-4 text-xs leading-6 text-foreground">
                  {aiPrompts.enrichment_system_prompt}
                </pre>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Prompt del juez
                </div>
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-card/70 p-4 text-xs leading-6 text-foreground">
                  {aiPrompts.judge_system_prompt}
                </pre>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Clasificar eventos sin género</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Revisa eventos activos sin género e intenta asignarle uno automáticamente usando datos de
                  sus artistas. Los ambiguos activos se ocultan si no alcanzan confianza suficiente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runClassification({ activeStatus: "active" })}
                disabled={!canRun || isRunning || isJudgeRunning || noGenre === 0}
                className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
              >
                {isRunning ? "Clasificando..." : noGenre === 0 ? "Todo clasificado ✓" : "Iniciar clasificación"}
              </button>
            </div>

            {classifyState.phase === "running" ? (
              <div className="mt-5 space-y-3 border-t border-border pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Clasificando uno a uno · ronda {classifyState.round}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.min(classifyState.processed, classifyState.total)}/{classifyState.total}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {classifyState.currentEventName
                    ? `Procesando ahora: ${classifyState.currentEventName}`
                    : "Buscando siguiente evento para clasificar..."}
                </p>
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

            {classifyState.phase === "done" ? (
              <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                <p className="font-medium text-foreground">
                  {classifyState.stoppedEarly
                    ? "Clasificación detenida o sin más eventos elegibles."
                    : "Clasificación completada."}
                </p>
                <div className="flex flex-wrap gap-4">
                  <span className="text-muted-foreground">Revisados: <strong className="text-foreground">{classifyState.reviewed}</strong></span>
                  <span className="text-emerald-400">Clasificados: <strong>{classifyState.classified}</strong></span>
                  <span className="text-amber-400">Ambiguos: <strong>{classifyState.ambiguous}</strong></span>
                  <span className="text-muted-foreground">Sin artista: <strong className="text-foreground">{classifyState.noArtist}</strong></span>
                </div>
              </div>
            ) : null}

            {classifyState.phase === "error" ? (
              <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {classifyState.message}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Juez IA de veracidad</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Audita el catálogo completo contra las páginas oficiales, corrige lo seguro y oculta
                  automáticamente teatro, infantil o géneros fuera del enfoque editorial cuando haya
                  evidencia suficiente.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void retryFailedRuns()}
                  disabled={!canRun || isRunning || isJudgeRunning || (aiAudit?.failed_recent_count ?? 0) === 0}
                  className="shrink-0 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-default disabled:opacity-50"
                >
                  Reintentar fallidos
                </button>
                <button
                  type="button"
                  onClick={() => void runJudge()}
                  disabled={!canRun || isRunning || isJudgeRunning}
                  className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
                >
                  {isJudgeRunning ? "Auditando catálogo..." : "Auditar todo el catálogo"}
                </button>
              </div>
            </div>

            {judgeState.phase === "running" ? (
              <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    Auditando uno a uno · ronda {judgeState.round}
                  </p>
                  <p className="tabular-nums text-muted-foreground">
                    {judgeState.total != null
                      ? `${Math.min(judgeState.processed, judgeState.total)}/${judgeState.total}`
                      : `${judgeState.processed} procesados`}
                  </p>
                </div>
                <p className="text-sm text-foreground">
                  {judgeState.currentEventName
                    ? `Auditando ahora: ${judgeState.currentEventName}`
                    : "Buscando siguiente evento para auditar..."}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: judgeState.total && judgeState.total > 0
                        ? `${Math.min(100, Math.round((judgeState.processed / judgeState.total) * 100))}%`
                        : "18%",
                      background: judgeState.total && judgeState.total > 0
                        ? "linear-gradient(90deg, #7c3aed, #22c55e)"
                        : "linear-gradient(90deg, #7c3aed, #a78bfa)",
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <span className="text-emerald-400">Corregidos: <strong>{judgeState.corrected}</strong></span>
                  <span className="text-foreground">Validados: <strong>{judgeState.valid}</strong></span>
                  <span className="text-amber-400">A revisión: <strong>{judgeState.review}</strong></span>
                  <span className="text-rose-300">Errores: <strong>{judgeState.failed}</strong></span>
                </div>
              </div>
            ) : null}

            {judgeState.phase === "done" ? (
              <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                <p className="font-medium text-foreground">
                  {judgeState.stoppedEarly ? "Auditoría IA completada o sin más eventos elegibles." : "Auditoría IA completada."}
                </p>
                <div className="flex flex-wrap gap-4">
                  <span className="text-muted-foreground">Procesados: <strong className="text-foreground">{judgeState.processed}</strong></span>
                  <span className="text-emerald-400">Corregidos: <strong>{judgeState.corrected}</strong></span>
                  <span className="text-foreground">Validados: <strong>{judgeState.valid}</strong></span>
                  <span className="text-amber-400">A revisión: <strong>{judgeState.review}</strong></span>
                  <span className="text-rose-300">Errores: <strong>{judgeState.failed}</strong></span>
                </div>
              </div>
            ) : null}

            {judgeState.phase === "error" ? (
              <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {judgeState.message}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">Auditoría individual de inactivos</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Los eventos inactivos no vuelven al flujo activo por defecto. Esta auditoría separada sirve
                  para revisar ocultos que podrían merecer reactivarse más adelante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runClassification({ activeStatus: "inactive" })}
                disabled={!canRun || isRunning || isJudgeRunning || inactiveNoGenre === 0}
                className="shrink-0 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:cursor-default disabled:opacity-50"
              >
                {inactiveNoGenre === 0 ? "Sin inactivos pendientes" : "Auditar inactivos"}
              </button>
            </div>

            <div className="mt-5 text-sm text-muted-foreground">
              Inactivos sin género pendientes: <strong className="text-foreground">{inactiveNoGenre}</strong>
            </div>
          </section>
        </div>

        <NormalizationBlockersPanel items={activeInsights} onClear={clearInsights} />
        {inactiveInsights.length > 0 ? (
          <NormalizationBlockersPanel items={inactiveInsights} onClear={clearInsights} />
        ) : null}

        <section className="space-y-4">
          <div className="sticky top-4 z-20 rounded-2xl border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por evento, razón o campo corregido"
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda fecha</SelectItem>
                  <SelectItem value="today">Últimas 24h</SelectItem>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-2 text-sm">
                <span className="text-muted-foreground">Resultados</span>
                <span className="font-semibold text-foreground">{filteredAuditEntries.length}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">
                  Seleccionados: <strong className="text-foreground">{selectedReviewEntries.length}</strong>
                </span>
                <span className="text-muted-foreground">
                  Pendientes visibles: <strong className="text-foreground">{reviewableEntries.length}</strong>
                </span>
                <span className="text-xs text-muted-foreground">
                  Descartar = marca <strong className="text-foreground">pipeline_excluded</strong> y lo saca del catálogo y de futuras auditorías.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkReviewDecision("approve")}
                  disabled={selectedReviewEntries.length === 0 || bulkReviewPending !== null}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-default disabled:opacity-50"
                >
                  {bulkReviewPending === "approve" ? "Aprobando..." : "Aprobar seleccionados"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkReviewDecision("reject")}
                  disabled={selectedReviewEntries.length === 0 || bulkReviewPending !== null}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:cursor-default disabled:opacity-50"
                >
                  {bulkReviewPending === "reject" ? "Descartando..." : "Descartar seleccionados"}
                </button>
              </div>
            </div>
            {bulkReviewError ? (
              <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {bulkReviewError}
              </div>
            ) : null}
          </div>

          {paginatedEntries.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
              <Table>
                <TableHeader className="bg-card/90">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar visibles"
                        checked={pageReviewableEntries.length > 0 && pageReviewableEntries.every((entry) => selectedAuditIds.includes(entry.id))}
                        onChange={(event) => togglePageSelection(event.target.checked)}
                        className="h-4 w-4 rounded border-border bg-background accent-primary"
                      />
                    </TableHead>
                    <TableHead className="min-w-[280px]">Evento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Confianza</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[220px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => {
                    const displayStatus = effectiveAuditStatus(entry);
                    const decision = primaryDecision(entry);
                    const isReview = displayStatus === "review";
                    const isSelected = selectedAuditIds.includes(entry.id);

                    return (
                      <TableRow
                        key={entry.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${entry.event_name ?? "evento"}`}
                            checked={isSelected}
                            disabled={!isReview}
                            onChange={(event) => toggleAuditSelection(entry.id, event.target.checked)}
                            className="h-4 w-4 rounded border-border bg-background accent-primary disabled:opacity-40"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">
                              {entry.event_name ?? "Evento sin nombre"}
                            </div>
                            {entry.summary ? (
                              <div className="line-clamp-2 text-xs text-muted-foreground">
                                {entry.summary}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeTone(displayStatus)}`}>
                            {statusLabel(displayStatus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground/90">
                          {decision?.field ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.provider} · {entry.model}
                        </TableCell>
                        <TableCell className="text-sm text-foreground/90">
                          {entry.confidence != null ? `${Math.round(entry.confidence * 100)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString("es-PE")}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedEntry(entry)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                            >
                              Ver detalle
                            </button>
                            {isReview ? (
                              <button
                                type="button"
                                onClick={() => void handleReviewDecision(entry, "reject")}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                              >
                                Descartar
                              </button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center text-sm text-muted-foreground">
              No hay resultados con los filtros actuales.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-40"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <AuditDetailDialog
        entry={selectedEntry}
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntry(null);
            setReviewActionPending(null);
            setReviewActionError(null);
          }
        }}
        onReviewDecision={handleReviewDecision}
        onRetryFailed={retryFailedEntry}
        reviewActionPending={reviewActionPending}
        reviewActionError={reviewActionError}
      />
    </>
  );
}
