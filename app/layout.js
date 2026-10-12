import localFont from "next/font/local";
import "./globals.css";
import AuthGate from "../components/AuthGate";
import PaginaLista, { CapturaDeClics } from "../components/PaginaLista";

// Fuentes dentro del repo (app/fonts): el build no descarga nada de internet.
// Son variables por rango de peso, así que cubren 400, 500 y 600 con un
// archivo por estilo.
const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-400-600.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/Fraunces-Italic-400-600.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "./fonts/Inter-400-600.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Contabilidad — Coaching deportivo",
  description: "Registro de cuotas de jugadores y alumnos de la certificación",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Contabilidad — Coaching deportivo",
    description: "Registro de cuotas de jugadores y alumnos de la certificación",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        {/* Brillo fijo y tenue de fondo: no se mueve. */}
        <div className="brillo brillo-oro" aria-hidden="true" />
        <div className="brillo brillo-azul" aria-hidden="true" />
        <CapturaDeClics />
        <PaginaLista />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
