"use client";

import { useState, useCallback, useMemo, useDeferredValue } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { EventListItemDto } from "@grub/contracts";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getTime,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, Plus, ExternalLink, ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { EventFormDialog } from "./EventFormDialog";
import { Switch } from "./ui/switch";
import { formatEventTitle } from "../../lib/formatEventTitle";

interface EventsTableProps {
  initialEvents: EventListItemDto[];
  initialError?: string | null;
  accessToken: string;
  mode?: "upcoming" | "past" | "all";
}

type SourceBadgeStyle = {
  label: string;
  bg: string;
  color: string;
  border: string;
};

type AdminEventsResponse = {
  events?: EventListItemDto[];
  event?: EventListItemDto;
  ok?: boolean;
  deleted_event_count?: number;
  deleted_sync_run_count?: number;
  error?: string;
};

const SOURCE_BADGE_STYLES: Record<string, SourceBadgeStyle> = {
  ticketmaster: {
    label: "ticketmaster",
    bg: "rgba(37,99,235,0.18)",
    color: "#60a5fa",
    border: "rgba(37,99,235,0.34)",
  },
  "ticketmaster-pe": {
    label: "ticketmaster",
    bg: "rgba(37,99,235,0.18)",
    color: "#60a5fa",
    border: "rgba(37,99,235,0.34)",
  },
  teleticket: {
    label: "teleticket",
    bg: "rgba(234,88,12,0.18)",
    color: "#fb923c",
    border: "rgba(234,88,12,0.34)",
  },
  joinnus: {
    label: "joinnus",
    bg: "rgba(244,114,182,0.18)",
    color: "#f9a8d4",
    border: "rgba(244,114,182,0.34)",
  },
  vastion: {
    label: "vastion",
    bg: "rgba(34,197,94,0.14)",
    color: "#86efac",
    border: "rgba(34,197,94,0.3)",
  },
  passline: {
    label: "passline",
    bg: "rgba(250,204,21,0.14)",
    color: "#fde047",
    border: "rgba(250,204,21,0.3)",
  },
  tikpe: {
    label: "tikpe",
    bg: "rgba(45,212,191,0.16)",
    color: "#5eead4",
    border: "rgba(45,212,191,0.3)",
  },
  "ticketera-app": {
    label: "tikpe",
    bg: "rgba(45,212,191,0.16)",
    color: "#5eead4",
    border: "rgba(45,212,191,0.3)",
  },
};

function getSourceBadgeStyle(source: string | null | undefined): SourceBadgeStyle {
  if (!source) {
    return {
      label: "—",
      bg: "rgba(148,163,184,0.12)",
      color: "#cbd5e1",
      border: "rgba(148,163,184,0.24)",
    };
  }

  return SOURCE_BADGE_STYLES[source] ?? {
    label: source,
    bg: "rgba(148,163,184,0.12)",
    color: "#cbd5e1",
    border: "rgba(148,163,184,0.24)",
  };
}

function eventMatchesFilters(
  event: EventListItemDto,
  params: {
    query: string;
    sourceFilter: string;
    genreFilter: string;
    statusFilter: string;
    completenessFilter: string;
    calendarFilter: string;
    dateFrom: string;
    dateTo: string;
    mode: "upcoming" | "past" | "all";
  },
) {
  const hasGenres = (event.event_genres?.length ?? 0) > 0;
  const hasVenue = typeof event.venue === "string" && event.venue.trim().length > 0;
  const genreSlugs = new Set(
    (event.event_genres ?? [])
      .map((relation) => relation.genres?.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  const eventDate = event.date ? parseISO(event.date) : null;
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { locale: es });
  const weekEnd = endOfWeek(now, { locale: es });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const next30Days = addDays(todayStart, 30);

  if (params.query) {
    const q = params.query.toLowerCase();
    if (!event.name.toLowerCase().includes(q)) return false;
  }
  if (params.sourceFilter !== "all" && event.source !== params.sourceFilter) return false;
  if (params.genreFilter !== "all" && !genreSlugs.has(params.genreFilter)) return false;
  if (params.statusFilter === "active" && !event.is_active) return false;
  if (params.statusFilter === "inactive" && event.is_active) return false;
  if (params.completenessFilter === "missing_genre" && hasGenres) return false;
  if (params.completenessFilter === "missing_venue" && hasVenue) return false;
  if (params.completenessFilter === "missing_genre_or_venue" && hasGenres && hasVenue) return false;
  if (params.mode !== "all") {
    if (!eventDate || Number.isNaN(eventDate.getTime())) return false;
    if (params.mode === "upcoming" && isBefore(eventDate, todayStart)) return false;
    if (params.mode === "past" && !isBefore(eventDate, todayStart)) return false;
  }
  if (params.calendarFilter !== "all") {
    if (!eventDate || Number.isNaN(eventDate.getTime())) return false;

    if (params.calendarFilter === "today" && !isSameDay(eventDate, now)) return false;
    if (
      params.calendarFilter === "week" &&
      !isWithinInterval(eventDate, { start: weekStart, end: weekEnd })
    ) return false;
    if (
      params.calendarFilter === "month" &&
      !isWithinInterval(eventDate, { start: monthStart, end: monthEnd })
    ) return false;
    if (
      params.calendarFilter === "next_30_days" &&
      (isBefore(eventDate, todayStart) || isAfter(eventDate, next30Days))
    ) return false;
    if (params.calendarFilter === "past" && !isBefore(eventDate, todayStart)) return false;
    if (params.calendarFilter === "upcoming" && isBefore(eventDate, todayStart)) return false;
  }
  if (params.dateFrom) {
    if (!eventDate || Number.isNaN(eventDate.getTime())) return false;
    const fromDate = startOfDay(parseISO(`${params.dateFrom}T00:00:00`));
    if (isBefore(eventDate, fromDate)) return false;
  }
  if (params.dateTo) {
    if (!eventDate || Number.isNaN(eventDate.getTime())) return false;
    const toDateExclusive = addDays(startOfDay(parseISO(`${params.dateTo}T00:00:00`)), 1);
    if (!isBefore(eventDate, toDateExclusive)) return false;
  }

  return true;
}

function compareEventsByDate(
  left: EventListItemDto,
  right: EventListItemDto,
  mode: "upcoming" | "past" | "all",
): number {
  const leftDate = left.date ? parseISO(left.date) : null;
  const rightDate = right.date ? parseISO(right.date) : null;

  if (!leftDate && !rightDate) return left.name.localeCompare(right.name, "es");
  if (!leftDate) return 1;
  if (!rightDate) return -1;
  if (mode === "past") return getTime(rightDate) - getTime(leftDate);
  return getTime(leftDate) - getTime(rightDate);
}

export function EventsTable({
  initialEvents,
  initialError = null,
  accessToken,
  mode = "all",
}: EventsTableProps) {
  const [events, setEvents] = useState<EventListItemDto[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(initialError);
  const [pendingEventIds, setPendingEventIds] = useState<Record<string, true>>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completenessFilter, setCompletenessFilter] = useState("all");
  const [calendarFilter, setCalendarFilter] = useState(
    mode === "past" ? "past" : mode === "upcoming" ? "upcoming" : "all",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventListItemDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const deferredGlobalFilter = useDeferredValue(globalFilter);

  const markPending = useCallback((eventId: string, value: boolean) => {
    setPendingEventIds((current) => {
      if (value) return { ...current, [eventId]: true };
      const next = { ...current };
      delete next[eventId];
      return next;
    });
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/events?limit=500", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as AdminEventsResponse;
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEvents(data.events ?? []);
      setSelectedIds(new Set());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudieron cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleActive = useCallback(async (event: EventListItemDto) => {
    const nextIsActive = !(event.is_active ?? false);
    const previous = [...events];
    setActionError(null);
    markPending(event.id, true);
    setEvents((current) =>
      current.map((e) =>
        e.id === event.id ? { ...e, is_active: nextIsActive } : e
      )
    );

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextIsActive }),
      });

      const data = (await res.json().catch(() => ({}))) as AdminEventsResponse;
      if (!res.ok || !data.event) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setEvents((current) =>
        current.map((item) => (item.id === event.id ? { ...item, ...data.event } : item)),
      );
    } catch (err) {
      console.error("Toggle failed:", err);
      setEvents(previous);
      setActionError(
        err instanceof Error ? err.message : "No se pudo actualizar el evento.",
      );
    } finally {
      markPending(event.id, false);
    }
  }, [events, markPending]);

  const deleteEvent = useCallback(async (event: EventListItemDto) => {
    const confirmed = window.confirm(
      `Vas a eliminar "${event.name}". Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setActionError(null);
    markPending(event.id, true);
    const previous = [...events];
    setEvents((current) => current.filter((item) => item.id !== event.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(event.id);
      return next;
    });
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? `Delete failed: ${res.status}`);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      setEvents(previous);
      setActionError(
        err instanceof Error ? err.message : "No se pudo eliminar el evento.",
      );
    } finally {
      markPending(event.id, false);
    }
  }, [events, markPending]);

  const toggleSelectAll = useCallback((checked: boolean) => {
    const visibleEvents = events.filter((event) => eventMatchesFilters(event, {
      query: deferredGlobalFilter,
      sourceFilter,
      genreFilter,
      statusFilter,
      completenessFilter,
      calendarFilter,
      dateFrom,
      dateTo,
      mode,
    }));

    setSelectedIds((current) => {
      const next = new Set(current);
      for (const event of visibleEvents) {
        if (checked) next.add(event.id);
        else next.delete(event.id);
      }
      return next;
    });
  }, [calendarFilter, completenessFilter, dateFrom, dateTo, deferredGlobalFilter, events, genreFilter, mode, sourceFilter, statusFilter]);

  const toggleSelectOne = useCallback((eventId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }, []);

  const handleBulkDeleteSelected = useCallback(async () => {
    const selectedEvents = events.filter((event) => selectedIds.has(event.id));
    if (!selectedEvents.length) return;

    const names = selectedEvents.map((event) => event.name).slice(0, 3).join(", ");
    const suffix = selectedEvents.length > 3 ? ` y ${selectedEvents.length - 3} más` : "";
    const confirmed = window.confirm(
      `Vas a eliminar ${selectedEvents.length} evento(s): ${names}${suffix}. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setActionError(null);
    const ids = selectedEvents.map((event) => event.id);
    const previous = [...events];
    setEvents((current) => current.filter((event) => !ids.includes(event.id)));
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as AdminEventsResponse;
      if (!res.ok) throw new Error(data.error ?? `Delete failed: ${res.status}`);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      setEvents(previous);
      setActionError(
        err instanceof Error ? err.message : "No se pudieron eliminar los eventos seleccionados.",
      );
    }
  }, [events, selectedIds]);

  const handleDeleteBySource = useCallback(async () => {
    if (sourceFilter === "all") return;

    const confirmed = window.confirm(
      `Vas a eliminar todos los eventos de la fuente "${sourceFilter}" y sus corridas de sync asociadas. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setActionError(null);
    const previous = [...events];
    setEvents((current) => current.filter((event) => event.source !== sourceFilter));
    setSelectedIds((current) => new Set(
      [...current].filter((id) => previous.some((event) => event.id === id && event.source !== sourceFilter)),
    ));

    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceFilter, delete_sync_runs: true }),
      });
      const data = (await res.json().catch(() => ({}))) as AdminEventsResponse;
      if (!res.ok) throw new Error(data.error ?? `Delete failed: ${res.status}`);
    } catch (err) {
      console.error("Source delete failed:", err);
      setEvents(previous);
      setActionError(
        err instanceof Error ? err.message : "No se pudo eliminar la fuente seleccionada.",
      );
    }
  }, [events, sourceFilter]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.source).filter(Boolean))).sort() as string[];
  }, [events]);

  const availableGenres = useMemo(() => {
    const genresBySlug = new Map<string, string>();

    for (const event of events) {
      for (const relation of event.event_genres ?? []) {
        const genre = relation.genres;
        if (!genre?.slug || !genre.name) continue;
        if (!genresBySlug.has(genre.slug)) {
          genresBySlug.set(genre.slug, genre.name);
        }
      }
    }

    return Array.from(genresBySlug.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [events]);

  const filteredData = useMemo(() => events.filter((event) => eventMatchesFilters(event, {
    query: deferredGlobalFilter,
    sourceFilter,
    genreFilter,
    statusFilter,
    completenessFilter,
    calendarFilter,
    dateFrom,
    dateTo,
    mode,
  })), [calendarFilter, completenessFilter, dateFrom, dateTo, events, deferredGlobalFilter, genreFilter, mode, sourceFilter, statusFilter]);

  const allFilteredSelected = filteredData.length > 0
    && filteredData.every((event) => selectedIds.has(event.id));
  const sourceEventCount = useMemo(
    () => sourceFilter === "all" ? 0 : events.filter((event) => event.source === sourceFilter).length,
    [events, sourceFilter],
  );

  const columns = useMemo<ColumnDef<EventListItemDto>[]>(() => [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={(e) => toggleSelectAll(e.target.checked)}
          className="accent-primary"
          aria-label="Seleccionar todos"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={(e) => toggleSelectOne(row.original.id, e.target.checked)}
          className="accent-primary"
          aria-label={`Seleccionar ${row.original.name}`}
        />
      ),
      size: 36,
    },
    {
      id: "cover",
      header: "",
      cell: ({ row }) => {
        const url = row.original.cover_url;
        const formattedName = formatEventTitle(row.original.name);
        return url ? (
          <img
            src={url}
            alt={formattedName}
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center text-muted-foreground text-xs">
            ?
          </div>
        );
      },
      size: 50,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nombre
          {column.getIsSorted() === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ChevronDown className="h-3 w-3" />
          ) : null}
        </button>
      ),
      cell: ({ row }) => formatEventTitle(row.original.name),
    },
    {
      accessorKey: "date",
      header: "Fecha",
      sortingFn: (rowA, rowB) =>
        compareEventsByDate(rowA.original, rowB.original, mode),
      cell: ({ getValue }) => {
        const val = getValue<string>();
        try {
          return format(parseISO(val), "dd MMM yyyy", { locale: es });
        } catch {
          return val;
        }
      },
    },
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground text-xs">
          {getValue<string | null>() ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "city",
      header: "Ciudad",
      cell: ({ row }) => (
        <span className="text-xs">
          {[row.original.city, row.original.country_code]
            .filter(Boolean)
            .join(", ") || "—"}
        </span>
      ),
    },
    {
      id: "genres",
      header: "Géneros",
      cell: ({ row }) => {
        const genres = row.original.event_genres ?? [];
        if (!genres.length) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {genres.filter((eg) => eg.genres).slice(0, 3).map((eg, index) => (
              <Badge key={eg.genres?.id ?? `${row.original.id}-${index}`} variant="secondary" className="text-xs">
                {eg.genres?.name}
              </Badge>
            ))}
            {genres.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{genres.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: "Activo",
      cell: ({ row }) => (
        <Switch
          checked={row.original.is_active ?? false}
          onCheckedChange={() => toggleActive(row.original)}
          disabled={Boolean(pendingEventIds[row.original.id])}
        />
      ),
    },
    {
      accessorKey: "source",
      header: "Fuente",
      cell: ({ getValue }) => {
        const source = getValue<string | null>();
        const style = getSourceBadgeStyle(source);
        return (
          <Badge
            variant="outline"
            className="text-xs font-semibold"
            style={{
              backgroundColor: style.bg,
              color: style.color,
              borderColor: style.border,
            }}
          >
            {style.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const url = row.original.ticket_url;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedEvent(row.original);
                setDialogOpen(true);
              }}
              disabled={Boolean(pendingEventIds[row.original.id])}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => deleteEvent(row.original)}
              disabled={Boolean(pendingEventIds[row.original.id])}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], [
    allFilteredSelected,
    deleteEvent,
    mode,
    pendingEventIds,
    selectedIds,
    toggleActive,
    toggleSelectAll,
    toggleSelectOne,
  ]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
      sorting: [{ id: "date", desc: mode === "past" }],
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = filteredData.length;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold">Catálogo de eventos</h3>
            <p className="text-sm text-muted-foreground">
              Crea, edita, activa o elimina eventos desde un solo lugar.
            </p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 ? (
              <Button variant="destructive" size="sm" onClick={handleBulkDeleteSelected}>
                <Trash2 className="h-4 w-4" />
                Eliminar {selectedIds.size}
              </Button>
            ) : null}
            {sourceFilter !== "all" ? (
              <Button variant="destructive" size="sm" onClick={handleDeleteBySource}>
                <Trash2 className="h-4 w-4" />
                Borrar fuente {sourceFilter} ({sourceEventCount})
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedEvent(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo evento
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <Input
            placeholder="Buscar por nombre..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="lg:w-72"
          />
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="lg:w-48">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fuentes</SelectItem>
              {availableSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="lg:w-48">
              <SelectValue placeholder="Género" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los géneros</SelectItem>
              {availableGenres.map((genre) => (
                <SelectItem key={genre.slug} value={genre.slug}>
                  {genre.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="lg:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={completenessFilter} onValueChange={setCompletenessFilter}>
            <SelectTrigger className="lg:w-56">
              <SelectValue placeholder="Compleción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="missing_genre">Sin género</SelectItem>
              <SelectItem value="missing_venue">Sin venue</SelectItem>
              <SelectItem value="missing_genre_or_venue">Sin género o venue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={calendarFilter} onValueChange={setCalendarFilter}>
            <SelectTrigger className="lg:w-52">
              <SelectValue placeholder="Calendario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fechas</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="next_30_days">Próximos 30 días</SelectItem>
              <SelectItem value="upcoming">Próximos</SelectItem>
              <SelectItem value="past">Pasados</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="lg:w-44"
            aria-label="Fecha desde"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="lg:w-44"
            aria-label="Fecha hasta"
          />
        </div>
      </div>

      {actionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron eventos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalRows > 0
            ? `${from}–${to} de ${totalRows} eventos`
            : "Sin resultados"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEvent(null);
        }}
        onSuccess={async (savedEvent) => {
          setEvents((current) => {
            const exists = current.some((item) => item.id === savedEvent.id);
            return exists
              ? current.map((item) => item.id === savedEvent.id ? { ...item, ...savedEvent } : item)
              : [savedEvent, ...current];
          });
          setSelectedEvent(null);
        }}
        accessToken={accessToken}
        event={selectedEvent}
      />
    </div>
  );
}
