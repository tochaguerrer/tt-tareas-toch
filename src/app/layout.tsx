import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TT — Tareas TOCH | Teté",
  description: "Teté, el sistema corporativo de gestión de TOCH.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
