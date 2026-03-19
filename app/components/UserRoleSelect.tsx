"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@grub/contracts";
import { backofficeSupabase } from "../../lib/supabase-browser";

const roleOptions: AdminRole[] = ["viewer", "operator", "admin"];

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: AdminRole;
  disabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<AdminRole>(role);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange(nextRole: AdminRole) {
    setValue(nextRole);
    setMessage(null);

    startTransition(async () => {
      const { data } = await backofficeSupabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sesión vencida");
        setValue(role);
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-admin-user-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: userId,
          role: nextRole,
        }),
      });

      if (!res.ok) {
        setMessage("No se pudo actualizar");
        setValue(role);
        return;
      }

      setMessage("Guardado");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <select
        value={value}
        disabled={disabled || isPending}
        onChange={(event) => onChange(event.target.value as AdminRole)}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(15,23,42,0.72)",
          color: "var(--text)",
          padding: "8px 10px",
          fontSize: 13,
        }}
      >
        {roleOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div style={{ color: "var(--muted)", fontSize: 12, minHeight: 16 }}>{message ?? " "}</div>
    </div>
  );
}
