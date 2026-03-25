"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { BrandMark } from "./BrandMark";
import { backofficeNavItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-shrink-0 border-r border-border bg-card/95 backdrop-blur lg:flex lg:flex-col">
      <div className="border-b border-border px-5 py-5">
        <Link href="/backoffice" className="block">
          <BrandMark compact />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
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
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(109,40,249,0.28)]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">grub backoffice v0.1</p>
      </div>
    </aside>
  );
}
