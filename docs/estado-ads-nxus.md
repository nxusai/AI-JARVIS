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
    2. `node capa.js A`: gráficos animados.
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
