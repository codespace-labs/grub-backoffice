"use client";

import { useCallback, useEffect, useState } from "react";
import type { BackofficeRole } from "../../lib/backoffice-types";
import type { EventListItemDto } from "@grub/contracts";

type ScraperEvent = EventListItemDto & {
  genres: string[];
  sourceResolved: string;
};

type DashboardSnapshot = {
  events: ScraperEvent[];
  lastUpdated: string;
};

type SortField = "name" | "date" | "price_min";
type SortDir = "asc" | "desc";

type SourceMeta = {
  key: string;
  label: string;
  color: string;
  text: string;
};

async function parseApiError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  try {
    const body = await res.json() as { error?: string };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const SOURCE_META: Record<string, Omit<SourceMeta, "key">> = {
  ticketmaster: {
    label: "Ticketmaster",
    color: "rgba(37,99,235,0.18)",
    text: "#60a5fa",
  },
  teleticket: {
    label: "Teleticket",
    color: "rgba(234,88,12,0.18)",
    text: "#fb923c",
  },
  joinnus: {
    label: "Joinnus",
    color: "rgba(244,114,182,0.18)",
    text: "#f9a8d4",
  },
  vastion: {
    label: "Vastion",
    color: "rgba(34,197,94,0.14)",
    text: "#86efac",
  },
  passline: {
    label: "Passline",
    color: "rgba(250,204,21,0.14)",
    text: "#fde047",
  },
  tikpe: {
    label: "Tik.pe",
    color: "rgba(45,212,191,0.16)",
    text: "#5eead4",
  },
};

const GENRE_COLORS: Record<string, { bg: string; color: string }> = {
  techno: { bg: "rgba(124,58,237,0.2)", color: "#a78bfa" },
  house: { bg: "rgba(37,99,235,0.2)", color: "#60a5fa" },
  reggaeton: { bg: "rgba(22,163,74,0.2)", color: "#4ade80" },
  salsa: { bg: "rgba(220,38,38,0.2)", color: "#f87171" },
  cumbia: { bg: "rgba(217,119,6,0.2)", color: "#fbbf24" },
  rock: { bg: "rgba(107,114,128,0.2)", color: "#9ca3af" },
  metal: { bg: "rgba(55,48,48,0.4)", color: "#d1d5db" },
  "hip-hop": { bg: "rgba(234,88,12,0.2)", color: "#fb923c" },
  trap: { bg: "rgba(139,92,246,0.2)", color: "#c4b5fd" },
  indie: { bg: "rgba(13,148,136,0.2)", color: "#2dd4bf" },
  electronica: { bg: "rgba(8,145,178,0.2)", color: "#22d3ee" },
  "latin-bass": { bg: "rgba(219,39,119,0.2)", color: "#f472b6" },
  pop: { bg: "rgba(236,72,153,0.2)", color: "#f9a8d4" },
  "pop-latino": { bg: "rgba(245,101,18,0.2)", color: "#fdba74" },
  balada: { bg: "rgba(99,102,241,0.2)", color: "#a5b4fc" },
  rnb: { bg: "rgba(168,85,247,0.2)", color: "#d8b4fe" },
  jazz: { bg: "rgba(234,179,8,0.2)", color: "#fde047" },
  clasica: { bg: "rgba(203,213,225,0.1)", color: "#cbd5e1" },
  kpop: { bg: "rgba(236,72,153,0.25)", color: "#fbcfe8" },
  folklore: { bg: "rgba(132,204,22,0.2)", color: "#bef264" },
};

function resolveSource(event: EventListItemDto): string {
  if (event.source === "ticketmaster-pe") return "ticketmaster";
  if (event.source) return event.source;
  const url = event.ticket_url ?? "";
  if (url.includes("joinnus.com")) return "joinnus";
  if (url.includes("passline.com")) return "passline";
  if (url.includes("vastiontickets.com")) return "vastion";
  if (url.includes("tik.pe")) return "tikpe";
  if (url.includes("ticketmaster.pe")) return "ticketmaster";
  if (url.includes("ticketmaster")) return "ticketmaster";
  if (url.includes("teleticket")) return "teleticket";
  return "otro";
}

function startCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSourceMeta(sourceKey: string): SourceMeta {
  if (sourceKey === "ticketmaster-pe") {
    return { key: "ticketmaster", ...SOURCE_META.ticketmaster };
  }

  const known = SOURCE_META[sourceKey];
  if (known) {
    return { key: sourceKey, ...known };
  }

  return {
    key: sourceKey,
    label: startCase(sourceKey),
    color: "rgba(148,163,184,0.14)",
    text: "#cbd5e1",
  };
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function hasVisibleVenue(event: ScraperEvent) {
  const venue = (event.venue ?? "").trim().toLowerCase();
  return !!venue && venue !== "por anunciar" && venue !== "-";
}

function hasLocationLeak(event: ScraperEvent) {
  const city = (event.city ?? "").trim();
  if (!city) return false;
  const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`\\s+-\\s*${escaped}\\s*$`, "i"),
    new RegExp(`\\s+en\\s+${escaped}\\s*$`, "i"),
    new RegExp(`\\s*\\(${escaped}\\)\\s*$`, "i"),
  ].some((regex) => regex.test(event.name));
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return {
    date: date.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function formatPrice(min: number | null, max?: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `S/ ${min.toLocaleString()} – ${max.toLocaleString()}`;
  return `S/ ${(min ?? max)!.toLocaleString()}`;
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: color ?? "var(--text)" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export function ScraperDashboard({ role }: { role: BackofficeRole }) {
  const [allEvents, setAllEvents] = useState<ScraperEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [filterTime, setFilterTime] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQuality, setFilterQuality] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const canSync = role === "admin" || role === "operator";

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setAllEvents(snapshot.events);
    setLastUpdated(snapshot.lastUpdated);
  }, []);

  const fetchSnapshot = useCallback(async (): Promise<DashboardSnapshot> => {
    const eventsRes = await fetch("/api/admin/events?limit=500", {
      cache: "no-store",
    });

    if (!eventsRes.ok) throw new Error(await parseApiError(eventsRes));

    const json = await eventsRes.json();
    const raw: EventListItemDto[] = json.events ?? [];

    return {
      events: raw.map((event) => ({
        ...event,
        genres: (event.event_genres ?? []).map((item) => item.genres?.slug).filter(Boolean) as string[],
        sourceResolved: resolveSource(event),
      })),
      lastUpdated: new Date().toLocaleTimeString("es-PE"),
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const snapshot = await fetchSnapshot();
      applySnapshot(snapshot);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, fetchSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleActive(eventId: string, current: boolean) {
    setActionError(null);
    const res = await fetch("/api/admin/event-deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, isActive: !current, reason: "backoffice_scraper" }),
    });

    if (res.ok) {
      setAllEvents((prev) => prev.map((event) => event.id === eventId ? { ...event, is_active: !current } : event));
      return;
    }

    setActionError(await parseApiError(res));
  }

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const filtered = allEvents
    .filter((event) => {
      if (filterSource && event.sourceResolved !== filterSource) return false;
      if (filterGenre && !event.genres.includes(filterGenre)) return false;
      if (search && !normalize(event.name).includes(normalize(search))) return false;
      if (filterStatus === "active" && event.is_active === false) return false;
      if (filterStatus === "inactive" && event.is_active !== false) return false;
      if (filterTime === "upcoming" && event.date && new Date(event.date) < now) return false;
      if (filterTime === "past" && event.date && new Date(event.date) >= now) return false;
      if (filterTime === "30d") {
        if (!event.date) return false;
        const date = new Date(event.date);
        if (date < now || date > in30) return false;
      }
      if (filterQuality === "no-genre" && event.genres.length > 0) return false;
      if (filterQuality === "no-venue" && hasVisibleVenue(event)) return false;
      if (filterQuality === "location-leak" && !hasLocationLeak(event)) return false;
      if (filterQuality === "no-cover" && event.cover_url) return false;
      return true;
    })
    .sort((left, right) => {
      const leftValue = left[sortField] ?? "";
      const rightValue = right[sortField] ?? "";
      if (leftValue === "") return 1;
      if (rightValue === "") return -1;
      const cmp = String(leftValue).toLowerCase() < String(rightValue).toLowerCase() ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageStart = (page - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageEvents = filtered.slice(pageStart, pageEnd);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setFilterSource("");
    setFilterGenre("");
    setFilterTime("");
    setFilterStatus("");
    setFilterQuality("");
    setPage(1);
  }

  const totalActive = allEvents.filter((event) => event.is_active !== false);
  const withCover = allEvents.filter((event) => event.cover_url).length;
  const noGenre = allEvents.filter((event) => event.genres.length === 0).length;
  const noVenue = allEvents.filter((event) => !hasVisibleVenue(event)).length;
  const upcoming30 = allEvents.filter((event) => event.date && new Date(event.date) >= now && new Date(event.date) <= in30).length;
  const coverPct = allEvents.length ? Math.round((withCover / allEvents.length) * 100) : 0;
  const allGenres = [...new Set(allEvents.flatMap((event) => event.genres))].sort();
  const sourceCounts = new Map<string, number>();
  for (const event of allEvents) {
    sourceCounts.set(event.sourceResolved, (sourceCounts.get(event.sourceResolved) ?? 0) + 1);
  }
  const sourceOptions = [...sourceCounts.keys()]
    .sort((left, right) => {
      const countDiff = (sourceCounts.get(right) ?? 0) - (sourceCounts.get(left) ?? 0);
      if (countDiff !== 0) return countDiff;
      return left.localeCompare(right);
    })
    .map((sourceKey) => getSourceMeta(sourceKey));

  function sortIcon(field: SortField) {
    if (sortField !== field) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80, color: "var(--muted)" }}>Cargando eventos...</div>;
  }

  if (loadError) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "#f87171" }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Error al conectar</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{loadError}</div>
        <button onClick={loadData} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {actionError ? (
        <div style={{ borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(127,29,29,0.18)", color: "#fca5a5", padding: "12px 14px", fontSize: 13 }}>
          {actionError}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Datos en tiempo real{lastUpdated ? ` · Actualizado: ${lastUpdated}` : ""}
          </span>
        </div>
        <button
          onClick={loadData}
          style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Actualizar
        </button>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Resumen</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Metric label="Total en BD" value={allEvents.length} sub={`${totalActive.length} activos`} color="var(--accent)" />
          <Metric label="Con cover" value={withCover} sub={`${coverPct}% del total`} color="#22c55e" />
          <Metric label="Sin géneros" value={noGenre} sub="pendientes de clasificar" color="#f59e0b" />
          <Metric label="Sin venue visible" value={noVenue} sub='vacío o "Por anunciar"' color="#f59e0b" />
          <Metric label="Próximos 30 días" value={upcoming30} sub="eventos vigentes" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Buscar evento..."
          style={inputStyle}
        />
        <select value={filterSource} onChange={(event) => { setFilterSource(event.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Fuente: Todas</option>
          {sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}
        </select>
        <select value={filterGenre} onChange={(event) => { setFilterGenre(event.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Género: Todos</option>
          {allGenres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
        </select>
        <select value={filterTime} onChange={(event) => { setFilterTime(event.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Fecha: Todas</option>
          <option value="upcoming">Solo próximos</option>
          <option value="past">Solo pasados</option>
          <option value="30d">Próximos 30 días</option>
        </select>
        <select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Estado: Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <select value={filterQuality} onChange={(event) => { setFilterQuality(event.target.value); setPage(1); }} style={inputStyle}>
          <option value="">Calidad: Todas</option>
          <option value="no-genre">Sin géneros</option>
          <option value="no-venue">Sin venue</option>
          <option value="location-leak">Título con ciudad</option>
          <option value="no-cover">Sin cover</option>
        </select>
        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        <button onClick={clearFilters} style={{ ...inputStyle, cursor: "pointer", background: "transparent", color: "var(--muted)" }}>Limpiar</button>
        <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} style={inputStyle}>
          <option value={25}>25 / pág</option>
          <option value={50}>50 / pág</option>
          <option value={100}>100 / pág</option>
        </select>
      </div>

      <div style={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Cover", null, "Evento", "Fecha", "Venue", "Ciudad", "Géneros", "Precio", "Estado", "Fuente", ""].map((header, index) => (
                  <th
                    key={index}
                    onClick={header === "Evento" ? () => toggleSort("name") : header === "Fecha" ? () => toggleSort("date") : header === "Precio" ? () => toggleSort("price_min") : undefined}
                    style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--panel-border)", whiteSpace: "nowrap", cursor: ["Evento", "Fecha", "Precio"].includes(header ?? "") ? "pointer" : "default" }}
                  >
                    {header}{header === "Evento" ? sortIcon("name") : header === "Fecha" ? sortIcon("date") : header === "Precio" ? sortIcon("price_min") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageEvents.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>No se encontraron eventos.</td>
                </tr>
              ) : pageEvents.map((event) => {
                const formattedDate = formatDate(event.date);
                const price = formatPrice(event.price_min, event.price_max);
                const isPast = event.date && new Date(event.date) < now;
                const isActive = event.is_active !== false;
                const locationLeak = hasLocationLeak(event);
                const sourceConfig = getSourceMeta(event.sourceResolved);

                return (
                  <tr key={event.id} style={{ borderBottom: "1px solid var(--panel-border)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      {event.cover_url ? (
                        <img src={event.cover_url} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, display: "block" }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>Sin cover</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 0" }} />
                    <td style={{ padding: "10px 14px", maxWidth: 260 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>
                        {event.name}
                        {locationLeak ? <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#fbbf24", padding: "1px 5px", borderRadius: 3 }}>ciudad</span> : null}
                        {event.genres.length === 0 ? <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#fbbf24", padding: "1px 5px", borderRadius: 3 }}>sin género</span> : null}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontSize: 12, color: isPast ? "var(--muted)" : "var(--text)" }}>
                      {formattedDate && typeof formattedDate === "object" ? (
                        <>
                          <span style={{ display: "block" }}>{formattedDate.date}</span>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>{event.start_time ? event.start_time.slice(0, 5) : formattedDate.time}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", maxWidth: 200, fontSize: 12, color: event.venue ? "var(--text)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {event.venue || "Por anunciar"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {event.city ?? "—"}{event.country_code ? `, ${event.country_code}` : ""}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxWidth: 200 }}>
                        {event.genres.length > 0 ? event.genres.map((genre) => {
                          const config = GENRE_COLORS[genre] ?? { bg: "rgba(107,107,133,0.2)", color: "#6b6b85" };
                          return (
                            <span key={genre} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: config.bg, color: config.color, whiteSpace: "nowrap" }}>
                              {genre}
                            </span>
                          );
                        }) : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap", color: price ? "var(--text)" : "var(--muted)" }}>
                      {price ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {event.availability_status === "available"
                        ? <span style={badge("#22c55e")}>Disponible</span>
                        : event.availability_status === "sold_out"
                          ? <span style={badge("#f87171")}>Agotado</span>
                          : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 4, background: sourceConfig.color, color: sourceConfig.text }}>
                        {sourceConfig.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {event.ticket_url ? (
                          <a href={event.ticket_url} target="_blank" rel="noopener" style={{ fontSize: 11, padding: "4px 9px", borderRadius: 5, border: "1px solid var(--panel-border)", color: "var(--muted)", textDecoration: "none" }}>
                            Ver
                          </a>
                        ) : null}
                        {canSync ? (
                          <button
                            onClick={() => toggleActive(event.id, isActive)}
                            style={{ fontSize: 11, padding: "4px 9px", borderRadius: 5, border: `1px solid ${isActive ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`, background: "transparent", color: isActive ? "#f87171" : "#4ade80", cursor: "pointer" }}
                          >
                            {isActive ? "Desactivar" : "Activar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--panel-border)", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {filtered.length > 0 ? `Mostrando ${pageStart + 1}–${pageEnd} de ${filtered.length}` : "Sin resultados"}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} style={pgBtn(false)}>Anterior</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => {
              const pageNumber = totalPages <= 7 ? index + 1 : index + Math.max(1, page - 3);
              if (pageNumber > totalPages) return null;
              return <button key={pageNumber} onClick={() => setPage(pageNumber)} style={pgBtn(pageNumber === page)}>{pageNumber}</button>;
            })}
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} style={pgBtn(false)}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--panel-border)",
  borderRadius: 6,
  color: "var(--text)",
  fontFamily: "inherit",
  fontSize: 12,
  padding: "6px 10px",
  outline: "none",
  height: 32,
};

function badge(color: string): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 4,
    background: `${color}26`,
    color,
    whiteSpace: "nowrap",
  };
}

function pgBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(139,92,246,0.15)" : "var(--panel)",
    border: `1px solid ${active ? "var(--accent)" : "var(--panel-border)"}`,
    borderRadius: 5,
    color: active ? "var(--accent)" : "var(--muted)",
    fontFamily: "inherit",
    fontSize: 12,
    padding: "5px 9px",
    cursor: "pointer",
  };
}
