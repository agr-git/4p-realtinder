import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "RealTinder — Búsqueda por afinidad",
  description: "Inventario inmobiliario consolidado del Eje Cafetero, con match por afinidad.",
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
