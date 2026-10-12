// Encabezados de todas las respuestas.
//  - /api: datos privados de cada sesión. "private, no-store" para que ningún
//    CDN ni el navegador los guarde ni los comparta entre usuarios.
//  - Todo el sitio: no se puede mostrar dentro de un iframe de otro sitio
//    (clickjacking), el navegador no adivina tipos de archivo y no se manda la
//    URL completa a otros sitios.
const SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sin "X-Powered-By: Next.js": no hace falta anunciar la tecnología.
  poweredByHeader: false,
  // Las pantallas viejas de Cobros (Jugadores y Alumnos) ahora son una sola.
  async redirects() {
    return [
      { source: "/jugadores", destination: "/cobros?tipo=jugador", permanent: false },
      { source: "/alumnos", destination: "/cobros?tipo=alumno", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SEGURIDAD },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
