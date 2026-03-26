"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "1rem",
          fontFamily: "sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Error inesperado
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#71717a" }}>
          {error.message}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}
