"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Búsqueda" },
  { href: "/contactos", label: "Contactos" },
  { href: "/inventario", label: "Inventario" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="header"><div className="bar">
      <Link href="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
        <span className="mk" />Real<b>Tinder</b>
      </Link>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={"tab" + (path === t.href ? " on" : "")}>{t.label}</Link>
        ))}
      </nav>
    </div></header>
  );
}
