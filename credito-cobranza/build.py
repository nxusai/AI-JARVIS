"""Genera public/ para Netlify a partir de prototipo-tablero.html (una sola fuente).

Netlify lo ejecuta en cada deploy (ver netlify.toml). Sólo usa la librería estándar.
El mapa interno (mapa-interactivo.html) NO se publica: es material de trabajo de NXUS.
"""
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FUENTE = AQUI / "prototipo-tablero.html"
SALIDA = AQUI / "public"

CHART_URL = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
CHART_SRI = "sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD"

FAVICON = (
    "data:image/svg+xml,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
    "%3Crect width='32' height='32' rx='8' fill='%2328e0c8'/%3E"
    "%3Cpath d='M9 24V15M16 24V8M23 24v-6' stroke='%2306221f' stroke-width='3' stroke-linecap='round'/%3E"
    "%3C/svg%3E"
)


def main() -> None:
    src = FUENTE.read_text(encoding="utf8")

    etiqueta = f'<script src="{CHART_URL}"></script>'
    if src.count(etiqueta) != 1:
        raise SystemExit("No encontré la etiqueta de Chart.js esperada; revisa build.py.")
    src = src.replace(
        etiqueta,
        f'<script src="{CHART_URL}" integrity="{CHART_SRI}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>',
    )

    corte = src.index("</style>") + len("</style>")
    cabeza, cuerpo = src[:corte], src[corte:]

    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0b0f1a">
<link rel="icon" href="{FAVICON}">
{cabeza}
</head>
<body>
{cuerpo}
</body>
</html>
"""
    SALIDA.mkdir(exist_ok=True)
    (SALIDA / "index.html").write_text(html, encoding="utf8")
    (SALIDA / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf8")
    print(f"public/index.html listo ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
