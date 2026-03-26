"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import type { BackofficeSession } from "../../lib/backoffice-types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { BrandMark } from "./BrandMark";
import { backofficeNavItems } from "./nav-items";
import { LogoutButton } from "../../app/components/LogoutButton";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

interface HeaderProps {
  session: BackofficeSession;
  title?: string;
}

export function Header({ session, title = "Backoffice" }: HeaderProps) {
  const pathname = usePathname();
  const currentItem = useMemo(
    () =>
      backofficeNavItems.find((item) =>
        item.href === "/backoffice"
          ? pathname === "/backoffice"
          : pathname.startsWith(item.href),
      ),
    [pathname],
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="border-r border-border bg-card p-0">
            <SheetHeader className="border-b border-border px-5 py-5">
              <SheetTitle className="text-left">
                <Link href="/backoffice" className="inline-block">
                  <BrandMark compact />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="px-3 py-4">
              <ul className="space-y-1">
                {backofficeNavItems.map((item) => {
                  const isActive =
                    item.href === "/backoffice"
                      ? pathname === "/backoffice"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {currentItem?.shortLabel ?? "Backoffice"}
          </p>
          <h1 className="truncate text-lg font-semibold text-foreground">
            {currentItem?.label ?? title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          variant={
            session.role === "admin"
              ? "default"
              : session.role === "operator"
                ? "secondary"
                : "outline"
          }
          className="capitalize"
        >
          {session.role}
        </Badge>
        <span className="hidden text-sm text-muted-foreground md:inline">
          {session.email}
        </span>
        <div className="flex items-center gap-2">
          <ChangePasswordDialog />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
