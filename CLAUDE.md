# Lo que todo chat debe saber de este repositorio

## Cómo trabajar con Eduardo (el dueño)
- Español. Pasos clic por clic, con los nombres de los botones en inglés como salen en pantalla.
- Links y comandos dentro de cada paso, y repetidos al final.
- Nunca decir "el mensaje anterior": repetir lo necesario.
- Si Eduardo **solo pregunta**, contestar y no cambiar nada hasta que lo pida.
- Nunca pedir ni pegar llaves, contraseñas o tokens en el chat. Las llaves del cerebro se escriben en el Mac mini con `llaves.mjs`; las de Netlify y Supabase, en sus paneles.
- Preguntar antes de instalar algo en todo el sistema. No abrir PR si no lo pide.
- Enseñar foto o vista previa antes de que él suba o publique algo.
- No inventar estadísticas.
- NEX se prende y apaga a mano: nunca sugerir que corra solo.
- Rama de trabajo: `claude/jarvis-project-setup-gs6uu2`. En su Mac el proyecto vive en `~/Desktop/nexy`.

## Actualizar NEX en su Mac (darlo completo cada vez)
1. Descargar el zip de la rama: https://github.com/nxusai/AI-JARVIS/archive/refs/heads/claude/jarvis-project-setup-gs6uu2.zip
2. Pegar en la Terminal (en una pestaña que NO sea la de NEX):
```bash
S=""; D=~/Downloads; Z=$(ls -t "$D" | grep -E '^AI-JARVIS-claude-jarvis-project-setup-gs6uu2.*\.zip$' | head -1); F=$(ls -t "$D" | grep -E '^AI-JARVIS-claude-jarvis-project-setup-gs6uu2' | grep -v '\.zip$' | head -1); T=$(mktemp -d); if [ -n "$Z" ]; then unzip -q "$D/$Z" -d "$T" && S=$(ls -d "$T"/*/ | head -1); elif [ -n "$F" ]; then S="$D/$F/"; fi; if [ -z "$S" ]; then echo "No encontré el zip en Descargas"; elif cp -R "$S". ~/Desktop/nexy/; then echo "Listo: nexy actualizado"; grep -q "public.leads (" ~/Desktop/nexy/hq/supabase/esquema.sql && echo "✓ Ya trae Leads y Cartera" || echo "✗ Sigue el archivo viejo"; [ -n "$Z" ] && rm "${D:?}/${Z:?}"; [ -n "$F" ] && rm -rf "${D:?}/${F:?}"; else echo "No se pudo copiar: no borré nada"; fi; rm -rf "${T:?}"
```
3. Reiniciar NEX en su pestaña: Ctrl + C y luego `npm start`. Si Ana Sofi está en una llamada, esperar a que cuelgue.

## El cliente Mi Semago / Abuelito vive en su "cerebro" (Mac mini en su oficina)
Desde el 14 nov 2026, Ana Sofi (etiquetas y línea de ventas) y Ultron (la IA de la dirección) corren en el **Mac mini del cliente**, no en la Mac de Eduardo. NEX solo vigila, manda cambios firmados por Tailscale y hace las llamadas al dueño. Guía completa: `docs/guia-instalacion-cerebro.md`. Diseño: `docs/cerebro-cliente.md`.

**Al terminar cualquier cambio, decirle a Eduardo qué hacer según lo que se tocó:**

| Lo que cambió | Qué tiene que hacer Eduardo |
|---|---|
| La página del CRM / Centro de trabajo (`crm/public`, `crm/netlify`) | Nada: Netlify lo publica solo desde la rama |
| La base de datos del CRM (`crm/supabase/esquema.sql`) | Correr el bloque SQL nuevo en Supabase (darle el bloque exacto) |
| El núcleo del cerebro: `bridge/nucleo/*` (Ana Sofi, Ultron, ventas, consola de voz del Mac mini) o `bridge/cerebro/*` | Actualizar NEX con el zip **y** mandar el cerebro: `cd ~/Desktop/nexy && node scripts/cerebro.mjs enviar mi-semago` (debe decir "✅ Cerebro instalado") |
| Datos: etiquetas, grupo o voces de Ana Sofi, voz de Ultron, el dueño | `cd ~/Desktop/nexy && node scripts/cerebro.mjs datos mi-semago` (agregar `--etiquetas` si cambiaron etiquetas) |
| Solo NEX (`bridge/*.mjs` fuera de `nucleo` y `cerebro`, `scripts/`) | Actualizar NEX con el zip y reiniciarlo |

Para revisar el cerebro: `cd ~/Desktop/nexy && node scripts/cerebro.mjs estado` (debe decir "último latido: ahora", "Sello: ✅" y "prendida" en cada IA).

**Reglas del cerebro:**
- `bridge/nucleo` y `bridge/cerebro` van al cliente: nunca pueden contener "nexy", "nex", "jarvis", "nxus", "ramos & co" ni "contacto@". Revisar con `node scripts/nucleo.mjs` antes de subir.
- El cerebro no tiene nada de NEX ni de otros clientes, y no debe poder alcanzarlos.
- Solo Eduardo cambia el cerebro: todo va firmado con su llave y por la puerta (`scripts/cerebro.mjs`). Nunca proponer otra vía.
- Senen y Gerardo no deben ver las tareas del otro. Solo Eduardo borra. Las vendedoras no entran al CRM.
- La consola de voz del Mac mini (http://127.0.0.1:8790) habla como Senen y nunca como administrador.
- Emergencia: en Telegram, "corta todo" o el botón 🛑 de una alarma (o `node scripts/cerebro.mjs borrar-llaves mi-semago`) apaga el cerebro y borra sus llaves.

## Otros documentos útiles
- `docs/estado-nxus.md`: estado general de NXUS.
- `docs/estado-crm.md`: el CRM / Centro de trabajo.
- `docs/estado-ads-nxus.md`: anuncios de NXUS.
- `docs/receta-edicion.md` y `docs/habilidad-editor-video.md`: edición de video.
