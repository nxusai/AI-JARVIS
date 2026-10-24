# Guía de instalación: cerebro de Mi Semago

Para el día que se instala el Mac mini del cliente. Va en orden; cada fase
termina con cómo saber que quedó bien. Si una pantalla de macOS no aparece o
cambia de nombre, sáltala o manda foto.

Tiempo total: unas 2 horas.

Necesitas:
- tu Mac con NEX prendida;
- el Mac mini conectado con cable de internet, teclado, mouse y pantalla;
- una memoria USB;
- tu celular con Telegram.

---

## Fase 0 — En tu Mac, antes de ir al Mac mini (15 min)

**0.1 Actualiza NEX** (procedimiento de siempre; el resultado esperado viene
en el mensaje de Claude).

**0.2 Revisa las voces de Ana Sofi.** En una pestaña nueva de Terminal
(Cmd + T):

```
cd ~/Desktop/nexy && node scripts/anasofi.mjs estado
```

"Voz en español" y "Voz en inglés" deben decir **"su voz propia ✅"**.
- Si alguna dice "la de la agente Ana Sofi de ElevenLabs", corre el comando
  que aparece en esa misma línea (`node scripts/anasofi.mjs voz …`) y vuelve a
  revisar. En el cerebro no existe ese respaldo.
- Si alguna dice que falta, avisa antes de seguir.

**0.3 Anota la huella de tu llave de firma.**

```
cd ~/Desktop/nexy && node scripts/cerebro.mjs llave
```

Deja esa ventana abierta: en la fase 3 la vas a comparar.

**0.4 Arma el cerebro.**

```
cd ~/Desktop/nexy && node scripts/cerebro.mjs armar
```

Debe decir "✅ Cerebro … armado y firmado". La carpeta queda en Documentos →
NEX → cerebro → Cerebro-(fecha).

**0.5 Cópiala a la USB.** En Finder abre Documentos → NEX → cerebro, arrastra
la carpeta Cerebro-(fecha) a la USB y expúlsala.

**0.6 Tailscale en tu Mac.**
1. Abre https://tailscale.com/download.
2. Elige macOS y descarga la versión que se baja directo de la página (no la
   de la App Store).
3. Instálala, ábrela y dale "Log in". Crea tu cuenta (por ejemplo, con tu
   cuenta de Google).
4. Acepta los permisos que pida macOS (Ajustes → Privacidad y seguridad →
   Permitir).
5. El ícono de Tailscale en la barra de arriba debe decir "Connected".

---

## Fase 1 — Encender el Mac mini (15 min)

**Antes de empezar:** en tu Mac abre la app Contraseñas y crea una
contraseña nueva de 16 caracteres o más para "Soporte NXUS – Mac mini Mi
Semago". Es única: no la uses en ningún otro lado.

En el Asistente de configuración del Mac mini:

1. **Idioma:** Español. **País:** Estados Unidos.
2. **Accesibilidad:** Ahora no.
3. **Red:** el cable de internet (si pregunta por Wi-Fi, Otras opciones de
   red → Mi computadora no se conecta a internet solo si no hay cable).
4. **Asistente de migración:** Ahora no.
5. **Apple ID / Cuenta de Apple:** Configurar más tarde → Omitir. **No pongas
   ninguna.**
6. **Términos:** Aceptar.
7. **Crear una cuenta de computadora:**
   - Nombre completo: `Soporte NXUS`
   - Nombre de la cuenta: `soporte`
   - Contraseña: la que guardaste en Contraseñas
   - Pista: vacía
8. **Localización:** no activar.
9. **Análisis:** desmarca todo.
10. **Tiempo en pantalla:** Configurar más tarde.
11. **Siri:** no activar.
12. **FileVault:** Activar. Si pregunta por iCloud, elige que **no** lo use.
    Te va a mostrar una **llave de recuperación**: guárdala en Contraseñas de
    tu Mac como nota "Llave de recuperación – Mac mini Mi Semago". Es la
    única forma de abrir el disco si se olvida la contraseña.
13. Lo demás (apariencia, Touch ID): como quieras.

**Quedó bien si:** ves el escritorio, y arriba a la derecha el usuario es
Soporte NXUS.

---

## Fase 2 — Ajustes del Mac mini (20 min)

Todo en  → Ajustes del Sistema.

**2.1 Actualizaciones.**
1. General → Actualización de software: instala lo que haya y deja que
   reinicie.
2. En "Actualizaciones automáticas" (ⓘ):
   - apaga "Instalar actualizaciones de macOS";
   - deja prendidas las "Respuestas de seguridad".

   Así no se reinicia solo de noche.

**2.2 Energía.** Energía (o Batería → Opciones):
- "Evitar el reposo automático cuando la pantalla está apagada": prendido.
- "Reactivar para acceso a la red": prendido.
- "Arrancar automáticamente tras un corte de luz": prendido.

**2.3 Pantalla bloqueada.** "Pedir contraseña tras activar el reposo o el
protector de pantalla": de inmediato.

**2.4 Usuario del cliente.** Usuarios y grupos → Añadir usuario (pide tu
contraseña):
- Tipo: **Estándar** (nunca administrador)
- Nombre completo: `Mi Semago`
- Nombre de la cuenta: `misemago`
- Contraseña: una que le darás **solo** al responsable, para prender el Mac
  después de un apagón.

**2.5 Inicio de sesión remoto.** General → Compartir → Inicio de sesión remoto:
1. Prendido.
2. Dale a (ⓘ). En "Permitir acceso a" elige "Solo estos usuarios" y deja solo
   a Soporte NXUS.
3. "Permitir acceso total al disco para usuarios remotos": apagado.

**2.6 Google Chrome** (Ana Sofi lo usa para las vistas previas de
etiquetas). Descárgalo de https://www.google.com/chrome e instálalo. No
inicies sesión en Chrome.

**2.7 Node.js.**
1. Abre https://nodejs.org y descarga el botón **LTS** (el instalador para
   macOS).
2. Instálalo con Continuar → Instalar.

**2.8 Tailscale en el Mac mini.**
1. Descárgalo igual que en 0.6, instálalo y acepta los permisos.
2. Log in con **tu** cuenta de Tailscale → Connect.
3. En el navegador, cierra la sesión de esa cuenta.
4. En tu Mac abre https://login.tailscale.com/admin/machines y busca el Mac
   mini.
5. En "…" elige **Disable key expiry**, para que no se desconecte solo en
   unos meses.
6. Anota su dirección, la que empieza con **100.**

**Quedó bien si:** en tu Mac, el panel de Tailscale muestra las dos
computadoras "Connected".

---

## Fase 3 — Instalar el cerebro (10 min)

1. Conecta la USB al Mac mini y copia la carpeta Cerebro-(fecha) a Descargas.
2. Abre Terminal: Aplicaciones → Utilidades → Terminal.
3. Escribe:
   ```
   cd ~/Downloads/Cerebro-* && sudo bash instalar.sh
   ```
4. Pide la contraseña de Soporte. No se ve mientras la escribes: escríbela y
   presiona Enter.
5. Te muestra una **huella**. Compárala con la de tu Mac (0.3). Si es
   idéntica, escribe `si` y Enter. Si no es igual, **para** y avísame.
6. Espera unos minutos ("Instalando lo que el cerebro necesita…").

**Quedó bien si dice:**
- "✅ Cerebro instalado";
- "✅ Puerta lista".

Si además dice "⚠️ Falta prender Inicio de sesión remoto", repite 2.5.

---

## Fase 4 — Llaves (20 min, todo en el Mac mini)

Las llaves se crean en el Chrome del Mac mini y se pegan ahí mismo. Nunca
pasan por un chat. Al final se cierran todas las sesiones.

**4.1 Claude.** Abre https://console.anthropic.com e inicia sesión.
1. Settings → Workspaces → Create workspace: `Cerebro Mi Semago`.
2. En ese workspace, Limits: pon un límite de gasto mensual.
3. API Keys → Create Key:
   - Workspace: Cerebro Mi Semago
   - Nombre: `Mac mini`
4. **Copia la llave** (solo se muestra una vez) y deja la pestaña abierta.

**4.2 ElevenLabs.** Abre https://elevenlabs.io e inicia sesión.
1. Developers → API Keys → Create API Key: `Cerebro Mi Semago`.
2. Restrict key: prendido.
   - Text to Speech: Access
   - Speech to Text: Access
   - Todo lo demás: No access
3. Pon un tope de créditos → Create.
4. Deja la pestaña con la llave abierta.

**4.3 Drive (Apps Script con la cuenta de Mi Semago).**
1. En Terminal copia el programa:
   ```
   pbcopy < ~/Downloads/Cerebro-*/drive-google.gs
   ```
2. En Chrome abre una **ventana de incógnito** (Cmd + Shift + N) y entra a
   https://script.google.com con **info@misemago.com**.
3. Nuevo proyecto. Borra lo que trae y pega (Cmd + V).
4. Arriba, cambia el nombre a `Etiquetas Drive` y guarda (Cmd + S).
5. Corre `preparar`:
   1. En el menú de funciones elige `preparar` → Ejecutar.
   2. Revisar permisos → elige info@misemago.com.
   3. Si dice "Google no ha verificado esta app", es normal porque el programa
      es nuestro: Configuración avanzada → Ir a Etiquetas Drive → Permitir.
   4. Abajo, en el Registro de ejecución, sale **"Clave para el cerebro: …"**.
      Déjala ahí.
6. Publícalo como aplicación web:
   1. Implementar → Nueva implementación → engrane → Aplicación web.
   2. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**.
   3. Implementar (si pide permisos otra vez, igual que arriba).
   4. Copia la **URL de la aplicación web** (termina en `/exec`).

**4.4 Pon las llaves en el cerebro.** En Terminal:

```
sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs"
```

Va preguntando una por una. Nada se ve al pegar: pega y Enter.

| Pregunta | Qué pones |
|---|---|
| Llave de Claude | la de 4.1 |
| Llave de ElevenLabs | la de 4.2 |
| Llave (token) del bot de Ana Sofi | **Enter** (va el día de la mudanza, fase 7) |
| Tu número de cuenta de Telegram | **Enter** (llega solo desde NEX) |
| Dirección de Drive | la URL de 4.3 |
| Clave de Drive | la clave del Registro de ejecución de 4.3 |

Para copiar cada una, cambia a la pestaña donde está, cópiala y regresa a
Terminal.

**4.5 Cierra todo.**
- Cierra sesión en console.anthropic.com y en elevenlabs.io.
- Cierra la ventana de incógnito.
- En Chrome borra el historial (Cmd + Shift + Delete → Desde siempre).

**Quedó bien si:**

```
sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs" estado
```

dice:
- Claude ✅
- ElevenLabs ✅
- Drive ✅
- Bot ❌ y Dueño ❌ (normal por ahora)

---

## Fase 5 — Conectar NEX con el cerebro (5 min, en tu Mac)

```
cd ~/Desktop/nexy && node scripts/cerebro.mjs conectar mi-semago 100.x.x.x soporte
```

(con la dirección 100… de 2.8)

```
cd ~/Desktop/nexy && node scripts/cerebro.mjs estado
```

**Quedó bien si:**
- dice "servicio cargado", "último latido: ahora" y "Sello: ✅ correcto";
- los avisos de "Ana Sofi no tiene bot todavía" y "Falta el dueño" son
  normales por ahora.

Reinicia NEX (Ctrl + C y `npm start`) para que empiece la vigilancia. En los
logs debe salir "brain watch on (mi-semago)".

---

## Fase 6 — Candados finales y pruebas (25 min)

**6.1 Bloquear Terminal al usuario del cliente.**
1.  → Cerrar sesión de Soporte NXUS. Entra como **Mi Semago** y sáltate lo
   que pregunte (Apple ID: Configurar más tarde).
2. Ajustes del Sistema → Tiempo en pantalla:
   1. Actividad de apps y sitios web: Activar.
   2. Límites de apps → Añadir límite → busca **Terminal** → 1 minuto, todos
      los días → Listo.
   3. En Tiempo en pantalla, prende "Bloquear ajustes de Tiempo en pantalla"
      con un **código** que solo tú sepas. Guárdalo en Contraseñas.

**6.2 Prueba de apagón.**
1.  → Reiniciar.
2. Al prender, en la pantalla de FileVault elige **Mi Semago** y escribe su
   contraseña.
3. En tu Mac:
   ```
   node scripts/cerebro.mjs estado
   ```
   Debe decir "último latido: ahora". Si no contesta (Tailscale no se
   reconectó solo), para aquí y avísame.

**6.3 Prueba de alarmas.**
1. Con NEX prendida en tu Mac, en el Mac mini cambia a Soporte NXUS
   ( → Cerrar sesión, o el menú de usuarios).
2. En Terminal escribe `sudo -k && sudo ls` y escribe **mal** la contraseña 3
   veces.
3. En 5 a 10 minutos te deben llegar a Telegram:
   - 🚨 "alguien escribió mal la contraseña de administrador";
   - 🔐 la entrada de Soporte NXUS.

---

## Fase 7 — Mudanza de Ana Sofi (15 min)

Hazla en un rato tranquilo, sin pedidos de etiquetas pendientes.

1. **En tu Mac:**
   ```
   cd ~/Desktop/nexy && node scripts/cerebro.mjs mudar-anasofi
   ```
   Debe decir "✅ Las 30 empresas de etiquetas, su grupo y sus voces ya están
   en el cerebro".
2. **Reinicia NEX** (Ctrl + C y `npm start`). En los logs debe salir "Ana Sofi
   answers from the client's brain now".
3. **La llave del bot, en el Mac mini** (como Soporte NXUS):
   1. Abre una ventana de incógnito → https://web.telegram.org → entra con tu
      Telegram.
   2. En @BotFather: /mybots → Ana Sofi → API Token → copia el token.
   3. En Terminal:
      ```
      sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs"
      ```
      Enter en todo, menos en "Llave (token) del bot de Ana Sofi", donde pegas
      el token.
   4. Cierra sesión en Telegram Web y cierra la ventana de incógnito.
4. **Prueba en el grupo de etiquetas:**
   - escribe "¿cuántas empresas tienes?";
   - manda una nota de voz (debe contestar con su voz);
   - imprime 1 etiqueta de prueba.
5. **En tu Mac:**
   ```
   node scripts/cerebro.mjs estado
   ```
   Debe decir "Ana Sofi: prendida".

**Si algo sale mal:**

```
cd ~/Desktop/nexy && node scripts/cerebro.mjs regresar-anasofi
```

Después reinicia NEX: Ana Sofi vuelve a contestar desde tu Mac como antes.

---

## Al terminar

- En el Mac mini, como Soporte NXUS:
  ```
  rm -rf ~/Downloads/Cerebro-*
  ```
  Luego cierra la sesión.
- Borra la carpeta de la USB.
- Deja el Mac mini en la sesión de Mi Semago o en la pantalla de inicio,
  conectado al no-break y en su lugar con llave.
- En tu Mac quedan en Contraseñas:
  - la contraseña de Soporte NXUS;
  - la llave de recuperación de FileVault;
  - el código de Tiempo en pantalla.
