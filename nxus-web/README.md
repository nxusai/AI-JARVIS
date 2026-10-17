# nxusai.org — sitio web de NXUS AI

Sitio estático (Vite + GSAP + Lenis), una página por sección:

| Dirección | Archivo | Qué tiene |
|---|---|---|
| `/` | `index.html` | La esfera de partículas que se vuelve el logo, manifiesto, teaser de Jarvis, soluciones, "un día con tu IA", industrias, comparativa |
| `/jarvis` | `jarvis.html` | La demo: bautizar la IA, chat de Telegram en vivo (5 escenarios + el visitante le escribe), voz, consola, integraciones, equipo, control y cómo se hace |
| `/soluciones` | `soluciones.html` | Las 6 líneas del catálogo |
| `/industrias` | `industrias.html` | Selector de 16 industrias con lo que hace la IA en cada una |
| `/proceso` | `proceso.html` | Los 5 pasos, formas de empezar y preguntas frecuentes |
| `/nosotros` | `nosotros.html` | Quiénes somos |
| `/contacto` | `contacto.html` | Formulario y accesos directos |

```
npm install
npm run dev      # http://localhost:5173
npm run build    # sale en dist/
```

- La barra de menú y el pie están en `src/partials/` y se insertan en cada página al compilar.
- El nombre que el visitante le pone a su IA en `/jarvis` se guarda en su navegador y aparece en todo el sitio.
- El chat del demo responde con un guion local (`src/js/replies.js`), todavía sin IA real.
- El formulario de contacto abre el correo del visitante con el mensaje listo. Para guardarlo en Supabase, solo cambia `enviar()` en `src/js/contacto.js`.
- Los botones de "Empezar" llevan al portal `empezar.nxusai.org`.

## Publicar en Netlify

Nuevo sitio desde GitHub → Base directory `nxus-web`. El resto lo toma de `netlify.toml` (incluye las direcciones limpias `/jarvis`, `/soluciones`, …).
