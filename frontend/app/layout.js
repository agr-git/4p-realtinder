import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "RealTinder — Búsqueda por afinidad",
  description: "Inventario inmobiliario consolidado del Eje Cafetero, con match por afinidad.",
};

// Explícito y no solo por el default de Next: `viewportFit: "cover"` es lo que
// habilita env(safe-area-inset-*), sin lo cual en iPhone con notch el header y
// la barra inferior quedan bajo el sistema.
// NO se fija maximum-scale ni userScalable: bloquear el zoom rompe la
// accesibilidad para quien necesita ampliar (WCAG 1.4.4).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#150a0d" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
