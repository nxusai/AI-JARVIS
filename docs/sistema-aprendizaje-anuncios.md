# Sistema de aprendizaje de anuncios (para copiarlo a un cliente)

Así quedó armado para NXUS (nov 2026). Este documento es la receta para montar lo MISMO para un cliente, adaptándolo
a su sistema (su CRM / centro de trabajo, su ManyChat, su cuenta de anuncios). Lo que se ve en HQ de NXUS es la
referencia: `hq/` en este repo.

## La idea en una frase
Los anuncios se miden hasta la venta (no hasta el mensaje), cada semana se guarda una foto de los números, la IA escribe
lo aprendido en un lugar fijo, y antes de cada ronda nueva se lee todo eso para hacer mejores anuncios.

## Los 3 "cerebros"
1. **La IA de Meta**: aprende a quién mostrar el anuncio. Se le ayuda con buenos creativos y, cuando haya ~10 citas,
   mandándole el evento "agendó/cliente" (Conversions API).
2. **El panel del sistema del cliente**: junta Meta (gastado, vistas, gancho 3 s, chats) con el CRM (persona real,
   llamada, cita, asistió, cliente) POR ANUNCIO. Solo mide.
3. **La memoria escrita**: aprendizajes con fecha y fuente, en el sistema del cliente (pestaña Aprendizajes) y en el
   repo (archivo de aprendizajes). Es lo que lee cualquier chat antes de proponer anuncios.

## Piezas a montar (en orden)
1. **Llave de Meta de solo lectura**: usuario de sistema propio del cliente ("<Cliente> lectura", Employee, cuenta de
   anuncios con solo "View performance"), token sin caducidad con `ads_read`. El token lo copia y pega Eduardo en
   Netlify; nunca pasa por un chat. Prompt de referencia: `ads/prompt-chrome-meta-token.txt`.
2. **Función de lectura** (referencia `hq/netlify/lib/meta.mjs` y `functions/anuncios.mjs`): insights por anuncio
   (desde el inicio, 7 días, diario 30 días) y estado de cada anuncio (también pausados: pasan a Historial).
3. **Fuente por anuncio**: en ManyChat, una automatización de entrada por anuncio (disparador "User clicks a Facebook
   Ad") que guarda `fuente = "Anuncio <MERCADO> R<ronda> · Video <letra>"` y luego manda al flujo principal. El CRM
   guarda esa fuente en el lead. Así se sabe qué anuncio trajo cada cita. Referencia: `hq/public/anuncios-claves.js`.
4. **Nombres que el panel entiende**: campaña `<CLIENTE> | <MERCADO> | R<n> | <objetivo>`, anuncio
   `<MERCADO> | <letra> | <de qué trata>`. Las letras se repiten cada ronda; la ronda (R#) las distingue.
5. **Panel** (referencia `hq/public/anuncios.js`): pestañas Activos / Historial (por mes, "Semana por semana") /
   Aprendizajes ("Dónde se pierden las ventas" + ficha de cada video + aprendizajes por grupo). Consejo por anuncio:
   aprendiendo <7 días, gasta ≥3× el objetivo sin citas, frecuencia ≥3, gancho <15 %, ganador.
6. **Foto semanal** (referencia `hq/netlify/lib/semana.mjs`, `functions/anuncios-semana.mjs`, tabla
   `anuncios_semanas` en `hq/supabase/esquema.sql`): cada lunes guarda por anuncio Meta + embudo del CRM.
7. **Aprendizajes** (tabla `anuncios_aprendizajes`, única por título; tipos regla / ronda / semana / hipótesis /
   competencia; estados confirmado / pendiente / descartado / recomendación).
8. **Acceso para el reporte** (referencia `hq/netlify/functions/anuncios-reporte.mjs`): GET = números, POST = foto,
   PUT = guardar aprendizajes. Protegido con una clave en Netlify (`REPORTE_CLAVE` o la del cliente) que Eduardo crea en
   su Terminal; la sesión en la nube la recibe por el formulario seguro de credenciales (encabezado X-Reporte-Key),
   nunca en el chat. `?estados=1` lee el estado de todas las campañas/conjuntos y el gasto de 7 días (para revisar
   antes de prender).
9. **Reporte automático de los lunes**: tarea programada en la nube que lee el acceso, compara con lo aprendido, escribe
   "Semana del…" en el repo y en el sistema, y avisa a Eduardo. SOLO recomienda: nunca cambia campañas.
10. **Archivos de memoria en el repo** (por cliente): aprendizajes, estrategia vigente, lecciones antibots, estado.

## Proceso de cada ronda
1. Leer lo aprendido + números en vivo. Investigar si Meta cambió reglas o algoritmo. Revisar competencia en la
   Biblioteca de Anuncios con la extensión (solo lectura; ⭐ = activo más de 30 días). Analizar a fondo cualquier
   anuncio que ya haya traído clientes.
2. Ideas por PROBLEMA (no por giro). 3 ideas × (video + imagen) = 6 anuncios por conjunto con $20/día.
   Video corto (10–16 s), pregunta grande desde el segundo 0, subtítulos dentro de la zona segura.
3. Reglas de Meta: prometer lo que se entrega ("funcionando en X días", "diagnóstico gratis" si es cierto), nunca
   resultados ("más ventas", "garantizado"); preguntar por el negocio, no decirle cosas a la persona; nada de urgencia
   falsa ("cupos limitados" solo si es real). Créditos y otros giros regulados: revisar categoría especial y leyendas.
4. Antibots: campaña manual, público con límites (edad mínima fija), ubicaciones manuales (sin in-stream ni Audience
   Network), todas las mejoras Advantage+ apagadas, saludo de ManyChat con botones, palabra exacta, nunca "contiene".
5. Formatos: video 9:16 NO entra en Instagram Feed (quitar IG Feed/Profile feed o hacer versión 4:5). Imágenes 4:5.
6. Con la extensión: primero ManyChat (copias de entrada con su fuente, disparadores con nombre claro), luego la
   campaña en borrador. "Review and publish" publica TODOS los borradores de la cuenta: no pausar ni publicar en otra
   pestaña mientras la extensión arma algo. Revisar la lista antes de publicar. Verificar en Meta (lectura) antes de
   prender. Prueba de punta a punta con el celular (anuncio → chat → CRM → llamada/cita).
6b. ManyChat (aprendido en la ronda 2 de NXUS, 18–19 nov 2026):
   - Ligar cada anuncio a su automatización SOLO cuando ya está LIVE con el disparador "User clicks a Facebook Ad"
     encendido; si se liga en borrador, Meta muestra el saludo pero ManyChat no reconoce el anuncio (0 ejecuciones,
     leads sin fuente). Arreglo: volver a elegir la automatización en cada anuncio y publicar.
   - Filtro CORTO (5 pasos, ~2 min): sucursales con botones → nombre → negocio y a qué se dedica → teléfono a 10
     dígitos (el país lo pone la entrada del anuncio) → correo escrito (tipo Email) con confirmación "¿Está bien
     escrito?" → permiso de llamada. El filtro largo (12 preguntas + IA, 8–12 min) hacía que la gente se fuera en
     los primeros 4 minutos. El correo se pide ESCRITO, no por voz (la IA de voz lo capta mal); el sistema lo limpia
     y corrige errores de dedo comunes (ver `hq/netlify/functions/manychat.mjs`, función correo).
   - "Respuesta por defecto": preguntar directo con botones y arrancar el filtro, sin un botón intermedio.
7. 7 días sin tocar. Medir por costo por cita y por cliente. Cerrar la ronda con foto y aprendizaje escrito; pausar
   (nunca borrar) lo viejo cuando lo nuevo esté aprobado.

## Reglas de trabajo
- Nunca pedir ni pegar llaves, tokens o contraseñas en el chat. La extensión nunca lee un token.
- El sistema solo LEE Meta. Prender, pausar y publicar lo hace Eduardo (o la extensión con su permiso explícito).
- Sin datos personales de leads en el repo ni en los aprendizajes.
- No inventar estadísticas: si un dato no está, se dice que falta.
- Si el sistema del cliente vive en su "cerebro" (Mac mini), respetar sus reglas: nada de NXUS/NEX dentro del núcleo y
  todo cambio firmado por la puerta (`scripts/cerebro.mjs`).
