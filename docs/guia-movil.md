# Guía: Nexy en tu iPhone (botón de acción y "Oye Siri, Nexy")

Presionas el **botón de acción** del iPhone (o dices **"Oye Siri, Nexy"**), hablas, y Nexy te contesta **con su voz**. Es la misma conversación que Telegram: lo que le dices por un lado lo recuerda por el otro.

## Cómo funciona
- Nexy vive en tu MacBook Pro, encendida y conectada a la corriente.
- El iPhone llega a ella por **Tailscale**, una red privada que solo une **tus** dispositivos. Nada de la Mac queda abierto a internet.
- Cada pedido lleva una **llave** que solo tienen tu Mac y tu atajo.
- Lo delicado (publicar, enviar, gastar, borrar) **sigue pidiéndote aprobación** en Telegram.
- Si algo tarda más de ~50 segundos, Nexy te dice "sigo trabajando" y el resultado te llega por **Telegram**.

## 1. La MacBook siempre despierta (una vez)
1. **System Settings** → **Battery** → **Options…** → activa **Prevent automatic sleeping on power adapter when the display is off** → **Done**.
2. Deja la MacBook **abierta y conectada** a la corriente (cerrada se duerme).
3. Que Nexy arranque sola y se levante si se cae:
   `cd ~/Desktop/nexy && node scripts/siempre.mjs`

## 2. Tailscale en la Mac y en el iPhone (una vez)
1. En la Mac: https://tailscale.com/download → **Download for macOS** → ábrelo → **Log in** (con Google o Apple).
2. En el iPhone: App Store → **Tailscale** → **Get** → ábrela → **Log in** con **la misma cuenta** → **Allow** a la VPN.
3. En la app de Tailscale del iPhone debe aparecer tu MacBook como **Connected**.

## 3. La llave del celular (una vez)
`cd ~/Desktop/nexy && node scripts/movil.mjs`
- Copia la llave al portapapeles (el iPhone lo comparte con la Mac si usan el mismo Apple ID y tienen Bluetooth y Wi-Fi).
- Te muestra la **dirección** para el atajo, por ejemplo `http://eduardos-macbook-pro:8789/movil`.
- Reinicia Nexy (Ctrl + C y `npm start`). En la Terminal debe salir `phone on`.

## 4. El atajo "Nexy" en el iPhone
1. Abre **Shortcuts** → **+** (arriba a la derecha) → nombre: **Nexy**.
2. **Add Action** → busca **Dictate Text** → agrégala. Toca **Language** → **Spanish (Mexico)**; **Stop Listening** → **After Pause**.
3. **Add Action** → **Get Contents of URL**:
   - URL: la dirección del paso 3.
   - Toca la flecha **›** → **Method**: **POST**.
   - **Headers** → **Add new header**: Key `Authorization`, Text `Bearer ` y pega la llave (con un espacio después de Bearer).
   - **Request Body**: **JSON** → **Add new field** → **Text** → Key `texto` → en el valor toca **Dictated Text**.
4. **Add Action** → **Play Sound** (recibe **Contents of URL**).
5. **Done**.

## 5. El botón de acción
**Settings** → **Action Button** → desliza hasta **Shortcut** → **Choose a Shortcut…** → **Nexy**.

Listo: presiona el botón, habla, y Nexy contesta. También funciona diciendo **"Oye Siri, Nexy"**.

## Comandos
```
node scripts/movil.mjs              # la llave (la copia) y la dirección
node scripts/movil.mjs llave        # copiar la llave otra vez
node scripts/movil.mjs nueva-llave  # si pierdes el iPhone: la anterior deja de servir
node scripts/movil.mjs estado       # si la puerta del celular está abierta
```
