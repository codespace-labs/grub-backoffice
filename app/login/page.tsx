import { redirect } from "next/navigation";
import { getBackofficeSession } from "../../lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getBackofficeSession();

  if (session) {
    redirect("/");
  }

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
          <div style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4 }}>
            grub backoffice
          </div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Acceso de operaciones</h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            Inicia sesión con tu usuario admin, operator o viewer de Supabase Auth.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
