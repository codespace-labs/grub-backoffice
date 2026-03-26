"use client";

import type { Route } from "next";
import {
  LayoutDashboard,
  CalendarDays,
  ShieldAlert,
  Workflow,
  Search,
  Sparkles,
  History,
  Users,
  BarChart3,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface BackofficeNavItem {
  href: Route;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const backofficeNavItems: BackofficeNavItem[] = [
  {
    href: "/backoffice" as Route,
    label: "Overview",
    shortLabel: "Inicio",
    icon: LayoutDashboard,
  },
  {
    href: "/backoffice/events" as Route,
    label: "Eventos",
    shortLabel: "Eventos",
    icon: CalendarDays,
  },
  {
    href: "/backoffice/past-events" as Route,
    label: "Eventos pasados",
    shortLabel: "Pasados",
    icon: CalendarDays,
  },
  {
    href: "/backoffice/quality" as Route,
    label: "Calidad",
    shortLabel: "Calidad",
    icon: ShieldAlert,
  },
  {
    href: "/backoffice/scrapers" as Route,
    label: "Scrapers",
    shortLabel: "Scrapers",
    icon: Search,
  },
  {
    href: "/backoffice/normalization" as Route,
    label: "Normalización",
    shortLabel: "Normalización",
    icon: Sparkles,
  },
  {
    href: "/backoffice/sync" as Route,
    label: "Syncs",
    shortLabel: "Syncs",
    icon: Workflow,
  },
  {
    href: "/backoffice/audit" as Route,
    label: "Auditoria",
    shortLabel: "Auditoria",
    icon: History,
  },
  {
    href: "/backoffice/users" as Route,
    label: "Usuarios",
    shortLabel: "Usuarios",
    icon: Users,
  },
  {
    href: "/backoffice/analytics" as Route,
    label: "Analytics",
    shortLabel: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/backoffice/cms" as Route,
    label: "CMS",
    shortLabel: "CMS",
    icon: FileText,
  },
];
