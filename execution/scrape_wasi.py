#!/usr/bin/env python3
"""
Scraper de inmuebles de las inmobiliarias Wasi del Eje Cafetero.

APRENDIZAJE CLAVE (ver framework/MEMORY.global.md): el supuesto de que "los 7
sitios Wasi comparten un solo selector set" es FALSO. Distintas instalaciones de
Wasi renderizan las tarjetas de forma distinta. Por eso cada sitio declara su
VARIANTE de parser:

  - "home_icons": la home lista inmuebles en <div class="item"> con las features
    en íconos (<i class="fal fa-bed"><span>N</span>, fa-shower, class="area">).
    Aplica a castrorosero, vopropiedadraiz, administrabienes.
  - "search_text": las features vienen como TEXTO en <div class="info_details">
    ("3 Habitaciones / 2 Baños / 2 Garaje / 121 Área m²") y los inmuebles con
    todos los detalles están en las páginas /s/venta y /s/arriendo, no en la home.
    Aplica a luciaprada.

Salida: JSON consolidado en stdout (o al archivo de --out). Contrato de campos =
docs/ARCHITECTURE.md §3.  NO scrapea páginas de detalle (eso es Fase 2).
"""
import re, json, html, argparse, time, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")

SITES = [
    {"source": "castrorosero",    "domain": "castrorosero.com",                 "variant": "home_icons"},
    {"source": "vopropiedadraiz", "domain": "vopropiedadraiz.co",              "variant": "home_icons"},
    {"source": "administrabienes","domain": "administrabienesraices.com",       "variant": "home_icons"},
    {"source": "luciaprada",      "domain": "inmobiliarialuciaprada.com.co",    "variant": "search_text"},
    # gruporepublica, gomezchaljubb, cima: la home devolvió 0 con este parser;
    # requieren revisión de su estructura antes de habilitarlos.
]

BIZ = {"arriendo": "arriendo", "alquiler": "arriendo", "arrendamiento": "arriendo",
       "venta": "venta", "permuta": "permuta"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "replace")


def price_int(s):
    """COP: los puntos son separadores de miles, sin decimales -> entero."""
    d = re.sub(r"[^\d]", "", s)
    return int(d) if d else None


def area_num(s):
    """Área: coma = decimal; punto = miles SOLO si le siguen 3 dígitos (71.8 -> 71.8, 1.200 -> 1200)."""
    s = s.strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif "." in s and len(s.rsplit(".", 1)[1]) == 3:
        s = s.replace(".", "")
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def parse_slug(slug):
    """URL Wasi: <tipo>-<negocio>-<barrio...>-<ciudad>. Devuelve (tipo, negocio, barrio, ciudad)."""
    parts = slug.split("-")
    bi = next((i for i, p in enumerate(parts) if p in BIZ), None)
    if bi is None:
        return None, None, None, None
    ptype = "-".join(parts[:bi]) or None
    business = BIZ[parts[bi]]
    tail = parts[bi + 1:]
    city = tail[-1] if tail else None
    neighborhood = "-".join(tail[:-1]) or None
    return ptype, business, neighborhood, city


def _row(source, domain, slug, code, price, beds, baths, area, title, img):
    pt, bz, nb, ci = parse_slug(slug)
    if price is None or not bz:      # contrato §3: sin precio o sin negocio -> se descarta
        return None
    return {
        "dedupe_key": f"{source}:{code}", "source": source, "source_listing_id": code,
        "url": f"https://{domain}/{slug}/{code}", "business_type": bz, "property_type": pt,
        "title": title, "price_cop": price, "beds": beds, "baths": baths, "area_m2": area,
        "city": ci, "neighborhood": nb, "image_url": img, "scraped_at": None,
    }


def parse_home_icons(source, domain, htmltext):
    listing = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"', re.I)
    price = re.compile(r'class="precio"[^>]*>\s*\$?\s*([\d.,]+)', re.I)
    title = re.compile(r'/\d+"\s*>\s*([A-Za-zÁÉÍÓÚÑáéíóúñ][^<]{4,90})')
    bed = re.compile(r'fa-bed"></i>\s*<span>(\d+)</span>')
    bath = re.compile(r'fa-shower"></i>\s*<span>(\d+)</span>')
    area = re.compile(r'Área\s*m<sup>2</sup></strong>:\s*([\d.,]+)')
    img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    rows, seen = [], set()
    for c in htmltext.split('class="item"')[1:]:
        m = listing.search(c)
        if not m or m.group(2) in seen:
            continue
        seen.add(m.group(2))
        pm, tm, bd, ba, ar, im = (price.search(c), title.search(c), bed.search(c),
                                  bath.search(c), area.search(c), img.search(c))
        r = _row(source, domain, m.group(1), m.group(2),
                 price_int(pm.group(1)) if pm else None,
                 int(bd.group(1)) if bd else None, int(ba.group(1)) if ba else None,
                 area_num(ar.group(1)) if ar else None,
                 html.unescape(tm.group(1).strip()) if tm else None,
                 im.group(1) if im else None)
        if r:
            rows.append(r)
    return rows


def parse_search_text(source, domain, htmltext):
    """Variante luciaprada: features en texto dentro de <div class="info_details">."""
    listing = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"', re.I)
    price = re.compile(r'class="precio"[^>]*>\s*\$?\s*([\d.,]+)', re.I)
    title = re.compile(r'class="t8-title"[^>]*>([^<]+)<')
    details = re.compile(r'class="info_details">(.*?)</div>', re.S)
    img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    rows, seen = [], set()
    for c in htmltext.split('class="item"')[1:]:
        m = listing.search(c)
        if not m or m.group(2) in seen:
            continue
        seen.add(m.group(2))
        pm, tm, dm, im = price.search(c), title.search(c), details.search(c), img.search(c)
        dt = dm.group(1) if dm else ""
        bd = re.search(r"(\d+)\s*Habitaci", dt)
        ba = re.search(r"(\d+)\s*Ba[ñn]o", dt)
        ar = re.search(r"([\d.,]+)\s*[ÁA]rea", dt)
        r = _row(source, domain, m.group(1), m.group(2),
                 price_int(pm.group(1)) if pm else None,
                 int(bd.group(1)) if bd else None, int(ba.group(1)) if ba else None,
                 area_num(ar.group(1)) if ar else None,
                 html.unescape(tm.group(1).strip()) if tm else None,
                 im.group(1) if im else None)
        if r:
            rows.append(r)
    return rows


def scrape_site(site, stamp):
    src, dom, var = site["source"], site["domain"], site["variant"]
    if var == "home_icons":
        rows = parse_home_icons(src, dom, fetch(f"https://{dom}/"))
    elif var == "search_text":
        rows = []
        for op in ("venta", "arriendo"):
            rows += parse_search_text(src, dom, fetch(f"https://{dom}/s/{op}"))
    else:
        raise ValueError(f"variante desconocida: {var}")
    for r in rows:
        r["scraped_at"] = stamp
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="-", help="archivo de salida JSON, o '-' para stdout")
    ap.add_argument("--stamp", required=True, help="timestamp ISO para scraped_at (ej. 2026-07-26T00:00:00Z)")
    args = ap.parse_args()
    allrows = []
    for site in SITES:
        try:
            rows = scrape_site(site, args.stamp)
            allrows += rows
            print(f"# {site['source']:16} {len(rows)} inmuebles", flush=True)
        except Exception as e:  # noqa: BLE001 — un sitio caído no debe tumbar el resto (aislamiento del loop)
            print(f"# {site['source']:16} FALLA: {type(e).__name__}: {e}", flush=True)
        time.sleep(2)  # cortesía: ≥2s entre requests
    out = json.dumps(allrows, ensure_ascii=False, indent=1)
    if args.out == "-":
        print(out)
    else:
        open(args.out, "w").write(out)
        print(f"# TOTAL {len(allrows)} -> {args.out}")


if __name__ == "__main__":
    main()
