"""Genera public/ para Netlify a partir de app/ (una sola fuente).

Netlify lo ejecuta en cada deploy (ver netlify.toml). Sólo usa la librería estándar.
La conexión a Supabase llega por variables de entorno de Netlify:
  SUPABASE_URL       https://<proyecto>.supabase.co
  SUPABASE_ANON_KEY  llave pública "anon" (es pública por diseño; los candados RLS protegen los datos)
Sin ellas, el portal muestra el acceso bloqueado con "configuración pendiente".
El mapa interno y los archivos SQL NO se publican.
"""
import json
import os
import re
import shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FUENTE = AQUI / "app"
SALIDA = AQUI / "public"


def main() -> None:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if url and not re.fullmatch(r"https://[a-z0-9-]+\.supabase\.co", url):
        raise SystemExit(f"SUPABASE_URL no tiene el formato esperado: {url!r}")

    if SALIDA.exists():
        shutil.rmtree(SALIDA)
    shutil.copytree(FUENTE, SALIDA)

    cfg = json.dumps({"supabaseUrl": url, "supabaseAnonKey": anon}).replace("</", "<\\/")
    index = SALIDA / "index.html"
    html = index.read_text(encoding="utf8")
    if html.count("<!--CONFIG-->") != 1:
        raise SystemExit("index.html debe tener exactamente un marcador <!--CONFIG-->")
    index.write_text(html.replace("<!--CONFIG-->", f"<script>window.APP_CONFIG={cfg}</script>"), encoding="utf8")
    (SALIDA / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf8")

    estado = "conectado a " + url if url and anon else "SIN conexión a Supabase (acceso bloqueado)"
    print(f"public/ listo · {estado}")


if __name__ == "__main__":
    main()
