import Link from "next/link";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/events", label: "Eventos" },
  { href: "/quality", label: "Calidad" },
  { href: "/sync", label: "Syncs" },
  { href: "/audit", label: "Auditoría" },
];

export function BackofficeNav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(15,23,42,0.68)",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
