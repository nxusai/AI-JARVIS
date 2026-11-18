# El CRM para el chat de anuncios de Mi Semago

Para el chat que lleva **solo los anuncios de Mi Semago**. Aquí está todo lo del
Centro de trabajo (el CRM) que tiene que ver con los anuncios: por dónde entra
un lead, dónde cae, cómo se sabe de qué anuncio vino, quién le llama y cómo se mide.
**Ese chat solo cambia del CRM lo que sirve a los anuncios** (lo de esta guía). Lo
demás del CRM (tareas, parrilla, biblioteca, fiesta, usuarios, Ultron, diseño) se
hace en el chat del CRM. Si un cambio de anuncios necesita tocar algo de eso, se
anota y se le pide a Eduardo que lo lleve al chat del CRM.

Leer también, en este orden: `CLAUDE.md` (reglas y qué hacer después de cada
cambio), `docs/lecciones-anuncios-mensajes.md`, `docs/estado-ana-sofi.md` (sección
"Anuncios de Mi Semago"), `docs/estado-crm.md` (sección Leads) y
`docs/cerebro-cliente.md` (punto 6, la línea de ventas en el cerebro).

---

## 1. El camino de un lead, de punta a punta

```
Anuncio de Meta (Click-to-WhatsApp)                  misemago.com (formulario "Cotizar")
  └ mensaje prellenado distinto por anuncio            └ casilla "Quiero que me llamen" (permiso por escrito)
WhatsApp +1 484-969-8507 (ManyChat, página Mi Semago)
  └ disparador de frase EXACTA → guarda "MS Fuente"
  └ chat corto: idioma, nombre, negocio y ciudad, ¿te llamamos?
  └ External Request → crm/netlify/functions/manychat.mjs     crm/netlify/functions/leads.mjs
                               \                                   /
                                tabla `leads` (Supabase del CRM) ←
                                        │  etapa "nuevo" si dio permiso
                                        ▼
            Ana Sofi en el CEREBRO (Mac mini del cliente, bridge/nucleo/ventas.mjs)
              llama al momento, califica, da precios, agenda Google Meet
                                        ▼
            Centro de trabajo → Leads (ficha con "De qué anuncio", llamada, Meet, notas)
```

### Piezas y dónde viven
| Pieza | Archivo / lugar | Quién lo publica |
|---|---|---|
| Campaña, imágenes, prompts de Claude in Chrome | `docs/ads/mi-semago-distribuidores-oeste/` | Eduardo en Meta Ads Manager |
| ManyChat (disparadores, flujo, External Request) | En ManyChat; prompts en `docs/manychat-misemago-construccion.md` y `docs/ads/mi-semago-distribuidores-oeste/PROMPT-claude-in-chrome.md` | Eduardo (Claude in Chrome, perfil "Mi Semago") |
| Puerta de ManyChat → CRM | `crm/netlify/functions/manychat.mjs` | Netlify, solo |
| Puerta del formulario de misemago.com → CRM | `crm/netlify/functions/leads.mjs` | Netlify, solo |
| Tablas `leads`, `leads_notas`, `website_leads` | `crm/supabase/esquema.sql` | Eduardo corre el SQL en Supabase |
| Vista Leads y Website leads en la página | `crm/public/app.js` (`vistaLeads`, `vistaLeadsMovil`, `abrirLead`, `tarjetaLead`, `vistaWeb`), `crm/public/estilo.css`, muestra en `crm/public/datos-muestra.js` | Netlify, solo |
| Ana Sofi (llama, califica, agenda) | **Cerebro**: `bridge/nucleo/ventas.mjs` (+ `bridge/nucleo/anasofi.mjs`, `bridge/cerebro/*`) | Eduardo: zip + `node scripts/cerebro.mjs enviar mi-semago` |
| Agenda del Meet | Apps Script `bridge/cerebro/calendario-google.gs` (cuenta NXUS de Eduardo) | Eduardo en script.google.com |
| Llamadas a Eduardo (Meet nuevo, mañana, 1 h antes) | NEX en su Mac (`bridge/ventas.mjs`) | Zip + reiniciar NEX |

---

## 2. Cómo se sabe de qué anuncio vino (la atribución)

1. Cada anuncio tiene su **mensaje prellenado distinto** (Meta → anuncio → Message template):
   - Capacidad 500k lb → "Hola, quiero precios para producción por volumen."
   - Tu marca → "Hola, quiero precios de quesos con mi marca."
   - Logística 40°F → "Hola, quiero precios con envío refrigerado."
   - Carrusel planta real → "Hola, quiero precios para distribuir sus quesos."
2. En ManyChat, cada frase dispara una automatización **"MS Ads · …"** con regla **"Message is"** (frase EXACTA; nunca "contains"), con variantes sin punto y sin acentos. Cada una guarda el campo **MS Fuente** ("Anuncio · Capacidad", "Anuncio · Tu marca", "Anuncio · Logística", "Anuncio · Carrusel") y arranca el flujo **"Mi Semago · Chat corto (Centro de trabajo)"**. Los posts usan "INFO" → "Orgánico · INFO". La automatización vieja con "contains" está **apagada** (contestaba a robots de otros negocios: ver `lecciones-anuncios-mensajes.md`).
3. Las dos External Request del flujo (español e inglés) mandan `"fuente": "{{MS Fuente}}"`.
4. `manychat.mjs` lo guarda en **`leads.fuente`** (texto, hasta 120). En la ficha del lead sale como **"De qué anuncio"**. Si un lead vuelve a escribir, un campo vacío no borra lo que ya había.
5. Los de misemago.com llegan con `origen = 'web'` (etiqueta 🌐 Web) y su solicitud queda también en `website_leads` (pestaña WEBSITE LEADS, con `lead_id` al lead).

**Para un anuncio nuevo:** mensaje prellenado único → automatización "MS Ads · <nombre>" con "Message is" (más variantes sin punto/acentos) → MS Fuente = "Anuncio · <nombre>". No hace falta tocar el CRM: `fuente` acepta cualquier texto.

---

## 3. La puerta `manychat.mjs` (lo que recibe)

- `POST https://centro-misemago-abuelito.netlify.app/.netlify/functions/manychat`
- Encabezado **`x-manychat-clave`** = variable `MANYCHAT_CLAVE` de Netlify (se compara en tiempo constante; mínimo 20 caracteres). Nunca pedirla ni pegarla en el chat.
- Cuerpo JSON: `contacto_id` (obligatorio), `nombre`, `negocio_ciudad` (se separa en negocio y ciudad: "X en Houston", "X - Houston", "X, Houston"), o `negocio` y `ciudad`, `telefono`, `hora`, `permiso` ("Sí, llámenme"/"Yes…" o `true`), `idioma` ("es"/"en"), `fuente`.
- Lo que hace: lead nuevo con permiso → etapa **nuevo**; sin permiso → **no_llamar** con nota. Si ya existía, actualiza (lo vacío no borra) y, si vuelve a pedir llamada y estaba en hablo/no_contesto/cerrado/no_califica/no_llamar, regresa a **nuevo**. Si la columna `fuente` aún no existiera, guarda sin ella (nunca se pierde un lead).
- Variables de ManyChat sin reemplazar (`{{cuf_123}}`) cuentan como vacías.

## 4. La tabla `leads` (Supabase del CRM)

Columnas: `id, manychat_id, origen ('manychat'|'web'), nombre, negocio, ciudad, telefono, correo, idioma, hora_pedida, zona, permiso_llamada, permiso_fecha, permiso_texto, etapa, calificacion (caliente/medio/frio), tipo_negocio, quesos, libras, frecuencia, marca_propia, precios, resumen, transcripcion, llamada_programada, intentos, ultima_llamada, llamada_estado (marcando/en_llamada/no_salio), llamada_id, meet_inicio, meet_link, meet_evento, fuente, creado, actualizado`. Notas en `leads_notas` (autor_nombre "Ana Sofi", "WhatsApp" o la persona).

Etapas: `nuevo` → `programada` → `no_contesto` → `hablo` → `meet` → `cerrado`, más `no_califica` y `no_llamar`.

Permisos (RLS): ven Leads el admin y quien tenga **"Ve Leads"** en Usuarios (Senen). **Solo Eduardo** (`es_dueno`) cambia etapa o borra; los demás agregan notas. Las vendedoras no entran al CRM. El cerebro escribe con la llave de servicio (escrita en el Mac mini con `llaves.mjs`).

## 5. Ana Sofi y la línea de ventas (en el cerebro)

- Corre en el **Mac mini** (`bridge/nucleo/ventas.mjs`), no en la Mac de Eduardo. Toma los leads `nuevo` con permiso con un cambio atómico (nuevo → programada) para no llamar dos veces; llama **al momento** con 3 horarios de Meet; un reintento; agenda el Meet con el Apps Script del calendario; "llámame después" se vuelve fecha con Claude. Solo números de EE. UU.; la IA nunca inventa un número.
- **Nunca el nombre de Eduardo** ante el lead: "nuestro encargado de ventas".
- NEX (Mac de Eduardo) ya no llama a leads: solo le llama a Eduardo (Meet nuevo, la mañana del día del Meet, 1 hora antes).
- Revisar: `cd ~/Desktop/nexy && node scripts/cerebro.mjs estado` (último latido: ahora, Sello ✅, "prendida" en cada IA).
- Falta en el cerebro: cambios o cancelaciones que pide el lead por WhatsApp o por llamada entrante (quedan como nota).

## 6. Cómo medir los anuncios con el CRM

- **Centro de trabajo → Leads**: cada ficha dice "De qué anuncio", la calificación de Ana Sofi, si hubo Meet y el resumen de la llamada. Juzgar por **leads calificados y Meets**, no por costo por mensaje.
- Desde el chat se puede leer sin pedir nada a Eduardo: la página publicada (`curl` a `https://centro-misemago-abuelito.netlify.app/app.js`) y si una columna o función existe en Supabase (ver "Antes de pedirle algo a Eduardo" en `docs/estado-crm.md`). Los datos de los leads **no** se leen desde aquí (RLS): se le piden a Eduardo (captura de Leads) o los cuenta Ultron en el Centro de trabajo ("Ultron, ¿cuántos leads llegaron del anuncio Tu marca?" usa su herramienta `leads`).
- Fase 2 pendiente: mandar a Meta la señal de "lead bueno" cuando la persona terminó el filtro (ManyChat → Ads Optimization / Conversions API). Si se hace desde el CRM, sería una función nueva en `crm/netlify/functions/` disparada al pasar a `hablo`/`meet`.

## 7. Qué puede cambiar el chat de anuncios en el CRM, y qué no

**Sí (solo si sirve a los anuncios):** `manychat.mjs`, `leads.mjs`, columnas nuevas de `leads`/`website_leads` (por ejemplo campos de UTM o de campaña), la vista Leads y Website leads (`vistaLeads`, `vistaLeadsMovil`, `abrirLead`, `tarjetaLead`, `vistaWeb`, sus estilos y su muestra en `datos-muestra.js`), y la línea de ventas del cerebro (`bridge/nucleo/ventas.mjs`) si el cambio es por los anuncios.

**No (eso es del chat del CRM):** tareas y hojas, parrilla, biblioteca, catálogos, fiesta, usuarios y accesos, correos (`correo.mjs`, `accesos.gs`), Ultron (`ultron.js`, `ultron-vivo.mjs`, `scripts/ultron-voz.mjs`, sus herramientas en `app.js`), el diseño general (fondo, vidrio, iPhone: barra de abajo, menú) y `acceso.js` (nunca cambiarlo: rompe las contraseñas).

**Cuidado al tocar `app.js` y `estilo.css`:** los comparten los dos chats. Cambios chicos y en las funciones de Leads/Website leads; no reacomodar lo demás. En celular la página es otra experiencia (barra de abajo, `esMovil()`, `vistaLeadsMovil`); cualquier cambio a Leads debe verse bien en los dos (probar con la muestra: `node scripts/crm-muestra.mjs <salida.html>` y Playwright con `devices['iPhone 15 Pro']`).

**Esquema:** cambios con `add column if not exists` / `create or replace`, que se puedan correr de nuevo sin romper nada; a Eduardo se le da **solo el bloque SQL nuevo** para Supabase → SQL Editor → New query → Run (https://supabase.com/dashboard/project/viqvpjhjerihnqzjjppb/sql/new), y además se deja en `crm/supabase/esquema.sql`.

## 8. Después de cada cambio, qué le toca a Eduardo

| Lo que cambió | Qué hace Eduardo |
|---|---|
| `crm/public`, `crm/netlify` | Nada: Netlify lo publica solo desde `claude/jarvis-project-setup-gs6uu2` |
| `crm/supabase/esquema.sql` | Correr el bloque SQL nuevo en Supabase (darle el bloque exacto) |
| `bridge/nucleo/*`, `bridge/cerebro/*` (Ana Sofi, ventas) | Zip + `cd ~/Desktop/nexy && node scripts/cerebro.mjs enviar mi-semago` ("✅ Cerebro instalado"). Antes: `node scripts/nucleo.mjs` (sin "nexy", "nex", "jarvis", "nxus", "ramos & co", "contacto@") |
| Solo NEX (`bridge/*.mjs` fuera de nucleo/cerebro, `scripts/`) | Zip + reiniciar NEX (Ctrl + C, `npm start`) |
| ManyChat o Meta | Prompt para Claude in Chrome: primero informe ✅/⚠️/❌ solo mirando; nunca publicar ni tocar pagos sin su frase clara de autorización |

El zip y el comando para actualizar NEX están en `CLAUDE.md` (darlos completos cada vez).

## 9. Datos fijos
- Centro de trabajo: https://centro-misemago-abuelito.netlify.app (Netlify, proyecto centro-misemago-abuelito, base `crm`, rama `claude/jarvis-project-setup-gs6uu2`).
- Supabase del CRM: proyecto `viqvpjhjerihnqzjjppb`.
- WhatsApp de los anuncios: +1 484-969-8507 (ManyChat, página Mi Semago). Número de Ana Sofi: +1 973-750-4108.
- Campaña de prueba: "Mi Semago · Distribuidores Oeste · WhatsApp · Prueba 7 días" ($25/día, tope $175, 9 al 16 de nov de 2026; 4 anuncios). Lecciones: campaña manual, presupuesto en el conjunto, público con límites fijos (30–65, sin intereses, códigos postales de bodegas y mayoreo del oeste + Chicago), ubicaciones manuales, mejoras de IA apagadas.
- Pedido mínimo: 1,500 lb. Precios de lista: en las instrucciones del agente de Ana Sofi en ElevenLabs (texto fuente `SALIDA_PROMPT` en `bridge/ventas.mjs`, que se aplica con `node scripts/ana-sofi.mjs instrucciones`).
