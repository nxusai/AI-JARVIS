# Guía: NEX, tu CEO

NEX es la cabeza de todo: tus negocios, tu equipo de agentes y las IAs de tus clientes. Trabaja por departamentos, como un equipo de personas, y te busca solo para lo que es tuyo.

```
Tú
 └─ NEX (CEO, secretario y todo el equipo)
     ├─ Ventas · Marketing · Publicidad · Finanzas · Comunicación · Llamadas · Operaciones · IA
     ├─ El Constructor (Claude Code en tu Mac, con tu suscripción)
     └─ Ultron (dirección de Mi Semago y Abuelito)
          └─ Ana Sofi (Mi Semago) · después la IA de Abuelito y Vivian (VAYRO)
```

## Prenderlo y apagarlo
- **Prender:** `cd ~/Desktop/nexy && npm start`
- **Apagar:** Ctrl + C en esa Terminal.
- La **primera vez que lo prendes en el día** te manda por Telegram su **reporte de arranque**: cómo va la empresa, quién está por cerrar y qué va a hacer él. Apagarlo: `node scripts/ceo.mjs arranque no`.

## Cómo hablarle (voz, iPhone o Telegram)

**Como CEO**
- *"NEX, ¿cómo va la empresa?"*: te da el panorama por departamento.
- *"¿Cómo vamos contra la meta del mes?"*
- *"¿Qué tienes pendiente hoy?"* · *"¿Qué necesitas de mí?"*

**Ventas** (su mandato)
- Prospecta solo de lunes a viernes. Te llama cuando alguien está por cerrar; tú le dices cómo cerrarlo y él agenda la videollamada contigo.
- *"¿Cómo va el pipeline?"* · *"¿Quién está por cerrar?"* · *"Dale seguimiento a la pollería."*

**Software** (el Constructor, con tu suscripción)
- *"Necesito un software para que los choferes registren entregas con foto y firma."*
- *"En el sitio de Aurelius arregla lo que se vea mal en celular."*
- *"¿Cómo va la app de choferes?"* · *"Detén el Constructor."*

**Las IAs debajo de él**
- **Reglas fijas:** *"Dile a Ultron que no prometa fechas sin preguntar al equipo."*
- **Encargos con reporte:** *"Pídele a Ultron que revise las tareas atrasadas de Abuelito y me diga."*. Ultron lo hace y el reporte te llega por Telegram.
- **Encargos que le llegan al cliente** (te pide un toque para confirmar): *"Que Ultron le deje a Senen el resumen de sus tareas atrasadas."*. Le aparece a Senen en su consola, con la voz de Ultron.
- **Ana Sofi:** *"Pídele a Ana Sofi que revise si están todas las etiquetas de quesos."*
- *"¿Qué reportaron Ultron y Ana Sofi?"*

**Proyectos con sus herramientas** (videos, propuestas, contenido)
- Te dice el costo en créditos antes y espera tu toque. Al final te dice cuánto costó de verdad.

## Tu socio: lo que hace solo y lo que siempre te pregunta
NEX trabaja en **modo socio**: decide, actúa y te avisa después por Telegram con un "✅ Lo hice yo: …". Te llama para lo importante y lo platica contigo: te da la noticia, su recomendación y por qué, y acuerdan juntos el siguiente paso.

| Sola (te avisa después) | Siempre te pregunta |
|---|---|
| Notion y los tableros de la empresa | Dinero que sale: anuncios que gastan, facturas, pagos, videos pagados |
| Sus rutinas (crearlas, cambiarlas, quitarlas) | Borrar o archivar cualquier cosa |
| Grupos del equipo NXUS y NXUS México | El grupo de un cliente y lo que le llega a la gente del cliente |
| Correos a gente con la que ya trata (tus buzones, prospectos que ya contestaron) | El primer correo a un desconocido (eso es prospectar, y está apagado) |
| Reuniones en tu calendario para tus empresas | Publicar en marcas de clientes |
| Publicar en tus marcas: NXUS AI, tu marca personal y Aurelius | Tus contactos (a quién puede llamar en tu nombre) |
| Sus proyectos de hasta $10 en créditos | Proyectos más caros y subir un presupuesto |
| Encargos a Ultron y Ana Sofi con reporte, y el Constructor | El precio y el cierre de un cliente |

- **Ver qué hizo solo:** `node scripts/autonomia.mjs`
- **Volver a que pida permiso para todo:** `node scripts/autonomia.mjs asistente` (y para regresar: `node scripts/autonomia.mjs socio`)
- **Cambiar el tope de sus proyectos:** `node scripts/autonomia.mjs tope 10`

## Rutinas de CEO
- **Activar:** `cd ~/Desktop/nexy && node scripts/ceo.mjs activar 10:00`
  - **Junta diaria de dirección**, de lunes a viernes: revisa todo, actúa y te manda un reporte de 6 líneas.
  - **Reporte semanal de crecimiento**, cada lunes: qué pasó, cómo vamos contra la meta y el plan de la semana.
- **Quitar:** `node scripts/ceo.mjs quitar`
- Corren cuando NEX está prendido, o al prenderlo si fue en las últimas 6 horas.

## Comandos útiles
```
node scripts/ceo.mjs                    # la empresa en una vista, como la ve NEX
node scripts/autonomia.mjs              # su modo y lo que hizo solo hoy
node scripts/voz.mjs <voice_id>         # su voz (consola, Telegram, iPhone y llamadas)
node scripts/ceo.mjs activar 10:00      # junta diaria y reporte semanal
node scripts/ceo.mjs arranque no|si     # el reporte al prenderlo
node scripts/mandato.mjs                # cómo va el mes y el pipeline
node scripts/mandato.mjs direccion "…"  # tu dirección física (para los correos a prospectos)
node scripts/mandato.mjs prospectar 10:00
node scripts/proyectos.mjs              # proyectos con créditos y lo que costaron
node scripts/perfil.mjs estado          # tu segundo cerebro
node scripts/movil.mjs estado           # el iPhone
```
