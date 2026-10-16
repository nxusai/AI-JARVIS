# El Abuelito Inc. · ¡Solo lo mejor...!

Sitio web nuevo de **El Abuelito Inc.** (Paterson, NJ). Junta en un solo lugar el contenido de los dos
sitios anteriores (abuelitocheese.com y el sitio de Bolt que nunca se publicó), con animaciones
(GSAP + Lenis), español e inglés y un asistente con IA: **«Pregúntale al Abuelito»**.

Por petición del cliente, **no incluye el localizador de tiendas**.

## Qué tiene el sitio

| Sección | Qué hace |
|---|---|
| **Pantalla de carga** | El Abuelito saluda mientras aparecen frases («Calentando el comal…») |
| **Hero** | Papel picado que cae y se mece, título letra por letra, el Abuelito saluda, productos flotando, globito con frases que cambian, contadores |
| **Marquesina** | Nombres de productos; acelera cuando haces scroll |
| **Departamentos** | Quesos, Cremas, Carnes, Despensa, Maíz y antojitos, Postres. Tarjetas con inclinación 3D |
| **Catálogo** | 83 productos (105 presentaciones) con pestañas por departamento, subcategorías y buscador. Cada producto abre su ficha con presentaciones (14 oz, 5 LB, 10 LB…), «va perfecto con», recetas y botones para preguntarle a la IA o pedirlo para un negocio |
| **Novedades** | Carrusel arrastrable con los productos nuevos |
| **La ruta del queso** | Escoge un país (México, El Salvador, Honduras, Guatemala, Ecuador, Perú, Colombia, Rep. Dominicana) y ve sus quesos y cremas, el platillo típico y un dato curioso |
| **¿Qué se te antoja hoy?** | Juego: tocas un antojo (tacos, pupusas, mole…) y te dice qué productos llevar y qué receta hacer |
| **Video** | El video animado del Abuelito en la cocina (se reproduce solo al llegar, con botón para escuchar el sonido) |
| **Recetas** | 8 recetas con los productos. Lista de ingredientes que se puede palomear y compartir por WhatsApp |
| **Historia** | Carta de Don Miguel Torres que se «escribe» al hacer scroll, línea del tiempo y nota en su memoria |
| **Calidad** | Laboratorio, estándares FDA, recetas de familia, cadena de frío |
| **Mayoreo** | Para tiendas, carnicerías, taquerías y restaurantes; lleva al formulario ya marcado como negocio |
| **Instagram, contacto y preguntas frecuentes** | Formulario que arma el correo listo para enviar |
| **Pregúntale al Abuelito (IA)** | Chat flotante. Recomienda productos con tarjetas con foto, da recetas, explica mayoreo y contacto |
| **Barra móvil** | En celular: Productos · Abuelito IA · Llamar |

También: SEO (datos estructurados de la empresa, imagen para compartir, sitemap), accesibilidad
(teclado, modo «reducir movimiento»), imágenes optimizadas en WebP (de 114 MB a 3 MB) y video de 2 MB.

## Cambiar textos, productos y recetas

- **`src/data.js`**: contacto, departamentos, productos, países, antojos, recetas, historia y preguntas
  frecuentes. Todo va en `{ es, en }`. Lo marcado con `CONFIRMAR` es provisional.
- **`src/i18n.js`**: los textos fijos de la página.
- Fotos de producto en `public/img/p/` (el nombre del archivo es el que aparece en `data.js`).

La IA lee `src/data.js`, así que si agregas un producto o una receta, el Abuelito ya lo conoce.

## La IA del Abuelito

- Sin configurar nada, el chat responde con un **cerebro local** (reglas) que conoce todo el catálogo.
- Para activar la **IA real (Claude)**, agrega la variable de entorno **`ANTHROPIC_API_KEY`** en Vercel o
  Netlify (*Settings → Environment Variables*) y vuelve a publicar. La consigues en
  <https://console.anthropic.com>.
- Opcional: **`ABUELITO_MODEL`** para cambiar el modelo (por defecto `claude-opus-5-5`).
- El código está en `server/abuelito.js` (instrucciones y catálogo), `api/chat.js` (Vercel) y
  `netlify/functions/chat.mjs` (Netlify). Tiene límite de mensajes por persona y no da consejos médicos.

## Correrlo en tu computadora

```bash
cd el-abuelito-web
npm install
npm run dev      # abre http://localhost:5173
npm run build    # genera la versión final en dist/
```

## Publicarlo en Vercel

1. En <https://vercel.com>, **Add New… → Project** e importa **`nxusai/ai-jarvis`**.
2. En **Root Directory** elige **`el-abuelito-web`**. Vercel detecta Vite solo.
3. En **Environment Variables** agrega `ANTHROPIC_API_KEY`.
4. **Deploy**. Después, en **Settings → Domains**, conecta `abuelitocheese.com`.
