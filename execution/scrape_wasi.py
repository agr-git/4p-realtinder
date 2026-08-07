#!/usr/bin/env python3
"""
Scraper de inmuebles de las inmobiliarias Wasi del Eje Cafetero.

APRENDIZAJE (framework/MEMORY.global.md): los sitios Wasi NO comparten un solo
selector set. Cada sitio declara su VARIANTE de parser:

  - "home_icons"  (castrorosero): la HOME lista en <div class="item"> con
    features en íconos (fa-bed/fa-shower/class="area").
  - "search_text" (luciaprada): páginas /s/venta,/s/arriendo con features como
    texto plano en <div class="info_details">.
  - "caption_area"(vopropiedadraiz, administrabienes): /s/ con <h2> y
    'Área Construida'; hab/baños no vienen en el listado (Fase 2).
  - "search_dt"   (gruporepublica, gomezchaljubb, cima): /s/ con features en
    pares <span class="dt1">N</span><span class="dt2">Label</span> y precio en
    <div class="areaPrecio">.

Las variantes /s/* PAGINAN (?page=N). El scraper recorre páginas hasta que una
vuelve vacía (o el tope PAGE_CAP). Salida JSON. Contrato = docs/ARCHITECTURE.md §3.
"""
import re, json, html, argparse, time, urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")
PAGE_CAP = 8  # tope de páginas por operación (cortesía)

SITES = [
    {"source": "castrorosero",    "domain": "castrorosero.com",              "variant": "home_icons"},
    {"source": "vopropiedadraiz", "domain": "vopropiedadraiz.co",            "variant": "caption_area"},
    {"source": "administrabienes","domain": "administrabienesraices.com",     "variant": "caption_area"},
    {"source": "luciaprada",      "domain": "inmobiliarialuciaprada.com.co",  "variant": "search_text"},
    {"source": "gruporepublica",  "domain": "gruporepublica.com.co",          "variant": "search_dt"},
    {"source": "gomezchaljubb",   "domain": "inmobiliariagomezchaljubb.com",  "variant": "search_dt"},
    {"source": "cima",            "domain": "inmobiliariacima.com",           "variant": "search_dt"},
]
BIZ = {"arriendo": "arriendo", "alquiler": "arriendo", "arrendamiento": "arriendo",
       "venta": "venta", "permuta": "permuta"}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=25).read().decode("utf-8", "replace")


def price_int(s):
    d = re.sub(r"[^\d]", "", s); return int(d) if d else None


def area_num(s):
    s = s.strip()
    if "," in s: s = s.replace(".", "").replace(",", ".")
    elif "." in s and len(s.rsplit(".", 1)[1]) == 3: s = s.replace(".", "")
    try: return round(float(s), 2)
    except ValueError: return None


def parse_slug(slug):
    parts = slug.split("-")
    bi = next((i for i, p in enumerate(parts) if p in BIZ), None)
    if bi is None: return None, None, None, None
    return ("-".join(parts[:bi]) or None, BIZ[parts[bi]], "-".join(parts[bi + 1:-1]) or None, parts[-1] if parts[bi + 1:] else None)


def _row(source, domain, slug, code, price, beds, baths, area, title, img):
    pt, bz, nb, ci = parse_slug(slug)
    if price is None or not bz: return None
    return {"dedupe_key": f"{source}:{code}", "source": source, "source_listing_id": code,
            "url": f"https://{domain}/{slug}/{code}", "business_type": bz, "property_type": pt,
            "title": title, "price_cop": price, "beds": beds, "baths": baths, "area_m2": area,
            "city": ci, "neighborhood": nb, "image_url": img, "scraped_at": None}


def parse_home_icons(source, domain, h):
    listing = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"', re.I)
    price = re.compile(r'class="precio"[^>]*>\s*\$?\s*([\d.,]+)', re.I)
    title = re.compile(r'/\d+"\s*>\s*([A-Za-zÁÉÍÓÚÑáéíóúñ][^<]{4,90})')
    bed = re.compile(r'fa-bed"></i>\s*<span>(\d+)</span>'); bath = re.compile(r'fa-shower"></i>\s*<span>(\d+)</span>')
    area = re.compile(r'Área\s*m<sup>2</sup></strong>:\s*([\d.,]+)'); img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    rows, seen = [], set()
    for c in h.split('class="item"')[1:]:
        m = listing.search(c)
        if not m or m.group(2) in seen: continue
        seen.add(m.group(2))
        pm, tm, bd, ba, ar, im = price.search(c), title.search(c), bed.search(c), bath.search(c), area.search(c), img.search(c)
        r = _row(source, domain, m.group(1), m.group(2), price_int(pm.group(1)) if pm else None,
                 int(bd.group(1)) if bd else None, int(ba.group(1)) if ba else None,
                 area_num(ar.group(1)) if ar else None, html.unescape(tm.group(1).strip()) if tm else None, im.group(1) if im else None)
        if r: rows.append(r)
    return rows


def parse_search_text(source, domain, h):
    listing = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"', re.I)
    price = re.compile(r'class="precio"[^>]*>\s*\$?\s*([\d.,]+)', re.I)
    title = re.compile(r'class="t8-title"[^>]*>([^<]+)<'); details = re.compile(r'class="info_details">(.*?)</div>', re.S)
    img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    rows, seen = [], set()
    for c in h.split('class="item"')[1:]:
        m = listing.search(c)
        if not m or m.group(2) in seen: continue
        seen.add(m.group(2))
        pm, tm, dm, im = price.search(c), title.search(c), details.search(c), img.search(c)
        dt = dm.group(1) if dm else ""
        bd = re.search(r"(\d+)\s*Habitaci", dt); ba = re.search(r"(\d+)\s*Ba[ñn]o", dt); ar = re.search(r"([\d.,]+)\s*[ÁA]rea", dt)
        r = _row(source, domain, m.group(1), m.group(2), price_int(pm.group(1)) if pm else None,
                 int(bd.group(1)) if bd else None, int(ba.group(1)) if ba else None,
                 area_num(ar.group(1)) if ar else None, html.unescape(tm.group(1).strip()) if tm else None, im.group(1) if im else None)
        if r: rows.append(r)
    return rows


def parse_caption_area(source, domain, h):
    listing = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"', re.I)
    price = re.compile(r'class="precio"[^>]*>\s*\$?\s*([\d.,]+)', re.I)
    title = re.compile(r"<h2>([^<]{4,120})</h2>"); area = re.compile(r"Área Construida</strong>\s*:\s*([\d.,]+)\s*m", re.I)
    img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    rows, seen = [], set()
    for c in h.split('class="item"')[1:]:
        m = listing.search(c)
        if not m or m.group(2) in seen: continue
        seen.add(m.group(2))
        pm, tm, ar, im = price.search(c), title.search(c), area.search(c), img.search(c)
        r = _row(source, domain, m.group(1), m.group(2), price_int(pm.group(1)) if pm else None,
                 None, None, area_num(ar.group(1)) if ar else None, html.unescape(tm.group(1).strip()) if tm else None, im.group(1) if im else None)
        if r: rows.append(r)
    return rows


def parse_search_dt(source, domain, h):
    """gruporepublica/gomezchaljubb/cima: features en <span class=dt1>N</span><span class=dt2>Label</span>,
    precio en <div class=areaPrecio>. Tarjetas separadas por el <a> de la imagen."""
    # Separador = el <figure> que abre cada tarjeta. El patrón anterior partía por
    # <a href="…/id"><figure>, pero en el markup real el <a> de la imagen va DENTRO
    # del <figure>, no antes: nunca casaba, todo el HTML quedaba como UNA sola
    # tarjeta y solo se extraía el primer inmueble de la página (12 -> 1).
    # Fallo silencioso: devolvía 8 en vez de 0, así que parecía funcionar.
    # Cubierto por tests/test_parsers.py contra el fixture de gruporepublica.
    cards = re.split(r'(?=<figure)', h)
    tlink = re.compile(r'href="https://' + re.escape(domain) + r'/([a-z0-9-]+)/(\d+)"\s+class="t8-title"[^>]*>([^<]+)<')
    img = re.compile(r'<img[^>]+src="(https://image\.wasi\.co/[^"]+)"')
    prc = re.compile(r'\$\s?([\d.,]+)\s*<small>')
    def dt(win, label):
        r = re.search(r'<span class="dt1">([\d.,]+)</span>\s*<span class="dt2[^"]*">\s*' + label, win)
        return r.group(1) if r else None
    rows, seen = [], set()
    for c in cards:
        m = tlink.search(c)
        if not m or m.group(2) in seen: continue
        seen.add(m.group(2))
        bd = dt(c, "Habitaci"); ba = dt(c, "Ba[ñn]o"); ar = dt(c, "[ÁA]rea")
        pm, im = prc.search(c), img.search(c)
        r = _row(source, domain, m.group(1), m.group(2), price_int(pm.group(1)) if pm else None,
                 int(bd) if bd and bd.isdigit() else None, int(ba) if ba and ba.isdigit() else None,
                 area_num(ar) if ar else None, html.unescape(m.group(3).strip()), im.group(1) if im else None)
        if r: rows.append(r)
    return rows


def parse_detail(h):
    """Página de DETALLE Wasi (esquema consistente entre sitios):
    <li><strong>Alcobas / Ambientes:</strong> 3</li>, Baño(s):, Área Construida:, Estrato:.
    Es la fuente COMPLETA cuando el listado no trae hab/baños/área."""
    def li(label):
        m = re.search(r"<strong>\s*" + label + r"[^<]*</strong>\s*([\d.,]+)", h, re.I)
        return m.group(1) if m else None
    beds = li(r"(?:Alcobas|Habitaci)"); baths = li(r"Ba[ñn]o")
    area = li(r"Área Construida") or li(r"Área Privada"); est = li(r"Estrato")
    return (int(beds) if beds and beds.isdigit() else None,
            int(baths) if baths and baths.isdigit() else None,
            area_num(area) if area else None,
            int(est) if est and est.isdigit() else None)


def enrich_from_detail(rows, delay=0.5):
    """LECCIÓN: ninguna integración debe quedar incompleta. Si el listado no trae
    hab/baños/área, se rellenan desde la página de detalle (esquema Wasi común).
    Así cada sitio nuevo se corrige solo, sin nulls en producción."""
    todo = [r for r in rows if r["beds"] is None or r["baths"] is None or r["area_m2"] is None]
    if not todo:
        return
    print(f"# enriqueciendo {len(todo)} inmuebles desde su detalle…", flush=True)
    for r in todo:
        try:
            b, ba, a, e = parse_detail(fetch(r["url"]))
            if r["beds"] is None and b is not None: r["beds"] = b
            if r["baths"] is None and ba is not None: r["baths"] = ba
            if r["area_m2"] is None and a is not None: r["area_m2"] = a
            if e is not None: r["estrato"] = e   # estrato exacto del detalle
        except Exception:
            pass
        time.sleep(delay)


SEARCH_PARSERS = {"search_text": parse_search_text, "caption_area": parse_caption_area, "search_dt": parse_search_dt}


def scrape_site(site, stamp):
    src, dom, var = site["source"], site["domain"], site["variant"]
    rows, seen = [], set()
    if var == "home_icons":
        rows = parse_home_icons(src, dom, fetch(f"https://{dom}/"))
    elif var in SEARCH_PARSERS:
        parser = SEARCH_PARSERS[var]
        for op in ("venta", "arriendo"):
            for page in range(1, PAGE_CAP + 1):
                url = f"https://{dom}/s/{op}" + (f"?page={page}" if page > 1 else "")
                try: page_rows = parser(src, dom, fetch(url))
                except Exception: break
                fresh = [r for r in page_rows if r["dedupe_key"] not in seen]
                if not fresh: break              # sin nuevos -> fin de la paginación
                for r in fresh: seen.add(r["dedupe_key"])
                rows += fresh
                time.sleep(2)                    # cortesía entre páginas
    else:
        raise ValueError(f"variante desconocida: {var}")
    for r in rows: r["scraped_at"] = stamp
    return rows


def check_completeness(allrows):
    from collections import defaultdict
    by = defaultdict(list)
    for r in allrows: by[r["source"]].append(r)
    warns = []
    print("# --- CHECK de completitud por fuente ---")
    for src, rows in by.items():
        n = len(rows)
        pct = lambda k: (sum(1 for r in rows if r[k] is not None) * 100 // n) if n else 0
        print(f"#   {src:16} n={n:3}  area={pct('area_m2')}%  hab={pct('beds')}%  banos={pct('baths')}%")
        for field in ("area_m2", "beds", "baths"):
            if n > 0 and pct(field) == 0: warns.append(f"{src}: 0% con '{field}' — revisar variante o Fase 2")
    if warns:
        print("# ⚠️  ALERTAS:"); [print(f"#     - {w}") for w in warns]
    return warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="-"); ap.add_argument("--stamp", required=True)
    args = ap.parse_args()
    allrows = []
    for site in SITES:
        try:
            rows = scrape_site(site, args.stamp); allrows += rows
            print(f"# {site['source']:16} {len(rows)} inmuebles", flush=True)
        except Exception as e:
            print(f"# {site['source']:16} FALLA: {type(e).__name__}: {e}", flush=True)
        time.sleep(2)
    enrich_from_detail(allrows)   # completar hab/baños/área desde el detalle
    check_completeness(allrows)
    out = json.dumps(allrows, ensure_ascii=False, indent=1)
    if args.out == "-": print(out)
    else: open(args.out, "w").write(out); print(f"# TOTAL {len(allrows)} -> {args.out}")


if __name__ == "__main__":
    main()
