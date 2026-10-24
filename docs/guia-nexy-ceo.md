# Guía: Nexy, tu CEO

Nexy es la cabeza de todo: tus negocios, tu equipo de agentes y las IAs de tus clientes. Trabaja por departamentos, como un equipo de personas, y te busca solo para lo que es tuyo.

```
Tú
 └─ Nexy (CEO, secretaria y todo el equipo)
     ├─ Ventas · Marketing · Publicidad · Finanzas · Comunicación · Llamadas · Operaciones · IA
     ├─ El Constructor (Claude Code en tu Mac, con tu suscripción)
     └─ Ultron (dirección de Mi Semago y Abuelito)
          └─ Ana Sofi (Mi Semago) · después la IA de Abuelito y Vivian (VAYRO)
```

## Prenderla y apagarla
- **Prender:** `cd ~/Desktop/nexy && npm start`
- **Apagar:** Ctrl + C en esa Terminal.
- La **primera vez que la prendes en el día** te manda por Telegram su **reporte de arranque**: cómo va la empresa, quién está por cerrar y qué va a hacer ella. Apagarlo: `node scripts/ceo.mjs arranque no`.

## Cómo hablarle (voz, iPhone o Telegram)

**Como CEO**
- *"Nexy, ¿cómo va la empresa?"*: te da el panorama por departamento.
- *"¿Cómo vamos contra la meta del mes?"*
- *"¿Qué tienes pendiente hoy?"* · *"¿Qué necesitas de mí?"*

**Ventas** (su mandato)
- Prospecta sola de lunes a viernes. Te llama cuando alguien está por cerrar; tú le dices cómo cerrarlo y ella agenda la videollamada contigo.
- *"¿Cómo va el pipeline?"* · *"¿Quién está por cerrar?"* · *"Dale seguimiento a la pollería."*

**Software** (el Constructor, con tu suscripción)
- *"Necesito un software para que los choferes registren entregas con foto y firma."*
- *"En el sitio de Aurelius arregla lo que se vea mal en celular."*
- *"¿Cómo va la app de choferes?"* · *"Detén el Constructor."*

**Las IAs debajo de ella**
- **Reglas fijas:** *"Dile a Ultron que no prometa fechas sin preguntar al equipo."*
- **Encargos con reporte:** *"Pídele a Ultron que revise las tareas atrasadas de Abuelito y me diga."*. Ultron lo hace y el reporte te llega por Telegram.
- **Encargos que le llegan al cliente** (te pide un toque para confirmar): *"Que Ultron le deje a Senen el resumen de sus tareas atrasadas."*. Le aparece a Senen en su consola, con la voz de Ultron.
- **Ana Sofi:** *"Pídele a Ana Sofi que revise si están todas las etiquetas de quesos."*
- *"¿Qué reportaron Ultron y Ana Sofi?"*

**Proyectos con sus herramientas** (videos, propuestas, contenido)
- Te dice el costo en créditos antes y espera tu toque. Al final te dice cuánto costó de verdad.

## Lo que hace sola y lo que siempre te pregunta

| Sola | Te pregunta |
|---|---|
| Prospectar y dar seguimiento | El precio y el cierre de un cliente |
| Correos nuevos a prospectos (hasta 10 al día, con tu dirección) | Cualquier otro correo o publicación |
| Encargos a Ultron y Ana Sofi con reporte | Lo que le llega a una persona del cliente |
| Construir software con el Constructor | Gastar créditos en un proyecto de ella |
| Agendar la videollamada de cierre | Dinero que sale, facturas, borrar |
| Llamarte por lo importante | |

## Rutinas de CEO
- **Activar:** `cd ~/Desktop/nexy && node scripts/ceo.mjs activar 10:00`
  - **Junta diaria de dirección**, de lunes a viernes: revisa todo, actúa y te manda un reporte de 6 líneas.
  - **Reporte semanal de crecimiento**, cada lunes: qué pasó, cómo vamos contra la meta y el plan de la semana.
- **Quitar:** `node scripts/ceo.mjs quitar`
- Corren cuando Nexy está prendida, o al prenderla si fue en las últimas 6 horas.

## Comandos útiles
```
node scripts/ceo.mjs                    # la empresa en una vista, como la ve Nexy
node scripts/ceo.mjs activar 10:00      # junta diaria y reporte semanal
node scripts/ceo.mjs arranque no|si     # el reporte al prenderla
node scripts/mandato.mjs                # cómo va el mes y el pipeline
node scripts/mandato.mjs direccion "…"  # tu dirección física (para los correos a prospectos)
node scripts/mandato.mjs prospectar 10:00
node scripts/proyectos.mjs              # proyectos con créditos y lo que costaron
node scripts/perfil.mjs estado          # tu segundo cerebro
node scripts/movil.mjs estado           # el iPhone
```
