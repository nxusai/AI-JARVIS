# Abuelito Go

Plataforma de rutas y entregas de **El abuelito INC**, distribuidora de productos fríos.

- **Panel web** (`apps/web`) para administradores y despachadores: clientes, productos, camionetas, usuarios, órdenes, armado y optimización de rutas, mapa en vivo y cierre de ruta.
- **App iPhone** (`apps/driver`) para los choferes: ruta del día, ficha del cliente, navegación, entrega total, parcial o fallida, foto, firma, temperatura y cobro. Funciona sin señal.
- **Base de datos** (`supabase/`): Postgres en Supabase, con login, permisos por rol, tiempo real y almacenamiento de fotos.
- **Lógica compartida** (`packages/shared`): tipos, optimizador de rutas y utilidades.

## Cómo funciona un día

1. La oficina captura las **órdenes** del día (cliente, productos, cantidades).
2. Arma una **ruta**: elige chofer y camioneta, agrega las órdenes y presiona **Optimizar orden**.
3. **Publica** la ruta y el chofer la ve en su iPhone.
4. El chofer anota la temperatura de la caja e **inicia la ruta**. El GPS empieza a reportar la camioneta.
5. En cada parada **navega** con Apple Maps, Google Maps o Waze y registra la entrega: completa, parcial (cantidades) o no entregada (motivo), con temperatura, foto, firma y cobro (efectivo o transferencia).
6. Al terminar, la app muestra el **efectivo a entregar**. La oficina captura lo recibido y **cierra la ruta**. Las diferencias quedan registradas.

La oficina puede mover paradas entre rutas o reordenarlas durante el día; el chofer recibe el cambio al momento.

## Roles

| Rol | Dónde | Puede |
| --- | --- | --- |
| `admin` | Panel | Todo, incluido crear usuarios y darlos de baja |
| `despachador` | Panel | Órdenes, rutas, catálogos, mapa y cierre |
| `chofer` | iPhone | Solo sus rutas publicadas; registrar entregas, cobros y temperaturas |

Los permisos se aplican en la base de datos con Row Level Security: aunque alguien manipule la app, un chofer no puede leer rutas o clientes que no le tocan. Los choferes no escriben directo en las tablas; lo hacen con las funciones `iniciar_ruta`, `registrar_entrega` y `terminar_ruta`, que validan cada paso.

## Requisitos

- Node.js 20 o más reciente.
- Una cuenta de [Supabase](https://supabase.com) (el plan gratuito sirve para empezar) o Docker para correrlo en local.
- Para la app: un iPhone con **Expo Go** para desarrollo y una cuenta de **Apple Developer** (99 USD al año) para instalarla en los teléfonos de la empresa.

## Puesta en marcha

```bash
npm install
```

### 1. Base de datos

**Opción A: Supabase en la nube**

1. Crea un proyecto en supabase.com.
2. Instala el CLI y vincula el proyecto: `npx supabase login` y `npx supabase link --project-ref <id-del-proyecto>`.
3. Sube el esquema: `npx supabase db push`.
4. Publica la función de alta de usuarios: `npx supabase functions deploy crear-usuario`.
5. En **Project Settings → API** copia la URL, la llave `anon` y la llave `service_role`.

**Opción B: local con Docker**

```bash
npx supabase start      # imprime la URL y las llaves locales; aplica la migración y seed.sql
npx supabase functions serve crear-usuario
```

### 2. Datos de la empresa

Registra la ubicación de la bodega; el optimizador la usa como punto de salida y regreso. En el editor SQL de Supabase:

```sql
update empresas set base_direccion = 'Dirección de la bodega', base_lat = 20.0000, base_lng = -103.0000;
```

### 3. Primer administrador

```bash
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  npm run crear-admin -- dueño@elabuelito.com "ContraseñaSegura" "Nombre del dueño"
```

Si no existe una empresa, el script crea "El abuelito INC". Los demás usuarios (despachadores y choferes) se crean desde **Usuarios** en el panel.

### 4. Panel web

```bash
cp apps/web/.env.example apps/web/.env.local   # llena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run web                                    # http://localhost:5173
```

Para producción: `npm run build -w @abuelito/web` genera `apps/web/dist`, que se publica en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages).

### 5. App del chofer

```bash
cp apps/driver/.env.example apps/driver/.env   # llena EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run chofer                                  # escanea el código QR con la cámara del iPhone (Expo Go)
```

En Expo Go, el GPS en segundo plano tiene limitaciones; para probarlo completo usa una build de desarrollo.

## Instalar en los iPhone de la empresa

La app no se publica en la App Store pública:

1. Crea la cuenta de Apple Developer (de preferencia a nombre de la empresa desarrolladora).
2. Ajusta `ios.bundleIdentifier` en `apps/driver/app.json` si quieres otro identificador.
3. Instala EAS (`npm i -g eas-cli`), inicia sesión (`eas login`) y configura (`cd apps/driver && eas build:configure`).
4. Genera la build: `eas build --platform ios --profile production`.
5. Envíala a TestFlight: `eas submit --platform ios`. Invita a los choferes desde App Store Connect.
6. Más adelante puedes distribuirla como app privada (Apple Business Manager) para que no caduque cada 90 días como en TestFlight.

## Importar clientes desde Excel

En **Clientes → Importar Excel**, sube un `.xlsx` cuya primera fila tenga estos encabezados (los que no uses se pueden omitir; Nombre y Dirección son obligatorios):

`Código · Nombre · Contacto · Teléfono · Dirección · Latitud · Longitud · Horario desde · Horario hasta · Notas · Condición de pago · Límite de crédito`

Un cliente con un código que ya existe se actualiza en lugar de duplicarse. Si no tienes latitud y longitud, usa **Ubicar dirección** al editar el cliente (búsqueda gratuita de OpenStreetMap) o captúralas desde Google Maps.

## Sin señal

Todo lo que registra el chofer se guarda primero en el teléfono, en una cola, y se envía en orden cuando hay conexión: al recuperar la señal, al volver a abrir la app y cada minuto. Cada registro lleva un identificador único, así un reintento nunca duplica una entrega ni un cobro. Las fotos se copian a la carpeta de documentos de la app para que no se pierdan antes de subirse. Si la oficina rechaza un registro (por ejemplo, porque movió esa parada a otra ruta), la app lo muestra para que el chofer lo revise.

## Saldos y cobranza

En cada entrega, al saldo del cliente se le suma el importe entregado y se le resta lo cobrado. Así funcionan igual los clientes de contado y los de crédito, y el chofer puede abonar a saldos anteriores cobrando más que el pedido del día. El cierre compara el efectivo esperado (la suma de cobros en efectivo de la ruta) con el que entrega el chofer.

## Pruebas

```bash
npm test             # optimizador y utilidades
npm run typecheck    # panel, app y paquete compartido
npm run probar-db    # migración + flujo completo en un Postgres local (sin Supabase ni Docker)
```

`probar-db` necesita `psql` y un Postgres local. Simula lo mínimo de Supabase y recorre un día completo: el despachador arma y publica la ruta, el chofer entrega (completa, parcial y no entregada), reintenta sin señal, cobra en efectivo y transferencia, y el despachador cierra la ruta. Verifica que cada chofer solo vea lo suyo.

## Estructura

```
apps/
  web/                 Panel (React + Vite + Leaflet)
  driver/              App iPhone (Expo + Expo Router)
    src/app/           Pantallas: entrar, mi ruta, parada
    src/lib/           Sesión, ruta del día, cola sin señal, GPS, navegación
packages/
  shared/              Tipos, optimizador de rutas, formato
supabase/
  migrations/          Esquema, permisos y funciones de negocio
  functions/           crear-usuario (alta de usuarios por el admin)
  seed.sql             Datos de ejemplo para desarrollo
  tests/               Prueba de punta a punta en Postgres
scripts/               crear-admin, probar-db
```

## Siguientes fases

- **Fase 2:** lectura automática de los sensores de temperatura de las camionetas (`camionetas.sensor_id`, `lecturas_temperatura.momento = 'sensor'`), alertas y reportes.
- **Fase 3:** aviso por WhatsApp al cliente, ventanas de horario y capacidad en la optimización (Google Route Optimization o VROOM detrás de `optimizarRuta`).
- **Fase 4:** facturación e inventario sobre esta misma base de datos.
