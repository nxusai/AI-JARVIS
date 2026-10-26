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

### 1. Base de datos (Supabase)
Un proyecto **nuevo y aparte**, solo de Mi Semago.
1. https://supabase.com/dashboard → **New project**:
   - Nombre: `inventario-mi-semago`.
   - Guarda la contraseña de la base en **Contraseñas** de tu Mac.
   - Región: **East US**.
2. **SQL Editor** → **New query**. Pega todo `inventario/supabase/esquema.sql` (en tu Mac: `pbcopy < ~/Desktop/nexy/inventario/supabase/esquema.sql`) → **Run**. Debe decir **Success**.
3. **Authentication** → **Users** → **Add user** → **Create new user** con tu correo, una contraseña y **Auto Confirm User** encendido. El primer usuario es el **admin**: tú.
4. **Authentication** → **Sign In / Providers**: apaga **Allow new users to sign up**. Nadie se registra solo.
5. **Authentication** → **URL Configuration** → **Site URL**: la dirección del inventario.
6. **Project Settings** → **API Keys**: el **Project URL**, la llave **publishable/anon** y la **secret/service_role**. No las pegues en ningún chat.

### 2. La página (Netlify)
1. https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub** → `nxusai/AI-JARVIS`:
   - **Project name:** `inventario-mi-semago`
   - **Base directory:** `inventario`
2. **Environment variables**:
   - `SUPABASE_URL`: el Project URL.
   - `SUPABASE_ANON_KEY`: la llave anon / publishable.
   - `SUPABASE_SERVICE_KEY`: la llave secreta. Solo la usa el servidor para dar de alta personas y para Ana Sofi.
   - `ANTHROPIC_API_KEY`: para que Ana Sofi lea el packing slip y revise.
3. **Deploy**. Si lo abres antes de poner las llaves, enseña la **muestra**.

### 3. Empezar
1. Entra con tu correo.
2. **Personas** → **+ Dar de alta**: el dueño (rol **Dueño**), la secretaria (**Compras**) y cada empleado (**Almacén**).
3. **Catálogo**: el mínimo de cada producto, cuando ya existan. Se van creando solos con las recepciones.
4. En el celular de cada empleado: abrir la página en Safari → **Compartir** → **Agregar a inicio**. Queda como app.

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
