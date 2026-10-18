# Mi Semago · The Better Latin Dairy Company

Sitio web nuevo de **Mi Semago** (Paterson, NJ): quesos latinos con la marca del cliente (private label)
y distribución refrigerada a todo EE. UU. Reemplaza a misemago.com y usa sus datos reales: los 16
productos con fichas técnicas, la capacidad (500,000 lb por semana, 30,000 pies²), el proceso de
4 semanas, los contactos y el video de la planta.

Es una sola página en español e inglés, con animaciones (GSAP + Lenis) y una IA propia: **Semago IA**.

## La idea: que el comprador diseñe su queso antes de llamar

Los sitios de la competencia en quesos hispanos (Hispanic Cheese Makers / Nuestro Queso, W&W Dairy,
Cacique, Rizo-López) muestran a lo mucho una lista de productos y un «contáctanos». Ninguno deja que
el comprador **vea su marca sobre el producto**, calcule tarimas ni sepa cuándo le llega. Este sitio sí:

| Sección | Qué hace |
|---|---|
| **Carga** | El hilo de oro dibuja el nudo de quesillo del logo mientras carga |
| **Hero** | Fondo en WebGL de leche que se arremolina sobre azul marino con vetas de oro que siguen al cursor. «Tu marca. Nuestro queso.», con la última palabra cambiando. Hilos de quesillo animados que siguen al cursor, los quesos reales girando en 3D alrededor del nudo y una etiqueta que muestra marcas de ejemplo (o la que el usuario escribió en el Estudio). Cifras animadas |
| **Hilo de oro** | Una línea dorada a la izquierda se va dibujando conforme bajas por la página |
| **Marca privada** | Manifiesto que se ilumina palabra por palabra con el scroll, 4 ventajas y la línea de tiempo real del proceso (≤ 4 semanas) |
| **Estudio de Marca** (lo nunca visto) | Escoges uno de los 16 quesos, la presentación, escribes tu marca y frase, subes tu logo, eliges estilo (Tradición, Moderno, Fiesta) y color. La etiqueta aparece **sobre la foto real del queso** y se inclina en 3D con el cursor. Calcula piezas, libras y tarimas por semana, qué % de la capacidad de la planta usarías, y la **fecha estimada de llegada** a tu estado. Con **«En el anaquel»** ves tu queso repetido en 3 repisas de supermercado, con la tira de precio de tu marca y la etiqueta «NUEVO». Botones: descargar la etiqueta en PNG, mandar la propuesta al formulario o preguntarle a la IA. La IA también **sugiere nombres de marca** |
| **Los quesos** | Tarjetas que se inclinan con una luz dorada que sigue al cursor. Catálogo con filtros y ficha técnica completa (ingredientes, empaque, vida de anaquel, unidades por caja, cajas por tarima, 40 °F). Desde la ficha: diseñar con tu marca, preguntar a la IA o imprimir |
| **Hecho a mano** | El video del hilado del Oaxaca aparece **dentro de las letras gigantes «HECHO A MANO»**; con el scroll las letras crecen hasta abrirse y el video llena la pantalla |
| **La planta** | El video 4K de la planta convertido en 96 cuadros que avanzan con el scroll (estilo Apple), en 6 capítulos: cuajada, hilado, bola, empaque, moldeado y reposo |
| **Equipo** | Fotos reales del equipo y la planta con revelado animado |
| **Distribución** | Mapa de EE. UU. coloreado por días de tránsito. Tocas un estado y un camión refrigerado viaja desde Paterson; muestra días y millas |
| **Por qué Mi Semago, FAQ, Contacto** | Línea directa de marca privada, oficina, correo y bodega. El formulario arma el correo listo (y si vienes del Estudio, incluye tu propuesta) |
| **Semago IA** | Chat flotante: asesor de marca privada. Conoce todo el catálogo, fichas, tarimas, tiempos y días de envío por estado. Muestra tarjetas de producto y un botón para abrir el queso en el Estudio |

También: las secciones oscuras se abren de tarjeta redondeada a pantalla completa al entrar; fotos de producto con corrección de color (se veían azules/verdosas) y tomas sacadas del video 4K. SEO (datos estructurados, imagen para compartir), accesibilidad (teclado, «reducir movimiento»),
imágenes en WebP (las fotos originales pesaban ~15 MB, ahora ~1 MB) y el video de 117 MB convertido a
2.6 MB de cuadros.

## Cambiar textos y productos

- **`src/data.js`**: contacto, productos y fichas técnicas, proceso, capítulos de la planta y preguntas
  frecuentes. Todo en `{ es, en }`. Lo marcado con `CONFIRMAR` es provisional.
- **`src/i18n.js`**: los textos fijos de la página.
- Fotos de producto en `public/img/p/`. En cada producto, `label` dice dónde cae la etiqueta del Estudio
  sobre la foto (`x`, `y`, ancho `w` en % y giro `r`).

La IA lee `src/data.js`: si agregas un producto, Semago IA ya lo conoce.

### Para confirmar con el cliente

- Ingredientes de la **cubeta de 8.5 lb**: en el sitio actual mencionan chile rojo, cebolla, ajo y soya
  (parece copiado de otro producto).
- Ingredientes, empaque y vida de anaquel de las **barras** (blanco para freír y Chihuahua): el sitio actual no los tiene.
- Las descripciones cortas de cada queso son nuevas (el sitio actual no tenía).
- Los días de tránsito por estado son una estimación por distancia dentro del rango real (1 a 5 días).

## La IA (Semago IA)

- Sin configurar nada, el chat responde con un **cerebro local** que conoce catálogo, tarimas, tiempos y envíos.
- Para la **IA real (Claude)**, agrega la variable **`ANTHROPIC_API_KEY`** en Vercel o Netlify
  (*Settings → Environment Variables*) y vuelve a publicar. Se consigue en <https://console.anthropic.com>.
- Opcional: **`SEMAGO_MODEL`** para cambiar el modelo (por defecto `claude-opus-5-5`).
- Código: `server/semago.js` (instrucciones, catálogo, nombres de marca), `api/chat.js` (Vercel) y
  `netlify/functions/chat.mjs` (Netlify). Tiene límite de mensajes por persona, no inventa precios ni
  certificaciones y no da consejos médicos.
- Reemplaza al chat de Voiceflow del sitio actual.

## Correrlo en tu computadora

```bash
cd mi-semago-web
npm install
npm run dev      # abre http://localhost:5173
npm run build    # genera la versión final en dist/
```

## Publicarlo en Vercel

1. En <https://vercel.com>, **Add New… → Project** e importa **`nxusai/ai-jarvis`**.
2. En **Root Directory** elige **`mi-semago-web`**. Vercel detecta Vite solo.
3. En **Environment Variables** agrega `ANTHROPIC_API_KEY`.
4. **Deploy**. Después, en **Settings → Domains**, conecta `misemago.com`.

En Netlify es igual: base directory `mi-semago-web` (ya trae `netlify.toml`).
