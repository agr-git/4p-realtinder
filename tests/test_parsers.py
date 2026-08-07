#!/usr/bin/env python3
"""Tests de los parsers contra fixtures de HTML real (CLAUDE.md §4, Etapa 2).

Un fixture es una captura real de la página, commiteada al repo. El objetivo es
que un selector roto salga ROJO aquí y no como dato faltante en produccion.

Motivo de existir: el 2026-08-07 `parse_search_dt` extraia 1 inmueble de los 12
de la pagina y nadie lo noto durante semanas, porque devolvia 8 (no 0) y eso
parecia razonable. Sin fixture no habia forma de verlo.

Uso:  python3 tests/test_parsers.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "execution"))

from scrape_wasi import parse_search_dt  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
fallos = []


def check(nombre, cond, detalle=""):
    if cond:
        print(f"  ok   {nombre}")
    else:
        print(f"  FALLA {nombre} — {detalle}")
        fallos.append(nombre)


def test_search_dt_gruporepublica():
    """La pagina de busqueda trae 12 fichas: el parser debe devolver las 12."""
    ruta = os.path.join(FIXTURES, "gruporepublica_search_venta.html")
    if not os.path.exists(ruta):
        check("fixture presente", False, f"falta {ruta}")
        return

    with open(ruta, encoding="utf-8") as f:
        html_doc = f.read()

    rows = parse_search_dt("gruporepublica", "gruporepublica.com.co", html_doc)

    # 12 fichas en el fixture. Antes del fix del split salia 1.
    check("extrae las 12 fichas", len(rows) == 12, f"extrajo {len(rows)}")

    # Regresion concreta: mas de una. Si el split se vuelve a romper, cae aqui.
    check("mas de una ficha (regresion del split)", len(rows) > 1, f"extrajo {len(rows)}")

    if not rows:
        return

    # Contrato de datos (docs/ARCHITECTURE.md §3)
    check("todas con dedupe_key", all(r.get("dedupe_key") for r in rows))
    check("dedupe_key unicos", len({r["dedupe_key"] for r in rows}) == len(rows))
    check("todas con url", all(r.get("url") for r in rows))
    check("todas con titulo", all(r.get("title") for r in rows))

    con_precio = sum(1 for r in rows if r.get("price_cop"))
    check("precio en todas", con_precio == len(rows), f"{con_precio}/{len(rows)}")

    # El listado de este sitio SI trae features (dt1/dt2): sin ellas el
    # enriquecimiento por detalle tendria que cubrir el 100%, que es mas lento
    # y mas fragil. Si esto baja, el markup cambio.
    con_hab = sum(1 for r in rows if r.get("beds") is not None)
    check("habitaciones en >=80%", con_hab >= len(rows) * 0.8, f"{con_hab}/{len(rows)}")

    con_area = sum(1 for r in rows if r.get("area_m2") is not None)
    check("area en >=80%", con_area >= len(rows) * 0.8, f"{con_area}/{len(rows)}")

    # El business_type sale del slug de la ficha, no de la URL de busqueda
    # (/s/venta y /s/arriendo devuelven el MISMO contenido en este sitio).
    tipos = {r.get("business_type") for r in rows}
    check("business_type poblado", all(tipos), f"tipos={tipos}")


if __name__ == "__main__":
    print("test_search_dt_gruporepublica")
    test_search_dt_gruporepublica()
    print()
    if fallos:
        print(f"FALLARON {len(fallos)}: {', '.join(fallos)}")
        sys.exit(1)
    print("Todo verde.")
