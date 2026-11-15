# Análisis: reel "META Ads x Claude Code" (alexander.tiler) · 15 nov 2026

Video en Drive: "Videos de trabajo para analizar y replicar" → ScreenRecording_11-15-2026 00-10-46_1.MP4 (22 s, grabación de pantalla de un Reel, sin voz, música "REVENGE (Super Slowed)"). Texto: "My Meta ads get built by AI agents now".

## Qué se ve
- Ads Manager (marca de prueba "KOVA Cold Brew", campañas en "Campaign off") y una pestaña "Claude Code" al lado.
- Varias flechas de colores con etiqueta, cada una es un agente con un rol, trabajando al mismo tiempo:
  - **Strategist** (naranja): arma la estructura y decide qué conceptos probar.
  - **Audience** (azul): público.
  - **Copy** (morado): texto principal, título, descripción.
  - **Builder** (verde): crea y duplica campañas, conjuntos y anuncios.
  - **Pixel** (cian): ubicación de conversión, URL, parámetros de seguimiento.
  - **Compliance** (verde agua): campos legales (anunciante/pagador), reglas de Meta.
  - **QA** (rojo): revisa cada anuncio antes de terminar.
  - **Analyst** (amarillo): lectura de resultados.
- Estructura de nombres (lo más valioso):
  - Campañas: `KOVA | SALES | TEST | 2026-11`, `… | SCALE | …`, `… | RETENTION | …`.
  - Conjuntos: `US | BROAD | Concepts`, `US | BROAD | Winners`, `US | RT 30d site + 14d cart | 15% off`, `US | CUSTOMERS | Refill`.
  - Anuncios: `C1-V1 | IMG | Desk slump`, `C1-V2 | IMG | Pre-workout`, `C2-V1 | IMG | Price per can` … (C = concepto/ángulo, V = variante).
  - Ejemplo de copy: "3 pm slump? A cold can of KOVA at your desk. 150 mg caffeine, no sugar added." / "Your desk deserves better coffee" / "Free shipping from 2 packs".

## Qué es y cómo se hace (investigación)
- No encontré un producto público que dibuje esas flechas con etiqueta; parece una configuración propia (varios agentes de Claude Code manejando el navegador y una capa que dibuja un cursor por agente) o un efecto de edición. El video está acelerado y es de un creador que vende el método: no se puede confirmar que todo sea automático.
- Lo que SÍ existe y es oficial: **Meta Ads AI Connectors** (open beta, 2026): servidor MCP `https://mcp.facebook.com/ads` y una CLI. ~29 herramientas: reportes, diagnóstico de señales/pixel, crear y editar campañas, conjuntos y anuncios, catálogos. Se conecta en Claude → Customize → Connectors → Custom connector. Lo creado sale **en pausa**. Tiene los mismos permisos que el usuario de Facebook (lectura y escritura).

## Cómo replicarlo en NXUS (propuesta)
- Equipo por roles (Estratega, Público, Copy, Cumplimiento, QA, Analista) = Claude en este chat, con las reglas de `docs/lecciones-anuncios-mensajes.md`.
- Constructor = conector oficial de Meta (todo en pausa) o Claude in Chrome para lo que el conector no cubra (plantilla de ManyChat en "Partner app").
- Analista = panel "Anuncios" de HQ (solo lectura) + reportes del conector.
- Nombres al estilo C#-V#: `NXUS | MX | TEST | 2026-11`, conjunto `MX | 30+ | Zonas`, anuncio `C1-V1 | VID | Sucursales`.
- Regla: Eduardo revisa y activa; nada se prende solo.
