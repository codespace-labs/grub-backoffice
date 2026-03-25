import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "grub backoffice",
  description: "Operaciones y calidad de datos para grub",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
