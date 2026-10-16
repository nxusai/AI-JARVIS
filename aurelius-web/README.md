# Aurelius · La conquista del come todo

Sitio web de **Aurelius Coacalco**: el come todo de $259.
Una sola página con animaciones (GSAP + Lenis), pensada para celular y computadora.

## Qué tiene el sitio

| Sección | Qué hace |
|---|---|
| **Pantalla de carga** | Laurel que se dibuja y frases chistosas («Convenciendo al pollo…») |
| **Hero** | «No vienes a comer. Vienes a conquistar.» Brasas animadas, logo que sigue al mouse y moneda giratoria de $259 |
| **Marquesinas** | Sabor · Poder · Gloria. Aceleran cuando haces scroll |
| **Manifiesto** | El texto se enciende palabra por palabra al bajar. Contadores animados |
| **La conquista en tres actos** | Cómo funciona el come todo. Tarjetas con inclinación 3D |
| **La ruta de la conquista** | Las 7 «provincias» del come todo. En computadora se recorren con scroll horizontal y un mapa de progreso |
| **Choose your fire** | Selector de picante: Plebeyo → Emperador. La flama crece |
| **El coliseo** | Juego: tocas lo que comerías y te da un rango (Turista → César → Leyenda inmortal). Se comparte por WhatsApp |
| **Próximas conquistas** | Italia, Corea, Japón y EE. UU. Cada voto llega a tu WhatsApp |
| **Historia** | La historia del fundador y Marco Aurelio, con la estatua y un efecto de rayo |
| **Misión, visión y valores** | Tres tablas de mármol |
| **El templo** | Galería arrastrable con fotos del local y platillos, y lightbox |
| **A domicilio** | Carta con descripciones chistosas, **sin precios**, y pedido por WhatsApp |
| **Las leyes del imperio** | Preguntas frecuentes |
| **Ubicación** | Mapa, horario, indicador «Abierto ahora / Cerrado» en hora de CDMX, Google Maps, Waze y llamada |
| **Únete a la legión** | Bolsa de trabajo por WhatsApp |
| **El Oráculo** | Chat flotante: **la entrada para la IA**. Hoy responde con reglas; ya está listo para conectarle una IA |
| **Barra móvil** | En celular: Cómo llegar · $259 · WhatsApp, siempre a la mano |

También incluye: SEO para Google (datos estructurados de restaurante), imagen para compartir en
redes, favicon, accesibilidad (teclado y modo «reducir movimiento») e imágenes optimizadas en WebP.

## Cambiar textos, horarios, menú, etc.

Casi todo vive en **`src/data.js`**: teléfono, dirección, horario, precio, menú del come todo,
niveles de picante, rangos del juego, países, preguntas frecuentes, galería y carta.
Lo marcado con `CONFIRMAR` es provisional.

Las fotos están en `public/img/`. Para cambiar una, reemplaza el archivo con el mismo nombre.

## Correrlo en tu computadora

```bash
cd aurelius-web
npm install
npm run dev      # abre http://localhost:5173
npm run build    # genera la versión final en dist/
```

## Publicarlo y conectar el dominio (paso a paso)

Recomendación: **Vercel**. Es gratis, rápido y tiene HTTPS automático.

1. Entra a <https://vercel.com> e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New… → Project** e importa el repositorio **`nxusai/ai-jarvis`**.
3. En **Root Directory**, haz clic en *Edit* y elige **`aurelius-web`**. Vercel detecta Vite solo.
4. En **Branch**, usa `claude/gallant-dijkstra-0ntsat`, o la rama `main` cuando la unas.
5. Haz clic en **Deploy**. En un minuto tendrás una URL tipo `aurelius-xxxx.vercel.app`. Revísala desde tu celular.
6. Para el dominio, ve a **Settings → Domains → Add** y escribe tu dominio (ej. `aurelius.mx` y `www.aurelius.mx`).
7. Vercel te dirá qué registros DNS poner. En el panel de tu dominio (GoDaddy, Namecheap, Hostinger, etc.):
   - Registro **A** para `@` → `76.76.21.21`
   - Registro **CNAME** para `www` → `cname.vercel-dns.com`

   Usa los valores exactos que te muestre Vercel si son distintos.
8. Espera de 5 minutos a 1 hora. Vercel activa el candado HTTPS solo.

> Si tu dominio **no** es `www.aurelius.mx`, reemplaza esa dirección en `index.html`
> (canonical y og:url/og:image), `public/robots.txt`, `public/sitemap.xml` y en
> `jsonLd()` de `src/main.js`.

**Netlify** también funciona: ya incluye `netlify.toml`. Usa *Base directory* = `aurelius-web`.

## Conectar la IA al Oráculo (después)

En `src/data.js`, pon la URL de tu backend en `site.ai.endpoint`. El Oráculo enviará:

```json
POST { "messages": [{ "role": "user", "content": "¿a qué hora abren?" }] }
```

y espera de respuesta `{ "reply": "texto" }`. Si la IA falla, regresa solo a las respuestas por reglas.
Desde código también puedes usar `window.AureliusOracle.open()` y `window.AureliusOracle.ask("…")`.

## Pendientes por confirmar

- [ ] **Horario**: lo tomé de publicaciones en TikTok (dom–jue 2–10 pm, vie–sáb 2 pm–12 am).
- [ ] **Dirección exacta**: puse la de Google Maps («Plaza Allende, C. Ignacio Allende 20-A N. 2, Zacuauhtitla»). En TikTok aparece «Allende 10C».
- [ ] **Dominio**: el sitio asume `www.aurelius.mx`.
- [ ] **Facebook y TikTok**: no encontré las cuentas. Pega los links en `site.facebook` / `site.tiktok` y aparecen solos.
- [ ] **Salsas**: el selector «Choose your fire» usa niveles genéricos. Si me pasas la lista real de salsas, pongo sus nombres.
- [ ] **Bebidas**: no sé si el come todo las incluye, así que el sitio no lo menciona.
- [ ] **Fotos de comida**: solo tengo tostada de pata y enchiladas. Con fotos de tacos, alitas, burgers y pozole el sitio sube de nivel; cada provincia de la ruta puede llevar su foto.
- [ ] **Video**: un clip vertical de 10–15 s del local o del trompo se puede poner de fondo en el hero.
- [ ] **Países**: Italia está marcado como «En campaña» y los demás como «Próximamente». Ajusta en `conquests`.
