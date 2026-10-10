# Aurelius · Checador y nómina

**Aurelius — Conquistando el come todo**

Este sistema tiene dos pantallas que funcionan desde cualquier navegador:

| Pantalla | Dónde se usa | Quién la usa |
|---|---|---|
| **Checador** (`/checador`) | La computadora del restaurante | Los empleados, con su código de 4 a 6 números |
| **Consola** (`/admin`) | Tu computadora o tu celular | Sólo tú, con tu correo y contraseña |

Todo se guarda en internet y usa la hora de la Ciudad de México. Lo que pasa en el restaurante lo ves al momento desde donde estés.

**Costo: $0 al mes.** Usa el plan gratis de Supabase (base de datos) y el de Vercel (página web).

---

## Qué hace

**Checador (computadora del restaurante)**
- El empleado escribe su código y toca **ENTRADA** o **SALIDA**.
- Al checar se toma una foto con la cámara, para que nadie cheque por otro.
- La hora la pone el servidor, no la computadora, así que nadie puede adelantar el reloj.
- Sólo funciona en computadoras que tú autorizas. Nadie puede checar desde su casa o su celular.
- Si alguien toca dos veces, no se duplica. Después de 5 códigos equivocados el checador se bloquea 5 minutos.

**Consola (sólo tú)**
- **Hoy:** quién llegó, a qué hora, quién va tarde y quién está trabajando, con su foto.
- **Calendario:** el mes completo de todos o de una persona. Ves asistencias, retardos, faltas y horas extra. Toca cualquier día para ver las fotos, corregir registros o cambiar el horario de ese día.
- **Cambiar horario de varios días:** para una semana con otro horario, vacaciones o permisos, sin tocar el horario normal.
- **Nómina quincenal** (del 1 al 15 y del 16 a fin de mes): calcula cuánto pagarle a cada quien en pesos. Puedes descargarla en Excel o imprimirla y cerrar la quincena cuando ya pagaste.
- **Empleados:** alta y baja, sueldo, código y horario semanal.
- **Historial:** todo lo que corriges queda anotado.

### Cómo se calcula el pago

- **Salario diario** = sueldo quincenal ÷ 15.
- **Valor de la hora** = salario diario ÷ 8 (se puede cambiar en Ajustes).
- **Tolerancia: 10 minutos** (se puede cambiar en Ajustes). Si llega a las 9:10 es a tiempo. Si llega a las 9:11 es retardo y se descuentan los 11 minutos.
- **Salió antes:** si se va más de 10 minutos antes de su hora, se descuentan esos minutos.
- **Falta:** si no checó un día que le tocaba, se descuenta un día de salario.
- **Horas extra:** **sólo se pagan si tú las autorizas**, por ejemplo cuando se quedaron porque había clientes. El sistema te muestra cuánto se quedó cada quien después de su hora y tú decides cuántos minutos pagar. Por ley se pagan al **doble** las primeras 9 horas extra de la semana y al **triple** las siguientes (LFT arts. 67 y 68).
- **Ingreso o baja a media quincena:** se paga sólo por los días que trabajó ahí.

> **Nota legal:** la Ley Federal del Trabajo no permite poner multas. El sistema sólo descuenta el tiempo no trabajado, que sí está permitido. Esto no sustituye la asesoría de un contador o abogado laboral.

---

## Instalación paso a paso (una sola vez, unos 30 minutos)

### Paso 1. Crear la base de datos en Supabase

1. Entra a <https://supabase.com> y crea una cuenta gratis (puedes entrar con tu cuenta de GitHub).
2. Presiona **New project**.
   - **Name:** `aurelius`
   - **Database password:** inventa una y guárdala.
   - **Region:** la más cercana, por ejemplo *East US* o *West US*.
3. Espera 1 o 2 minutos a que el proyecto quede listo.
4. En el menú izquierdo entra a **SQL Editor** y presiona **New query**.
5. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repositorio. Copia **todo** y pégalo.
6. **Importante:** en la **última línea** cambia `TU-CORREO@ejemplo.com` por **tu correo**.
7. Presiona **Run**. Debe decir *Success*.

### Paso 2. Crear tu usuario de dueño

1. En Supabase entra a **Authentication → Users → Add user → Create new user**.
2. Escribe **el mismo correo** que pusiste en el paso anterior y una contraseña segura.
3. Marca **Auto Confirm User** y presiona **Create user**.
4. Entra a **Authentication → Sign In / Providers** y **desactiva** *Allow new users to sign up*. Así nadie más puede crearse una cuenta.

### Paso 3. Conectar la página con tu base de datos

1. En Supabase entra a **Project Settings** (el engrane).
   - En **Data API** copia el **Project URL** (algo como `https://abcdxyz.supabase.co`).
   - En **API Keys** copia la **publishable key** o la **anon public key**.
2. Aquí en GitHub abre el archivo [`js/config.js`](js/config.js), presiona el lápiz ✏️ para editarlo y pega los dos datos:
   ```js
   export const SUPABASE_URL = 'https://abcdxyz.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```
3. Presiona **Commit changes**.

Estos dos datos no son secretos. Están hechos para ir en la página. La seguridad la pone la base de datos, que no deja ver ni cambiar nada sin tu usuario.

### Paso 4. Publicar la página en Vercel

1. Entra a <https://vercel.com> y crea una cuenta gratis **con tu cuenta de GitHub**.
2. Presiona **Add New → Project** y elige el repositorio **aurelius-checador**. Si no aparece, dale permiso a Vercel para ver ese repositorio.
3. En *Framework Preset* deja **Other** y no cambies nada más. Presiona **Deploy**.
4. Al terminar te da una dirección como `https://aurelius-checador.vercel.app`. Esa es tu página.
   - Consola: `https://aurelius-checador.vercel.app/admin`
   - Checador: `https://aurelius-checador.vercel.app/checador`

Cada vez que cambies algo en GitHub, Vercel actualiza la página sola.

### Paso 5. Dar de alta a tus empleados

1. Entra a la **consola** (`/admin`) con tu correo y contraseña.
2. En **Empleados → + Nuevo empleado** llena por cada persona:
   - Nombre, puesto y **sueldo quincenal**.
   - **Código para checar:** 4 a 6 números, distinto para cada quien. Díselo sólo a esa persona. Después no se puede ver, sólo cambiar.
   - **Horario semanal:** marca los días que trabaja con su hora de entrada y salida. El botón *Copiar…* pone el mismo horario en todos los días marcados.

### Paso 6. Preparar la computadora del restaurante

1. En tu consola entra a **Ajustes → Autorizar una computadora**. Te da un código de 8 letras que sirve 24 horas.
2. En la computadora del restaurante abre **Google Chrome** y entra a `https://…vercel.app/checador`.
3. Escribe el código y presiona **Autorizar**.
4. Cuando Chrome pregunte por la **cámara**, elige **Permitir**.
5. Recomendado:
   - Presiona **F11** para verlo en pantalla completa.
   - Guarda la página en favoritos y ponla como página de inicio de Chrome.
   - **No borres los datos de navegación** de esa computadora. Si se borran, sólo hay que autorizarla otra vez con un código nuevo.

Para que la computadora abra el checador sola al encenderse (Windows): crea un acceso directo de Chrome y agrégale al final del destino `--kiosk https://…vercel.app/checador`. Luego pon ese acceso directo en la carpeta de Inicio (`Win + R` → `shell:startup`).

---

## Uso diario

**Empleados:** escriben su código, tocan **ENTRADA** al llegar y **SALIDA** al irse. Con el teclado también funciona: números, `E` para entrada y `S` para salida.

**Tú, cuando quieras:** revisa **Hoy** para ver quién llegó.

**Si alguien olvidó checar:** en el **Calendario** toca ese día y usa *+ Agregar registro* o *Corregir*. Queda anotado en el historial.

**Si el horario cambia:**
- Un solo día: Calendario → toca el día → *Horario de este día*.
- Varios días, vacaciones o permisos: Calendario → **Cambiar horario de varios días**.
- Para siempre: Empleados → toca a la persona → *Horario semanal*.

**Día de pago:**
1. Entra a **Nómina**. Ya muestra la quincena actual; usa ‹ › para cambiar.
2. Si hay avisos ⚠ (días sin salida u horas extra por revisar), tócalos y resuélvelos.
3. Toca a cada empleado para ver el detalle día por día.
4. **Descargar Excel** o **Imprimir / PDF** para tus registros.
5. **Cerrar quincena (ya pagué):** guarda los totales. Si después corriges algo de esa quincena, los números cerrados no cambian. Si necesitas, puedes reabrirla.

---

## Preguntas frecuentes

**¿Qué pasa si se va el internet en el restaurante?**
El checador avisa que no hay conexión y no registra nada. Cuando regrese el internet pueden checar normalmente. Si alguien no pudo checar, agrégalo tú desde el calendario.

**¿Cuánto espacio ocupan las fotos?**
Cada foto pesa unos 25 KB. Con 5 empleados son unos 7 MB al mes. El plan gratis de Supabase tiene 500 MB, suficiente para varios años.

**Supabase dice que pausa los proyectos gratis.**
Sólo pausa proyectos sin uso durante una semana. Como el checador se usa todos los días, no se pausa. Si alguna vez pasa, entra a supabase.com y presiona *Restore*.

**Un empleado se fue.**
Empleados → tócalo → *¿Sigue trabajando aquí? → No* y pon su último día. Su código deja de funcionar y su historial se conserva.

**Cambió la tolerancia o quiero otro cálculo del valor de la hora.**
Ajustes → *Reglas de asistencia*.

**Me robaron o cambié la computadora del restaurante.**
Ajustes → *Computadoras que pueden checar* → **Quitar acceso**. Luego autoriza la nueva.

---

## Para programadores

El sitio es HTML, CSS y JavaScript sin compilar. Supabase se carga desde jsDelivr.

```
index.html, checador.html, admin.html
css/estilos.css
js/config.js       ← datos de Supabase
js/tiempo.js       ← fechas en horario CDMX, quincenas
js/nomina.js       ← cálculo de asistencia y nómina (sin dependencias)
js/checador.js     ← pantalla del checador
js/admin.js        ← consola
supabase/schema.sql
tests/
```

- `npm test` corre las pruebas del cálculo de asistencia y nómina (Node 20 o más nuevo).
- `npm run test:db` corre `schema.sql` en un PostgreSQL temporal y prueba la seguridad (quién puede ver qué), el checador, los códigos y la bitácora. Necesita PostgreSQL instalado.
- `npm run test:ui` recorre las dos pantallas en Chromium con un Supabase falso. Necesita Playwright.

Para probarlo en tu computadora: `python3 -m http.server` y abre `http://localhost:8000`.
