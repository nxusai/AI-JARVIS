# Guía: Inventario Mi Semago

Lo que llega de los proveedores, lo que se pide y lo que sale del almacén. Cada quien entra con su correo y su contraseña. Está en `inventario/`:
- `public/`: la página. Funciona en el celular y en la computadora, con el vidrio esmerilado y los colores del logo.
- `supabase/esquema.sql`: la base de datos con sus candados.
- `netlify/functions`: Ana Sofi (`ia`), altas de personas (`usuarios`) y la puerta de Telegram (`anasofi`).

## La regla de oro: lo cerrado no se cambia

- **Cerrar y enviar recepción**, **Realizar pedido**, **Orden comprada** y **Registrar salida** dejan el registro cerrado. Ya nadie lo cambia, ni el dueño.
- Si alguien se equivocó, usa **Hacer corrección**:
  - es un registro nuevo que apunta al anterior y dice por qué;
  - los dos quedan a la vista y vale el más nuevo;
  - así los errores no se esconden.
- Las horas las pone el servidor, no el teléfono de nadie: la llegada, la inspección, cada foto, el cierre y la compra.
- Lo cuida la base de datos, no la página: aunque alguien se brincara la página, no podría cambiarlo.
- **Solo tú (admin)** borras, reabres una recepción cerrada, das de alta personas y ves la **Bitácora**. La bitácora guarda cada cambio con quién y cuándo, y una copia de lo que se borra.

| Quién | Qué hace |
|---|---|
| **Almacén** (empleados) | Recibe mercancía, pide lo que falta, registra salidas y hace correcciones. Ve todo el inventario y el historial. |
| **Compras** (la secretaria) | Lo mismo, y marca **Orden comprada**. Edita el catálogo. |
| **Dueño** | Todo lo anterior. No borra. |
| **Admin** (Eduardo) | Todo. |

## Recibir mercancía (lo que pidió el cliente)

Botón **Llegó un proveedor**. La hora de llegada queda en ese momento. Son cuatro pasos:

1. **Packing slip.**
   - El empleado le toma foto.
   - Ana Sofi la lee y llena sola el proveedor, el número, la fecha y los productos, con lote, caducidad y precio si vienen.
   - Reconoce los proveedores y productos que ya están en el catálogo.
   - Si el proveedor no trajo la hoja, se marca **no trajo el packing slip** y eso queda como problema.
2. **Lo que llegó.**
   - El empleado cuenta lo que de verdad llegó: Ana Sofi no llena esa cantidad, para que alguien cuente.
   - El botón **Llegó igual que la hoja** la copia cuando todo cuadra.
   - Lo roto o mojado va en **dañados**.
   - El sistema avisa solo si faltan o sobran.
3. **Inspección.** Fotos de la mercancía y de lo roto (la primera foto marca la hora de inspección), la temperatura al llegar, si el camión venía limpio y una nota con sus palabras.
4. **Revisión de Ana Sofi.**
   - Ve las fotos, los números y la nota.
   - Ordena los problemas: faltante, dañado, caducado, mala calidad, producto equivocado, sin packing slip, temperatura o transporte.
   - Escribe un resumen claro y calcula cuánto vale lo perdido si la hoja traía precios.

Al final: **Cerrar y enviar recepción**. No deja cerrar si falta el proveedor, lo que llegó, la foto del packing slip (o marcar que no lo trajo) o una foto de la mercancía.

Después, **Imprimir reporte** saca una hoja tamaño carta con todo: horas, productos, lotes, problemas, fotos y espacio para firmas.

## Pedidos

- **Pedir algo**: el empleado anota qué necesita y cuánto. El proveedor es opcional y puede marcarlo **urgente**. Queda con su nombre, el día y la hora.
- Compras lo ve en **Por comprar**. Cuando lo compra, toca **Orden comprada** y anota el proveedor, el número de orden y cuándo llega. Los empleados lo ven como **Comprado**.
- Cuando llega, en la recepción se elige **¿Es de un pedido?** y el pedido pasa solo a **Recibido**.
- Si el pedido estaba mal, **Hacer corrección**. Si ya no se necesita, se marca **cancelar**. Compras no puede comprar un pedido corregido: el sistema le dice cuál comprar.

## Más

- **Inventario:** cuánto hay de cada producto y en qué lote. Es lo bueno que llegó menos lo que salió, y el lote que caduca primero sale primero. Avisa cuando algo caduca en 30 días o menos, cuando ya caducó y cuando queda menos del **mínimo** (se pone en Catálogo).
- **Registrar salida:** lo que se usa en producción, se tira (merma) o se regresa al proveedor.
- **Problemas:** por proveedor y por fechas, cuántas entregas vinieron mal, qué pasó y cuánto vale. Se imprime para reclamarle al proveedor.
- **Historial:** un calendario con lo que pasó cada día. Puedes ver un día o un rango, con cada momento y su hora. Se imprime.
- **Catálogo:** proveedores y productos. Se llena solo cuando se cierra una recepción con algo nuevo.

## Instalarlo (una sola vez)

Son cuatro piezas, en este orden: Anthropic (el cerebro de Ana Sofi), Supabase (los datos), Netlify (la página) y las personas. Las llaves nunca se pegan en un chat ni en el código: solo en Netlify y en **Contraseñas** de tu Mac.

### 1. Anthropic: la llave de Ana Sofi (10 min)
1. Entra a https://console.anthropic.com con la cuenta de NXUS (o crea una).
2. **Settings** → **Billing**: agrega una tarjeta y compra créditos. Con $20 USD alcanza para empezar. Puedes encender **auto-reload** para que no se quede sin saldo.
3. **Settings** → **Workspaces** → **Create workspace**, nombre `Mi Semago`. Así lo que gasta Mi Semago se ve aparte y le puedes poner su propio tope.
4. En ese workspace, **Limits**: pon un tope de gasto al mes (por ejemplo $50 USD). Si se llega al tope, Ana Sofi deja de leer hasta el mes siguiente, pero el inventario sigue funcionando a mano.
5. **Settings** → **API Keys** → **Create Key**:
   - Workspace: `Mi Semago`.
   - Nombre: `inventario-mi-semago-netlify`.
   - Copia la llave (empieza con `sk-ant-`). Solo se enseña una vez. Guárdala en **Contraseñas** de tu Mac como "Anthropic inventario Mi Semago".

**Cuánto cuesta (aproximado):** leer un packing slip son unos 5 centavos de dólar, y la revisión con fotos unos 10 centavos. Una recepción completa ronda los 15 centavos. Con 5 entregas al día son unos $20 USD al mes. Lo real lo ves en **Usage** del Console.

### 2. Supabase: la base de datos (10 min)
Un proyecto **nuevo y aparte**, solo de Mi Semago.
1. https://supabase.com/dashboard → **New project**:
   - Nombre: `inventario-mi-semago`.
   - Database Password: **Generate a password** y guárdala en **Contraseñas** de tu Mac.
   - Región: **East US (North Virginia)**.
   - **Create new project** y espera 1 a 2 minutos.
2. **SQL Editor** → **New query**. Pega todo `inventario/supabase/esquema.sql` (en tu Mac: `pbcopy < ~/Desktop/nexy/inventario/supabase/esquema.sql`) → **Run**. Debe decir **Success. No rows returned**. Si algún día se mejora el esquema, se vuelve a pegar completo: no se pierde nada.
3. **Authentication** → **Users** → **Add user** → **Create new user**: tu correo, una contraseña y **Auto Confirm User** encendido. El primer usuario es el **admin**: tú.
4. **Authentication** → **Sign In / Providers**: apaga **Allow new users to sign up** → **Save**. Nadie se registra solo.
5. **Project Settings** → **Data API** (o el botón **Connect**): copia el **Project URL**.
6. **Project Settings** → **API Keys**:
   - **Publishable key** (o la `anon` de **Legacy API keys**): va como `SUPABASE_ANON_KEY`.
   - **Secret key** (o `service_role`) → **Reveal**: va como `SUPABASE_SERVICE_KEY`. Es secreta: solo va en Netlify.

### 3. Netlify: la página (10 min)
1. https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub** → `nxusai/AI-JARVIS`.
2. Configúralo así:
   - **Project name:** `inventario-mi-semago`
   - **Branch to deploy:** la rama donde está el inventario (hoy `claude/great-wozniak-ggxpp3`; cuando se una a `main`, cámbiala a `main`).
   - **Base directory:** `inventario`
   - **Build command:** vacío. **Publish directory:** `inventario/public` (lo pone solo el `netlify.toml`).
3. En **Environment variables** → **Add a variable** → **Add a single variable**, una por una. Marca **Contains secret values** en las tres secretas:

   | Variable | Valor | ¿Secreta? |
   |---|---|---|
   | `SUPABASE_URL` | el Project URL | no |
   | `SUPABASE_ANON_KEY` | la publishable / anon | no |
   | `SUPABASE_SERVICE_KEY` | la secret / service_role | **sí** |
   | `ANTHROPIC_API_KEY` | la llave `sk-ant-…` | **sí** |

4. **Deploy**. Tarda uno o dos minutos.
5. Si después cambias o agregas una variable: **Deploys** → **Trigger deploy** → **Deploy project**. Las variables solo se leen al publicar.
6. Copia la dirección que te dio Netlify (`https://inventario-mi-semago.netlify.app`). Ponla en Supabase → **Authentication** → **URL Configuration** → **Site URL** → **Save**. Es para que funcione "¿Olvidaste tu contraseña?".
7. Opcional, una dirección propia (por ejemplo `inventario.misemago.com`):
   - En Netlify: **Domain management** → **Add a domain**.
   - En el DNS del dominio: un **CNAME** con host `inventario` que apunta a `inventario-mi-semago.netlify.app`.
   - Luego cambia también la **Site URL** de Supabase.

### 4. Probar a Ana Sofi (5 min)
1. Entra con tu correo. Si sale la pantalla de "Muestra", falta `SUPABASE_URL` o `SUPABASE_ANON_KEY`, o no se volvió a publicar.
2. **Llegó un proveedor** → **Foto del packing slip**: tómale foto a cualquier factura o packing slip real.
3. En unos segundos Ana Sofi llena el proveedor y los productos y escribe arriba lo que leyó. Si sale un aviso rojo:

   | El aviso dice | Qué hacer |
   |---|---|
   | Falta ANTHROPIC_API_KEY en Netlify | Agrégala (paso 3.3) y **Trigger deploy**. |
   | La llave de Anthropic no sirve | Se copió mal o se borró: crea otra y cámbiala. |
   | La cuenta de Anthropic no tiene saldo | **Billing** en el Console, o subir el tope del workspace. |
   | Ana Sofi no respondió a tiempo | Intenta otra vez con menos fotos. Si se repite, revisa **Logs** → **Functions** → `ia` en Netlify. |

4. Cuenta, toma una foto de la mercancía, **Revisar con Ana Sofi** y **Cerrar y enviar recepción**. Esa recepción de prueba la puedes borrar tú (admin) después.

### 5. Las personas
1. **Personas** → **+ Dar de alta**: el dueño (rol **Dueño**), la secretaria (**Compras**) y cada empleado (**Almacén**), cada quien con su correo y una contraseña que tú le das.
2. En el celular de cada empleado: abrir la página en Safari → **Compartir** → **Agregar a inicio**. Queda como app, con el ícono del quesillo.
3. **Catálogo**: el mínimo de cada producto, cuando ya existan. Los proveedores y productos se van creando solos con las recepciones.

### Si una llave se filtra
- **Anthropic:** en el Console, **API Keys** → borra la llave y crea otra. Cámbiala en Netlify y **Trigger deploy**.
- **Supabase secret:** en **API Keys**, crea una nueva secret key, cámbiala en Netlify, publica y luego borra la vieja.

## Telegram con Ana Sofi (listo, sin conectar)

La puerta ya existe: `/.netlify/functions/anasofi`.
- Solo lee: contesta, pero no cambia nada.
- Solo entra quien trae la clave `ANASOFI_CLAVE`.
- Las herramientas para Ana Sofi están en `bridge/nucleo/inventario.mjs`: resumen del día o rango, pendientes de compra, recepciones, una recepción por folio, problemas por proveedor, existencias y caducidades.

Para conectarla, cuando se decida:
1. Inventa una clave larga (`openssl rand -hex 24`).
2. Ponla en Netlify del inventario como `ANASOFI_CLAVE` (secreta) y haz **Trigger deploy**.
3. En `anasofi.json` del cerebro: `inventario_url` (la dirección del inventario) e `inventario_clave` (la misma clave).
4. En `bridge/nucleo/anasofi.mjs`, montar `inventarioTools(...)` junto a las etiquetas, **solo en el chat del dueño**. Las instrucciones están arriba de `bridge/nucleo/inventario.mjs`.
5. Opcional: `ZONA` en Netlify si el negocio no está en hora de Nueva York (`America/New_York` es la de siempre).

## La muestra
Para verla sin instalar nada: `node scripts/inventario-muestra.mjs` arma `inventario-muestra.html`. Ábrelo y entra como cualquier persona. Ana Sofi ahí finge: siempre "lee" el mismo packing slip de ejemplo.
