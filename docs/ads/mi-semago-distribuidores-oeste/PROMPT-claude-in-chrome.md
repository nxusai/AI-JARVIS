# Campaña Mi Semago · Distribuidores Oeste (Click-to-WhatsApp) — v2 con las lecciones

Aplica `docs/lecciones-anuncios-mensajes.md` (los $210 sin personas reales: robots de otros negocios contestando). Cambios contra la v1: campaña manual sin Advantage+, presupuesto en el conjunto con tope total, público con límites fijos (30–65, sin intereses, zonas de bodegas y mayoreo por código postal), ubicaciones manuales, todas las mejoras de IA apagadas, un mensaje prellenado distinto por anuncio (para saber de cuál llegó cada lead) y ManyChat con disparadores de frase EXACTA (nunca "contiene").

Decisiones de Eduardo: $25 al día, prueba de 7 días; oeste del Mississippi + Illinois; nada de Florida, NY, NJ, las Carolinas ni el este; pedido mínimo 1,500 lb; distribuidores y cadenas grandes. WhatsApp: +1 484-969-8507 (el de ManyChat) conectado a la página Mi Semago.

## Prompt 1 — Ads Manager (corregir el borrador)

```
Vamos a corregir el borrador de la campaña "Mi Semago · Distribuidores Oeste · WhatsApp · Prueba 7 días" con reglas nuevas que aprendimos (gastamos $210 en anuncios de mensajes y solo llegaron respuestas automáticas de otros negocios). NO publiques nada.

PRIMERO SOLO MIRA: dame un informe de cómo está hoy el borrador (campaña, conjunto y cada anuncio) con ✅ / ⚠️ / ❌ contra estas reglas, sin cambiar nada. Luego espera mi "corrígelo".

REGLAS
1. Campaña manual: que NO sea "Advantage+ campaign" ni "configuración recomendada". Objetivo Engagement → destino de mensajes WhatsApp.
2. Presupuesto en el CONJUNTO, no en la campaña: apaga "Advantage campaign budget". Conjunto: $25.00 diarios. Desmarca "Share up to 20% of your budget with other ad sets". En la campaña pon Campaign spending limit (tope total) de $175.
3. Público con límites fijos: "Switch to original audience options" / "Reach a limited audience".
   - Edad 30 a 65, con "Use as a suggestion" DESMARCADO. Ignora si Meta sugiere abrir a 18–65+.
   - SIN intereses (quita Wholesale, Small business owners y todos los demás).
   - Idiomas: vacío.
   - Ubicación: quita los estados y pon SOLO estos códigos postales de zonas de bodegas, mercados de mayoreo y distribución de alimentos ("People living in or recently in this location"):
     Los Ángeles e Inland Empire: 90021, 90023, 90040, 90058, 91745, 91746, 91748, 91761
     San Francisco y Oakland: 94124, 94621
     Fresno: 93706
     San Diego: 92154
     Phoenix: 85009, 85040, 85043
     Las Vegas: 89115, 89118
     Denver: 80216, 80239
     Salt Lake City: 84104
     Dallas: 75207, 75212, 75235, 75247
     Houston: 77011, 77020, 77022, 77029, 77076
     San Antonio: 78207, 78219, 78226
     Chicago: 60007, 60106, 60160, 60608, 60609, 60632
     Si Meta no reconoce algún código, dime cuál. No agregues estados completos ni radios grandes.
4. Ubicaciones manuales: SOLO Facebook e Instagram en Feed, Stories y Reels. Todo lo demás fuera (Audience Network, Messenger inbox, Threads, Marketplace, Explore, Search, In-stream, etc.). Desmarca "Allow limited spending to excluded placements".
5. Meta de rendimiento: Maximize number of conversations (es la única que sirve mientras no mandemos señales de leads).
6. En CADA anuncio apaga TODAS las mejoras de Advantage+ creative, una por una (texto, visuales, música, overlays, animación, filtros, brillo y contraste, expandir imagen, traducir, relevant comments, enhance CTA), también "Optimize text per person", "Multi-advertiser ads" y "Related media".
7. Texto: deja SOLO esta opción de texto principal y SOLO este título (borra las demás):
   Texto: "¿Distribuyes quesos latinos a tiendas, supermercados o restaurantes? Producimos tu marca propia: Oaxaca, queso fresco, panela, canastón y más de 16 presentaciones. 500,000 libras por semana desde nuestra planta registrada ante la FDA en Paterson, NJ, con envío refrigerado a 40 °F hasta tu almacén. Pedido mínimo: 1,500 libras."
   Título: "Tu marca. Nuestro queso."
   Descripción: "Pedido mínimo 1,500 lb"
8. Mensaje de bienvenida (Meta lo exige): "¡Hola! Somos Mi Semago 🧀 Toca enviar para recibir precios." Si en "Message template" aparece la opción de usar una app asociada (Partner app → ManyChat), dime antes de usarla.
9. Mensaje prellenado: uno DISTINTO por anuncio, exactamente así (así sabemos de qué anuncio llegó cada persona):
   - Anuncio "Capacidad 500k lb": "Hola, quiero precios para producción por volumen."
   - Anuncio "Tu marca": "Hola, quiero precios de quesos con mi marca."
   - Anuncio "Logística 40°F": "Hola, quiero precios con envío refrigerado."
   - Anuncio "Carrusel planta real": "Hola, quiero precios para distribuir sus quesos."
10. WhatsApp del anuncio: +1 484-969-8507 conectado a la página Mi Semago.
11. En la configuración de anuncios de la cuenta (Advertising settings), si aparece "testing new creative and AI enhancements" o algo parecido, sal de esa prueba.

CUANDO TE DIGA "corrígelo": haz los cambios, revisa que las mejoras de IA sigan apagadas en los 4 anuncios (se prenden solas al editar o duplicar) y que cada anuncio tenga su imagen correcta. Al final dame otra vez el informe punto por punto con ✅ / ⚠️ / ❌. NO publiques: espera a que te diga "publícala".
```

## Prompt 2 — ManyChat (disparadores exactos y de qué anuncio llegó)

```
Vas a ayudarme en ManyChat (Mi Semago, WhatsApp), flujo "Mi Semago · Chat corto (Centro de trabajo)". Trabaja paso a paso y dime antes de cada cambio.

PRIMERO SOLO MIRA y dame un informe con ✅ / ⚠️ / ❌ de:
- El disparador de palabras clave del flujo: qué palabras tiene y si la regla es "contains" o "is".
- Si hay disparador por intención (intent / AI) prendido.
- Si está prendido el Default Reply, el Welcome Message o alguna respuesta automática / Business AI.
- Que el primer mensaje del flujo sea la pregunta de idioma con botones (Español / English).
Luego espera mi "corrígelo".

CUANDO TE DIGA "corrígelo":
1. Crea el campo de texto "MS Fuente" (Settings → Fields) si no existe.
2. Cambia el disparador del flujo para que use la regla "Message is" (frase EXACTA), nunca "contains", con estas frases, cada una en su propia regla:
   - "Hola, quiero precios para producción por volumen." → guarda MS Fuente = "Anuncio · Capacidad"
   - "Hola, quiero precios de quesos con mi marca." → MS Fuente = "Anuncio · Tu marca"
   - "Hola, quiero precios con envío refrigerado." → MS Fuente = "Anuncio · Logística"
   - "Hola, quiero precios para distribuir sus quesos." → MS Fuente = "Anuncio · Carrusel"
   - "INFO" (exacto, para los posts) → MS Fuente = "Orgánico · INFO"
   Si ManyChat no deja guardar un campo distinto por frase en el mismo disparador, haz un disparador por frase, cada uno con su acción "Set field MS Fuente" y luego "Start flow" al mismo flujo.
   Quita las palabras sueltas que había (quesos, queso, private label, información, informacion, info, precio, cheese) y apaga cualquier disparador por intención.
3. En las dos External Request (español e inglés) agrega al JSON: "fuente": "{{MS Fuente}}" (con el botón de variables). No cambies nada más del JSON ni la clave.
4. No actives Default Reply, Welcome Message ni respuestas automáticas.
5. Al final dame el informe con ✅ / ⚠️ / ❌. Para publicar necesito decírtelo claro: "Sí, te autorizo de forma clara a publicar el flujo Mi Semago · Chat corto". Sin esa frase, no publiques.
```

## Después de publicar
- 7 días sin tocar nada ("Learning limited" es normal con $25 al día).
- Juzgar por costo por lead calificado y por Meet (Centro de trabajo → Leads; cada ficha dice de qué anuncio llegó), no por costo por mensaje.
- Fase 2: mandar a Meta la señal de lead bueno solo cuando la persona terminó el filtro (ManyChat → Ads Optimization / Conversions API).
