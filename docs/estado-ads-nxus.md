# Estado: anuncios de NXUS AI en Meta (para un chat dedicado a ads)

Última actualización: 6 de noviembre de 2026. Lee también `docs/estado-nxus.md`: ahí está cómo trabajar con Eduardo y el ecosistema de leads (ManyChat → HQ → NEX llama → Meet).

## Cómo trabajar con Eduardo (lo esencial)
- **Idioma y formato:**
  - Español, con pasos clic por clic y los nombres de los botones en inglés, como salen en pantalla.
  - Links y comandos van dentro de cada paso y se repiten al final.
  - Nunca decir "el mensaje anterior".
- **Seguridad:**
  - Nunca pedir ni pegar llaves, contraseñas o tarjetas en el chat.
  - Sin PR si no lo pide.
- **Enseñar antes de entregar:** foto o vista previa de lo que se va a subir o publicar.
- **No inventar estadísticas en los anuncios.**
- **NEX** se prende y apaga a mano; nunca sugerir que corra solo.
- **Videos: antes de entregar, revisar el video TERMINADO, no solo los fotogramas.**
  - Transcribir el audio final (faster-whisper en un venv del scratchpad).
  - Comprobar que la pista de audio dure lo mismo que el video. Un error real fue que la mezcla junto con el video cortaba el audio a los 30 s y el final se oía mocho.
  - Mezclar el audio en un paso aparte y luego unirlo con el video.

## Qué decidió Eduardo
- **Contenido y anuncios:** los maneja él a mano en Meta Business, con ayuda de **Claude in Chrome**. HQ ya no publica ni maneja anuncios (se quitó el 1 de noviembre).
- **Cuenta de anuncios:** "Eduardo's" (act_736971049130563), compartida con otros negocios suyos. Pendiente crear una aparte para los otros negocios.
- **Ofertas:**
  - Para el cliente: diagnóstico **GRATIS de 30 minutos**.
  - Para el anuncio: el anuncio abre un chat (Messenger + Instagram), el lead escribe o toca **"INFO"** y arranca el flujo **Filtro NXUS** de ManyChat. El lead llega a HQ y NEX lo llama al momento.
- **Público objetivo en México:**
  - Quiénes: dueños de restaurantes, sobre todo cadenas, y empresarios grandes.
  - Zonas: Zona Esmeralda, Roma Sur, Polanco, Santa Fe, Coyoacán, Lindavista y alrededores, y La Cúspide (Edo. Méx.).
  - **Las zonas van en la segmentación de Meta (Audience → Locations), NUNCA en el video ni en la voz.**
- **Los videos:**
  - **NO mencionan** ciudades, colonias, "CDMX" ni "Estado de México".
  - **Ya no dicen "Escríbenos INFO".** Lo pidió quitar porque se oía junto ("agenda la palainfo").
  - El cierre es "Agenda tu diagnóstico gratis de 30 minutos", con la tarjeta "DIAGNÓSTICO GRATIS · 30 minutos · Cupos limitados este mes".
  - El "INFO" va en el texto del anuncio y en los botones del chat.
- **"Stop finger":** los primeros 3 segundos deben detener el dedo. Hay 3 ganchos para que Meta pruebe cuál funciona.

## Lo que ya existe
- **Prompt para Claude in Chrome (versión 1):** `ads/prompt-chrome-v1.txt`.
  - **Estructura de campañas:**
    - Dos campañas separadas: **"NXUS | MX | Mensajes | Diagnóstico"** y **"NXUS | USA | Mensajes | Diagnóstico"**.
    - Objetivo Engagement con destino a apps de mensajes (Messenger + Instagram, sin WhatsApp).
    - Presupuesto diario por conjunto: $12 USD en MX y $20 USD en USA, como punto de partida.
    - Público Advantage+ amplio, con intereses solo como sugerencia.
  - **Plantilla del chat:** el primer botón manda **"INFO"**.
  - **Anuncios:** 3 por país (A, B y C) con sus textos en español e inglés.
  - **Reglas de la extensión:**
    - Se detiene antes de publicar.
    - No toca campañas existentes ni pagos.
    - No sube archivos; espera a que Eduardo los suba.
  - **Advantage+ creative:** solo mejoras de texto y de brillo; sin música automática ni cambios con IA.
  - **Ojo, el prompt está desactualizado:**
    - La ubicación de MX dice "todo México"; Eduardo ahora quiere sus zonas (arriba).
    - El nombre del anuncio C dice "Hook México"; el video C ya no habla de México.
    - Actualizar ambos en la versión 2.
- **Videos del anuncio (español, 9:16, 1080×1920, voz "Mark" de Higgsfield/ElevenLabs).**
  - Duran unos 34, 33 y 32 s (A, B y C). Son los que Eduardo aprobó.

  | Video | Gancho (0–5 s) |
  |---|---|
  | NXUS-Ad-A | "Son las 11:48 de la noche… tu negocio está cerrado… y tus clientes te siguen escribiendo" (celular con mensajes que se juntan) |
  | NXUS-Ad-B | "Este empleado atiende a tus clientes a las 3 de la mañana… y nunca pide horas extra" |
  | NXUS-Ad-C | "¿Tienes un restaurante o una empresa? Esto te está costando dinero" |

  - **Cuerpo, igual en los tres:**
    1. Problema: mensajes sin contestar, reservas perdidas, clientes que se van con la competencia.
    2. NXUS AI: una IA atiende 24 horas por WhatsApp, Instagram y teléfono.
    3. Agenda, da seguimiento y deja las ventas listas para cerrar.
    4. Software a la medida y marketing "para restaurantes y empresas que quieren crecer".
    5. Cierre con el diagnóstico gratis.
  - **Dónde están los archivos:** los mp4 no están en GitHub. Eduardo los tiene descargados.
  - **Cómo rehacerlos o editarlos:** con `ads/nxus-video/`.
    1. `bash preparar.sh`: baja las tomas y voces, y arma voz y música.
    2. `node capa.cjs A`: gráficos animados.
    3. `bash armar.sh A`: composición final.
    4. Repetir los pasos 2 y 3 con B y C.
    - Los textos y los tiempos están en `versiones.py` y `capa.html`.
- **No hay versión en inglés de los videos para USA.** Está pendiente si Eduardo la quiere.
- **Fuentes de la investigación:**
  - https://www.growthspreeofficial.com/blogs/meta-video-ads-b2b-saas-2026
  - https://segwise.ai/blog/video-ad-hooks-drive-conversions.md
  - https://www.merca20.com/la-receta-digital-para-el-exito-restaurantero-durante-las-fiestas-decembrinas
  - https://www.visitoai.com/es/customers/departamento-studio-bar

## Recursos
- **Higgsfield:** créditos casi en **cero** (6 de noviembre).
  - Costos: Kling 3.0 pro 9:16 de 5 s ≈ 7.5 créditos; voz ElevenLabs v4 muy barata; música ElevenLabs Music ≈ 0.145 créditos por segundo.
  - Para tomas nuevas hay que recargar.
- **Bloom:** Eduardo dice que 5 imágenes cuestan 51 créditos. Le alcanza para unas 3 por semana.

## Investigación de Meta Ads (6 de noviembre de 2026)
- Reporte completo: `reports/Meta Ads para NXUS AI 2026.md` (notas en `research_notes/Meta Ads para NXUS AI 2026/`).
- Lo más importante para el prompt v2:
  - Apagar cada Advantage+ creative enhancement en cada anuncio (vuelven a prenderse al duplicar), bloquear Audience Network y Threads, poner Account spending limit, apagar Business Agent de Meta para que solo conteste ManyChat.
  - Ubicación con pines por colonia (hard limit); intereses solo son sugerencia; sin filtro de idioma en MX.
  - Los videos A/B/C son un solo concepto: hacen falta cortes de 12–15 s con subtítulos y 2+ conceptos distintos (demo en pantalla, Eduardo a cámara, estático).
  - Gancho C ("esto te está costando dinero") arriesga la política de atributos personales.
  - Mandar señales a Meta: LeadSubmitted desde ManyChat solo tras el filtro; QualifiedLead/Purchase desde HQ (CAPI for Business Messaging). Un Ads Trigger por anuncio para saber qué anuncio trajo cada cita.
  - Decidir con costo por diagnóstico agendado; aceptar "Learning limited".
- Quedaron 13 preguntas abiertas para Eduardo (al final del reporte).

## Acuerdo de trabajo para los anuncios (6 de noviembre de 2026)
- Claude construye los anuncios desde cero (estrategia, estructura, segmentación, textos, configuración) y entrega el prompt para Claude in Chrome. El reporte de investigación es para que Claude lo aplique, no para Eduardo.
- Eduardo sube él mismo la foto o el video.
- Presupuesto: Claude pide autorización o usa la cifra que Eduardo diga. Nunca la decide solo.
- Zonas geográficas: las da Eduardo; Claude las configura de la mejor manera.
- Eduardo sigue "entrenando" a Claude con más contexto antes del primer anuncio. El prompt se da hasta que él diga que empecemos con el primero.

## Problema: llegan mensajes de otros negocios (6 de noviembre de 2026)
- En ManyChat llegan conversaciones de Instagram de negocios ajenos (ej. "Diablo Design", "Perritos y Gatitos Contentos") que solo traen su respuesta automática ("Gracias por contactarnos…"), como "Unassigned" con "Conversation was moved from Closed to Unassigned".
- Hipótesis principal: el anuncio de mensajes le manda el saludo de NXUS a una cuenta de negocio, su respuesta automática contesta sola y Meta lo cuenta (y cobra) como conversación; con "Maximize number of conversations" Meta aprende a buscar más cuentas así. Falta confirmarlo.
- Prompt de diagnóstico, solo lectura: `ads/prompt-chrome-analisis-v1.txt`. Eduardo lo corrió (informe PDF del 6 nov).
- **Resultado del diagnóstico (6 nov 2026):**
  - Anuncios activos "Video Rest MX 1" y "Video Rest 2 MX": objetivo Leads con "Advantage+ leads campaign", destino DM de Instagram, ~$25 USD/día cada uno (~$50/día en total, no $12). $210.35 gastados, 0 leads, 0 personas reales, ~25 respuestas automáticas de negocios (estéticas, veterinarias, dentistas, florerías…), todas "replied to an ad" de "video rest 2 MX".
  - Público Advantage+ sin intereses, edad desde 18, sin exclusiones (16.7–19.6 millones). Radios de 10 millas (16 km) en Roma, Clavería, Ecatepec, Zona Esmeralda, Ojo de Agua, Coyoacán, Lindavista, La Cúspide (+ Interlomas, Santa Fe, Roma Sur): en la práctica casi todo el Valle de México.
  - Saludo de la plantilla en inglés ("Hi [nombre]! Please let us know how we can help you."), preguntas vacías. Video de 59 s. Mejoras prendidas: Video touch-ups, Relevant comments, Enhance CTA.
  - ManyChat: Filtro NXUS se dispara con "contiene INFO" → "información" lo activa → bot contra bot.
  - Promoción de octubre (Mensajes/conversaciones): $120.55, 27 conversaciones a $4.46, solo 2–3 personas reales.
- **Reglas aprendidas (lo que NO quiere Eduardo):** público abierto a todo el mundo, edad 18, radios gigantes, saludo en inglés o preguntas vacías/por defecto, meta que cuente cualquier respuesta como resultado, "Advantage+ leads campaign", mejoras automáticas del creativo, palabra clave "contiene INFO", videos de casi 1 minuto.


## Videos a pautar (revisados el 6 nov 2026)
- Eduardo mandó AD_1, AD_2 y AD_3: son los mismos A, B y C (34, 33 y 32 s, 1080×1920, audio completo y de la misma duración que el video). Eduardo los pausa él mismo.
- Revisión: A es el mejor gancho (celular con mensajes a las 11:48 desde el segundo 0); B bien ("Este empleado nunca duerme"); C es el más débil ("¿Tienes un restaurante o una empresa?" sobre edificios: invita a cualquier negocio y "te está costando dinero" arriesga la política de atributos personales).
- Los subtítulos grandes quedan a ~72% de la altura: dentro de la zona que tapan el nombre, el texto y el botón en Reels/Stories (35% de abajo). Arreglo sin créditos: subirlos en `capa.html` y volver a armar.
- El cuerpo y el cierre dicen "para restaurantes y empresas que quieren crecer": abre la puerta a cualquier negocio.
- Recomendación dada: 1 campaña MX, 1 conjunto, los 3 videos como 3 anuncios dentro (Meta reparte solo). Pendiente: zonas exactas y presupuesto.

## En qué se quedó (lo que sigue en el chat nuevo)
Eduardo quiere un **prompt nuevo para Claude in Chrome**. Va a dar:
1. Lo que Meta hace últimamente y no le gusta.
2. Sus objetivos, lo que hay que lograr y lo que espera.

Ya se le preguntó, y está pendiente que conteste:
- Lo que Meta hace y no le gusta. Ejemplos que se le dieron: Advantage+ que cambia anuncios, música o IA automática, gasto en Audience Network, mensajes de gente fuera de zona.
- Su meta: conversaciones, citas o clientes, y cuántos al mes.
- Presupuesto en MX y USA, y cuánto acepta pagar por conversación o por cita.
- En qué estado están las campañas: creadas, publicadas y con qué resultados.
- Cuánta libertad le da a la extensión. Recomendación: que se detenga antes de publicar o gastar.

Con eso se arma el **prompt v2**: incorporar sus quejas como reglas, sus zonas en Locations, los nombres de los anuncios al día y una revisión de la configuración actual antes de crear algo.
