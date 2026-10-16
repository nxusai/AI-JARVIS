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
| **All you can beer** | El camino del brindis: tarro que se llena con el scroll y las 6 bebidas del paquete |
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

## Publicarlo y conectar el dominio `aureliusmx.com` (Squarespace)

### 1. Publicar en Vercel (gratis)

1. Entra a <https://vercel.com> e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New… → Project** e importa el repositorio **`nxusai/ai-jarvis`**.
3. En **Root Directory**, haz clic en *Edit* y elige **`aurelius-web`**. Vercel detecta Vite solo.
4. Haz clic en **Deploy**. En un minuto tendrás una URL tipo `aurelius-xxxx.vercel.app`. Ábrela en tu celular y revísala.
   (Vercel publica la rama principal. Si el sitio aún vive en la rama `claude/gallant-dijkstra-0ntsat`, cámbiala en **Settings → Git → Production Branch** o une la rama a `main`.)

### 2. Agregar el dominio en Vercel

1. En tu proyecto de Vercel ve a **Settings → Domains**.
2. Escribe `aureliusmx.com` y dale **Add**. Acepta también agregar `www.aureliusmx.com` (Vercel lo ofrece solo y redirige uno al otro).
3. Vercel te mostrará los registros DNS que necesita. Normalmente son:

| Tipo | Host | Valor |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Si Vercel te muestra otros valores, usa **los que te muestre Vercel**.

### 3. Poner los registros en Squarespace

1. Entra a <https://account.squarespace.com/domains> y haz clic en **aureliusmx.com**.
2. Ve a **DNS** → **DNS Settings**.
3. En **Squarespace Defaults** (o **Google Workspace / Squarespace presets**), **borra** los registros A y CNAME de `@` y `www` que apuntan a Squarespace. Si no los borras, chocan con los de Vercel.
   No borres los registros MX si usas correo con ese dominio.
4. En **Custom Records**, haz clic en **Add record**:
   - Tipo **A**, Host `@`, Data `76.76.21.21`
   - Tipo **CNAME**, Host `www`, Data `cname.vercel-dns.com`
5. Guarda. En 5 minutos a unas horas, Vercel marcará el dominio como ✅ **Valid** y activará el candado HTTPS solo.

**Netlify** también funciona: ya incluye `netlify.toml`. Usa *Base directory* = `aurelius-web`.

## Conectar la IA al Oráculo (después)

En `src/data.js`, pon la URL de tu backend en `site.ai.endpoint`. El Oráculo enviará:

```json
POST { "messages": [{ "role": "user", "content": "¿a qué hora abren?" }] }
```

y espera de respuesta `{ "reply": "texto" }`. Si la IA falla, regresa solo a las respuestas por reglas.
Desde código también puedes usar `window.AureliusOracle.open()` y `window.AureliusOracle.ask("…")`.

## Fotos provisionales

Las fotos de la Ruta de la Conquista (tacos, quesadillas, flautas, pozole, alitas, burger, nachos)
y la michelada del brindis son **imágenes ilustrativas** de Wikimedia Commons con licencia libre.
Llevan la etiqueta «Imagen ilustrativa» y sus créditos aparecen en el pie de página.

Para poner tus fotos: reemplaza el archivo en `public/img/menu/` con el mismo nombre
(`tacos.webp`, `quesadillas.webp`, `flautas.webp`, `pozole.webp`, `alitas.webp`, `burger.webp`,
`snacks.webp`, `michelada.webp`). Luego borra su crédito en `photoCredits` de `src/data.js`.
Si ya todas son tuyas, quita también `<figcaption>Imagen ilustrativa</figcaption>` en
`src/main.js` e `index.html`.

## Pendientes

- [ ] **All you can beer**: la página 4 del menú es una imagen que no se pudo leer. El sitio lista las 6 bebidas de «El camino del brindis» y dice «Aplican términos y condiciones», sin precio (como pediste). Si quieres poner las condiciones, van en `src/data.js` → `brindis`.
- [ ] **Facebook**: no encontré la cuenta. Pega el link en `site.facebook` y aparece solo.
- [ ] **Salsas**: el selector «Choose your fire» usa niveles genéricos (sin picante → nivel infierno).
- [ ] **Fotos propias** de cada platillo y un video vertical del local para la portada.
- [ ] **Países**: Italia está marcado como «En campaña» y los demás como «Próximamente». Se ajusta en `conquests`.
