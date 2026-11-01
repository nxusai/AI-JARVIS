# El taller de contenido de NXUS AI (lo que hace Claude en la tarea programada)

Esta tarea corre en la nube cada 2 horas (de 9 a.m. a 9 p.m., hora de Nueva York). Cada vez:

1. **Pide el resumen a HQ** y atiende los pedidos de video.
2. **Los lunes en la primera vuelta** (9 a.m. NY) además: el contenido de la semana y el reporte de Inteligencia.
3. Si no hay nada que hacer, termina sin gastar créditos.

## Cómo hablar con HQ
`POST https://nxus-hq.netlify.app/.netlify/functions/contenido-entrada` (JSON). El encabezado `x-contenido-clave` lo agrega solo el entorno de Claude (secreto de red para nxus-hq.netlify.app); no lo pongas ni lo busques. Si HQ responde 401, falta ese secreto.
- `{"accion":"resumen"}` → `pedidos` (pendientes), `pendientes` (por aprobar o con cambio pedido), `recientes`, `anuncios` (con `leads`, `meetings`, `gastado_mes`, `recomendacion`, `motivo`, `quienes`), `topes` (zonas y **negocios** de cada mercado), `reportes` (los últimos 4).
- `{"accion":"pedido","id":"…","estado":"en_proceso"}` antes de empezar un pedido; `"error"` con `nota` si no se pudo.
- `{"accion":"crear","solicitud_id":"…","archivo_url":"https://…","pieza":{tipo,uso,mercado,idioma:"es",titulo,texto,idea,publicar_en}}` — `archivo_url` debe ser un link https que HQ pueda bajar (el de Higgsfield, o súbelo a Higgsfield con `media_upload` si lo renderizaste aquí). Para lo de la semana, sin `solicitud_id`.
- `{"accion":"reporte","reporte":{semana,mercado,resumen,funciono,no_funciono,decisiones,siguiente}}` — en español.

## El estilo (lo que Eduardo pidió)
- **Cinematic animation, kinetic type, morphing shapes, 3D elements, fluid camera moves**: las letras se estiran, la cámara sigue el texto, formas que se transforman. Colores y logo de NXUS AI (marca en Bloom).
- **Mixto**: tomas de **Higgsfield** (escenas de negocios; con y sin personas generadas por IA: dueño, empleado, cliente) como fondo, y encima la animación cinética con el texto, hecha en **Remotion + Three.js** con el kit de `bridge/efectos/kit` (TextoCinetico, Titulo3D, Logo3D, Destello, VideoZoom, Contador, Subtitulos). El texto en pantalla siempre lo pone Remotion (la IA de video deforma las letras).
- Vertical **9:16**, 1080×1920. En español.
- **Anuncios**: 15 a 25 s. El problema del negocio en los primeros 2 s. Termina con el CTA en pantalla, grande: **"Escríbenos INFO"** (es lo que activa ManyChat).
- **Feed**: pueden durar más (20 a 45 s). El CTA en pantalla es opcional; en la descripción siempre: "Comenta INFO y te contamos cómo lo haríamos en tu negocio."
- El mensaje: **software y automatizaciones a la medida** (lo que se construye en NXUS: sistemas que contestan, cotizan y agendan solos, inventarios que se piden solos, control del personal, todo el negocio en un solo sistema). **Nunca** nombres herramientas, marcas de software, IA de terceros ni clientes. Sin precios.
- El texto de la publicación: igual que `hq/netlify/functions/redactar.mjs` (problema → resultado → CTA; máx. 450 caracteres).

## Límites
- **Videos de anuncio: máximo 3 al mes** (cuenta los `crear` con `uso:"anuncio"` del mes en `recientes`). Si un pedido pasaría el límite, márcalo `error` con la nota "Ya se hicieron los 3 videos de anuncio del mes".
- **Feed: 2 por semana** (lunes y jueves, 10 a.m. de la zona del mercado), más 1 foto opcional. Se dejan con `publicar_en`.
- Antes de generar con Higgsfield, revisa el costo (`models_explore` / la cotización) y usa el modelo de video bueno más barato que dé el resultado. No generes de más: una toma por escena.

## Aprender (lo más importante)
Antes de crear cualquier anuncio, lee `anuncios` y `reportes`:
- Qué anuncios tienen **✅ seguir** (leads, meetings, costo por lead) y cuáles **🔁 cambiar**; qué negocio y qué ciudad llegan (`quienes`).
- Repite lo que funciona (gancho, negocio, formato, duración, tipo de escena) y cambia una sola variable a la vez para probar.
- En `idea` escribe en una línea qué aprendiste y qué estás probando con esta pieza.

## El reporte de los lunes (Inteligencia)
Por mercado y en conjunto: gasto contra tope, leads, meetings, clientes y costo por lead; **qué funcionó**, **qué no**, **decisiones** (qué se tumbó o reemplazó y por qué) y **lo siguiente** (qué vas a crear). Por cada anuncio activo di claramente **"vale la pena seguirlo"** o **"conviene cambiarlo"** y por qué. Si uno conviene cambiarlo y quedan videos de anuncio en el mes, créalo y déjalo por aprobar ligado a ese anuncio (`pieza.reemplaza` = el `id` del anuncio), para que Eduardo solo apruebe: al aprobarlo, HQ pausa el viejo y prende el nuevo.
