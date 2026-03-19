"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { backofficeSupabase } from "../../lib/supabase-browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await backofficeSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      setError(signInError?.message ?? "No se pudo iniciar sesión");
      setLoading(false);
      return;
    }

    const sessionRes = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    });

    if (!sessionRes.ok) {
      setError("No se pudo guardar la sesión del backoffice");
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@grub.pe"
          required
          style={inputStyle}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Tu contraseña"
          required
          style={inputStyle}
        />
      </label>

      {error ? <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div> : null}

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? "Ingresando..." : "Ingresar al backoffice"}
      </button>
    </form>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--panel-border)",
  background: "rgba(15,23,42,0.72)",
  color: "var(--text)",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "14px 18px",
  background: "linear-gradient(135deg, #22c55e, #14b8a6)",
  color: "#04111d",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
