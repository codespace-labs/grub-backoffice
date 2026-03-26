type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = params.error ? decodeURIComponent(params.error) : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(100%, 460px)",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          borderRadius: 24,
          padding: 28,
          display: "grid",
          gap: 18,
          boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Acceso de operaciones</h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            Inicia sesión con tu usuario admin, operator o viewer de Supabase Auth.
          </p>
        </div>

        <form action="/api/auth/login" method="post" style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>Email</span>
            <input
              name="email"
              type="email"
              placeholder="admin@grub.pe"
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>Contraseña</span>
            <input
              name="password"
              type="password"
              placeholder="Tu contraseña"
              required
              style={inputStyle}
            />
          </label>

          {error ? <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div> : null}

          <button type="submit" style={buttonStyle}>
            Ingresar al backoffice
          </button>
        </form>
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--panel-border)",
  background: "rgba(15,23,42,0.72)",
  color: "var(--text)",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
} as const;

const buttonStyle = {
  border: 0,
  borderRadius: 14,
  padding: "14px 18px",
  background: "linear-gradient(135deg, #22c55e, #14b8a6)",
  color: "#04111d",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
} as const;
