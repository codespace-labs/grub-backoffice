import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "grub backoffice",
  description: "Operaciones y calidad de datos para grub",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
