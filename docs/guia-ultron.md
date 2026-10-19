# Guía: Ultron, la IA de la dirección (Mi Semago · Abuelito)

## Qué es

- **Ultron** atiende **solo a la dirección**: Senen, Gerardo, Marisol y Miguel (a quienes marques con "Habla con Ultron").
- Debajo tiene a sus IAs: **Ana Sofi** (Mi Semago), y después la de **Abuelito** y **Vivian** (VAYRO).
- **Nexy manda sobre Ultron.** Ve todas sus conversaciones y le da órdenes que la dirección nunca ve.

## Dónde habla

| Dónde | Qué puede hacer |
|---|---|
| **El orbe del Centro de trabajo** | Solo lo del Centro de trabajo: resúmenes, buscar archivos, mandarlos al correo, **proponer** tareas o instrucciones nuevas (pasan solo cuando la persona toca el botón). Nunca borra ni cambia nada. |
| **Su consola** (`/ultron` en la misma dirección del Centro de trabajo) | Todo: lo anterior, más lo que hizo Ana Sofi, darle instrucciones y su memoria. Con voz y micrófono. |
| Telegram | Después. |

## Cómo funciona por dentro

1. La pregunta se guarda en un **buzón** en Supabase (`ultron_mensajes`).
2. Ultron corre **en tu Mac, bajo Nexy** (después en la Mac mini del cliente). Toma la pregunta, consulta con los permisos de esa persona y contesta.
3. Deja la respuesta y su **voz de ElevenLabs** (voz `eosea9zzgDtCNZMXrA1R`) en el mismo buzón. La página la muestra y la reproduce.
4. Si tu Mac está apagada, el mensaje espera; a los 2 minutos la página avisa que Ultron está dormido.

Cada quien ve solo **su** conversación y **sus** tareas. La consola muestra de todos solo cuentas, nunca qué pidió quién.

## Conectarlo (una vez, 10 min)

1. **Actualiza tu carpeta de Nexy** (el zip de la rama, como siempre).
2. **Base de datos:**
   - en tu Mac: `pbcopy < ~/Desktop/nexy/crm/supabase/esquema.sql`
   - Supabase → **SQL Editor** → **+ New query** → Cmd + V → **Run**.
   - Debe decir **Success**.
3. **Conecta a Ultron en tu Mac:**
   ```
   cd ~/Desktop/nexy && node scripts/ultron.mjs
   ```
   - Pide la **Project URL**: `https://viqvpjhjerihnqzjjppb.supabase.co`
   - Pide la **Secret key**: de Passwords, la entrada `SUPABASE_SERVICE_KEY`. Al pegarla no se ve; es normal.
4. **Reinicia Nexy:** Ctrl + C y luego `cd ~/Desktop/nexy && npm start`. En la Terminal debe salir `Ultron on`.
5. **En el Centro de trabajo → Usuarios:** crea (o edita) a Senen, Gerardo, Marisol y Miguel como **Cliente** y marca **"Habla con Ultron"**.
6. **Prueba:**
   - entra como admin (tú también tienes el orbe);
   - toca el orbe y pregunta "Resumen de hoy";
   - luego abre la consola con **Consola ↗**.

## Hablarle con la voz (como a Nexy)

En su consola, toca el **micrófono** una vez y queda **escuchando todo el tiempo**:
- Háblale normal; al terminar la frase, la entiende y contesta **con su voz**.
- Si llevan más de minuto y medio sin hablarle, primero di **"Ultron, …"**.
- Puedes **interrumpirlo** hablando encima, o decirle **"para"** / **"silencio"**.
- Tócalo otra vez para apagar el micrófono.

Para que entienda lo que dices, Netlify necesita la llave de ElevenLabs (una vez):
1. https://elevenlabs.io → tu perfil (abajo a la izquierda) → **API Keys** → **Create API Key**:
   - Name: `Ultron oído`
   - Permisos: **Speech to Text → Access**; lo demás, sin acceso.
   - Copia la llave y guárdala en Passwords como `ELEVENLABS_API_KEY`.
2. Netlify → tu proyecto → **Project configuration** → **Environment variables** → **Add a variable** → **Add a single variable**:
   - Key `ELEVENLABS_API_KEY`, Value: la llave.
   - Marca **Contains secret values**.
3. **Deploys** → **Trigger deploy** → **Deploy project**.

La voz con la que Ultron **contesta** sale de tu Mac (la misma llave de ElevenLabs que usa Nexy); esta nueva es solo para **oír**.

## Comandos útiles (en la Terminal)

```
node scripts/ultron.mjs estado                    # si está conectado y qué espera en su buzón
node scripts/ultron.mjs orden "…" [ultron|ana-sofi|todas]   # una orden tuya, que la dirección no ve
node scripts/ultron.mjs ordenes                   # las órdenes e instrucciones vigentes
node scripts/ultron.mjs quitar <id>               # quitar una
node scripts/ultron.mjs voz <id>                  # cambiar su voz
node scripts/api.mjs ultron                       # que lo pague una llave de API aparte (la del cliente)
```

También a Nexy, por voz o Telegram:
- "¿Qué le preguntaron a Ultron hoy?"
- "Dale a Ultron la orden de no prometer fechas sin preguntar al equipo."
