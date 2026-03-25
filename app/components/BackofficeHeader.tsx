import { LogoutButton } from "./LogoutButton";
import { BackofficeNav } from "./BackofficeNav";
import type { BackofficeRole } from "../../lib/backoffice-types";

export function BackofficeHeader({
  title,
  description,
  email,
  role,
}: {
  title: string;
  description: string;
  email: string | null;
  role: BackofficeRole;
}) {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4 }}>
            grub backoffice
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>{title}</h1>
          <p style={{ margin: 0, color: "var(--muted)", maxWidth: 760 }}>{description}</p>
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end", minWidth: 220 }}>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{email ?? "sin email"}</div>
          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{role}</div>
          <LogoutButton />
        </div>
      </div>

      <BackofficeNav />
    </section>
  );
}
