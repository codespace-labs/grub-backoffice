"use client";

import { useState, useCallback, useMemo } from "react";
import type { EventListItemDto } from "@grub/contracts";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface AnalyticsDashboardProps {
  initialEvents: EventListItemDto[];
  accessToken: string;
}

function KpiCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-28 text-xs text-muted-foreground truncate text-right">
                {d.label}
              </span>
              <div className="flex-1 h-6 bg-secondary rounded overflow-hidden">
                <div
                  className="h-full bg-primary rounded transition-all"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-xs text-right tabular-nums">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleDonutChart({
  data,
  title,
}: {
  data: { label: string; value: number; color: string }[];
  title: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="flex-1 text-xs text-foreground truncate">
                {d.label}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {d.value}
              </span>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleAreaChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const height = 80;
  const width = 100;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - (d.value / max) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(258,90%,60%)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="hsl(258,90%,60%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#areaGrad)" />
            <polyline
              points={points}
              fill="none"
              stroke="hsl(258,90%,60%)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          {data.map((d) => (
            <div key={d.label} className="text-center">
              <div>{d.label}</div>
              <div className="font-medium text-foreground">{d.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const GENRE_COLORS = [
  "#7133FF",  // brand purple — matches mobile palette.purple[500]
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

export function AnalyticsDashboard({
  initialEvents,
  accessToken,
}: AnalyticsDashboardProps) {
  const [events, setEvents] = useState<EventListItemDto[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/api-admin-events`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { events: EventListItemDto[] };
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, supabaseUrl]);

  const kpis = useMemo(() => {
    const total = events.length;
    const active = events.filter((e) => e.is_active).length;
    const noGenres = events.filter(
      (e) => !e.event_genres || e.event_genres.length === 0
    ).length;
    const withCover = events.filter((e) => Boolean(e.cover_url)).length;
    return { total, active, noGenres, withCover };
  }, [events]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const src = e.source ?? "unknown";
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const genreData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      for (const eg of e.event_genres ?? []) {
        const name = eg.genres.name;
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([label, value], i) => ({
        label,
        value,
        color: GENRE_COLORS[i % GENRE_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        label: format(startOfMonth(d), "MMM", { locale: es }),
        key: format(startOfMonth(d), "yyyy-MM"),
        value: 0,
      };
    });

    for (const e of events) {
      try {
        const monthKey = e.date.slice(0, 7);
        const bucket = months.find((m) => m.key === monthKey);
        if (bucket) bucket.value += 1;
      } catch {
        // ignore
      }
    }

    return months;
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Métricas y estadísticas de los eventos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total eventos"
          value={kpis.total}
          sub="En la base de datos"
        />
        <KpiCard
          title="Eventos activos"
          value={kpis.active}
          sub={`${kpis.total > 0 ? Math.round((kpis.active / kpis.total) * 100) : 0}% del total`}
        />
        <KpiCard
          title="Sin géneros"
          value={kpis.noGenres}
          sub="Requieren clasificación"
        />
        <KpiCard
          title="Con cover"
          value={kpis.withCover}
          sub={`${kpis.total > 0 ? Math.round((kpis.withCover / kpis.total) * 100) : 0}% del total`}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SimpleBarChart data={sourceData} title="Eventos por fuente" />
        <SimpleDonutChart
          data={genreData}
          title="Distribución por géneros (top 8)"
        />
      </div>

      {/* Area chart full width */}
      <SimpleAreaChart
        data={monthlyData}
        title="Eventos por mes (últimos 6 meses)"
      />
    </div>
  );
}
