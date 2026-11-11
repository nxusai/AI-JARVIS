# Estado: el Centro de trabajo Mi Semago · Abuelito (el CRM del cliente)

Última actualización: 2 de noviembre de 2026. Para que cualquier chat pueda modificarlo con todo el contexto.
Lee también `docs/estado-nxus.md` (cómo trabajar con Eduardo) y, para los leads, `docs/estado-ana-sofi.md`.

## Qué es
El sistema de trabajo entre NXUS y su cliente (el mismo dueño: **Senen**) para **Abuelito INC** (Abuelito Cheese, Meat y Corn), **Mi Semago** y **VAYRO** (empresa apagada por ahora).
- En línea: https://centro-misemago-abuelito.netlify.app (Netlify, proyecto **centro-misemago-abuelito**, publica desde la rama `claude/jarvis-project-setup-gs6uu2`, base directory `crm`).
- Base de datos: un proyecto de Supabase **aparte** de NXUS HQ (Eduardo lo llama "Centro de trabajo"). Nunca mezclarlo con `nxus-hq`.
- Guías: `docs/guia-crm.md` (instalación y uso), `docs/guia-ultron.md` (Ultron).
- Muestra sin conectar nada: `node scripts/crm-muestra.mjs ~/Desktop/crm-muestra.html`. Entra como Senen, Gerardo, Marisol, Miguel, Diseñador 1 o Eduardo.

## Quién es quién (roles)
| Rol | Quién | Qué puede |
|---|---|---|
| **cliente** | Senen (dueño), Gerardo (gerente), el **gerente de ventas**, Marisol y Miguel (dirección) | Pide tareas y correcciones, aprueba, ve y descarga. **Solo ve SUS tareas** (Senen no ve las de Gerardo ni al revés). Lo que escribe nadie lo cambia. Ve la Parrilla. Ve la frase del día. Puede hablar con Ultron si el admin lo prende. |
| **equipo** | El equipo de NXUS (diseñadores) | Mueve estatus y fecha compromiso, sube PDFs, organiza biblioteca y catálogos, crea y cambia contenidos de la Parrilla. No cambia lo del cliente ni aprueba por él. |
| **admin** | Eduardo | Todo lo del equipo + usuarios, bitácora y **es el único que borra**. |

Además, el perfil de Eduardo tiene **`dueno`**: a su perfil y a su acceso solo los toca él (ni otro admin ni la llave de servicio; tampoco se puede borrar su cuenta de entrada). Solo el dueño nombra administradores. Solo se cambia directo en Supabase (SQL Editor).

Por usuario: `empresas` (null = todas), `ve_tareas`, `ve_biblioteca`, `ve_catalogos`, `ve_parrilla`, `pide_extras`, `ve_leads`, `ultron`. **Desde nov 2026 estos permisos aplican también al equipo** (`veo()` en el esquema: solo el admin ve todo); el admin los pone en Usuarios → Editar / Nuevo usuario (cuadro "Permisos"). Las **vendedoras NO tienen acceso**: solo el gerente de ventas. Su contenido les llegará después por un grupo de Telegram.

**Las reglas viven en la base de datos** (RLS y triggers en `crm/supabase/esquema.sql`): aunque alguien se brinque la página, no ve ni toca lo que no le toca. Cualquier cambio de permisos va ahí, no solo en la página.

## Secciones
- **Tareas**: el cliente pide (empresa, qué, detalles, urgente, archivos de referencia; la fecha se guarda sola) → el equipo trabaja → sube el **PDF final** (la fecha de entrega se pone sola) → el cliente descarga, se lo manda a su correo, pide **correcciones** (cada una con su PDF, nada se borra) o **aprueba** (queda cerrada y guardada). Tareas en **hojas por paso** (pedido de Senen, 11 nov): **Pedidas** (recibida) → **En proceso** (en-proceso y en-corrección) → **Para revisar** (entregada) → **Aprobadas** (por mes de aprobación, con año y meses). Cada hoja y cada tarjeta dice a quién le toca ("👉 Te toca" / "⏳ Le toca al equipo / al cliente"); la hoja que le toca a quien mira brilla. Al entrar, el cliente cae en Para revisar si tiene algo (si no, En proceso) y el equipo en Pedidas. El equipo abre una pedida y toca **📥 Recibir y empezar** (pasa a En proceso). El buscador busca en todas las hojas. Actualizaciones del cliente con fecha.
- **Parrilla de contenidos**: un botón por marca (**Parrilla Abuelito** = Cheese, Meat y Corn juntas; **Parrilla Mi Semago**; `empresas.marca`). Arriba del calendario, **"Lo que se espera en <mes>"** (tabla `plan`): cada cosa con su punto de color y cuántos van ("1 de 2"); clic en una filtra el calendario. **Fijos** por marca (sembrados: Stupid content 1, Chef Saúl 2, Imágenes IA 8, Imágenes reales 8, Video IA 1, ADS 3): solo el administrador principal los cambia en **⚙️ Lo fijo** (`plan_fijo_guardar` / `plan_fijo_quitar`; un cambio cuenta desde el mes en curso y los meses pasados se quedan —versiones con la misma `clave`—; quitar cuenta desde el mes siguiente). **Extras**: los pide quien tenga `pide_extras`, para este mes o el siguiente; guardan quién los pidió (`pedido_nombre`, visible para todos); solo el administrador principal los cambia o borra. El diseñador, al crear un contenido, elige **¿Qué es?** (`contenidos.plan_clave`; la base de datos solo deja cosas del plan de esa marca en ese mes) y en el calendario sale su punto. Los leads de ADS (meta 1 a 5 clientes nuevos) quedan para después. Quien tenga el permiso la ve; **solo equipo y admin** agregan o cambian; **solo admin** borra. Cada contenido: empresa, canal (WhatsApp, Estado, Instagram, Facebook, TikTok, otro), día, hora, título, texto, link, estado (borrador, listo, enviado) y **material** (imágenes y videos de hasta 50 MB) que **no se ve en el calendario**: al dar clic sale la vista previa con Ver, Descargar y Copiar texto. El campo `enviado` está listo para el envío automático a Telegram.
- **Leads** (de Mi Semago, los llama Ana Sofi): tablero por etapas (Nuevo, Llamada programada, No contestó, Ya habló, Meet agendado, Cerrado, No califica / No llamar) y ficha con datos, lo que contó en la llamada, resumen de Ana Sofi, llamadas, el permiso por escrito (no se puede cambiar), el Meet con **🎥 Unirse al meeting** y notas. Tablas `leads` y `leads_notas`. Los ve el admin y quien tenga **`ve_leads`** (Senen); todos ellos agregan notas; **solo el administrador principal** cambia la etapa o borra. Ana Sofi (en la computadora del sistema) escribe con la llave de servicio. Plan completo y decisiones: `docs/estado-ana-sofi.md`.
- **Biblioteca**: labels, logos, diseños y documentos por empresa y carpeta, con versiones.
- **Catálogos**: el catálogo vigente de cada empresa y sus versiones anteriores.
- **Usuarios** y **Bitácora**: solo admin. **Se entra con usuario** (`perfiles.usuario`, por ejemplo `senen`) y la contraseña que ponga el admin, desde **3 caracteres**. Por dentro (`crm/public/acceso.js`, lo usan la página y `usuarios.mjs`): el correo de entrada en Supabase es `crm.<usuario>@nxusai.org` (no recibe nada) y la contraseña se alarga siempre igual antes de ir a Supabase (pide mínimo 6); **no cambiar `acceso.js`** o las contraseñas dejan de servir. El dueño sigue entrando con su correo; las cuentas viejas también, hasta que se les ponga usuario. El correo de verdad es **opcional** (`perfiles.correo`): si lo hay, se le manda su acceso (link, usuario y contraseña) **desde contacto@nxusai.org** con `crm/google/accesos.gs` (`ACCESO_URL` y `ACCESO_CLAVE` en Netlify); si no, la página enseña los datos con **📋 Copiar para WhatsApp**. Esas contraseñas quedan como **temporales** (`clave_temporal`): al entrar se le ofrece a la persona cambiarla (o "Ahora no"). Botón **🔑 Contraseña** arriba para que cualquiera cambie la suya. El usuario y el correo solo se cambian por Usuarios → Editar (función `usuarios`, acción `acceso`). **✉️ Reenviar acceso** pone contraseña nueva y la manda (acción `clave`). **Eliminar** solo lo puede el administrador principal (`dueno`, Eduardo): sin historial borra la cuenta; con historial (FK de tareas, archivos, etc.) la marca `eliminado` (apagada, sin usuario, cuenta de entrada cerrada y bloqueada) y nadie la puede revivir. En pantalla se dice "administrador principal" en vez de "dueño" (Senen es el dueño del negocio, no del sistema).
- **Ultron**: la IA de la dirección (orbe abajo a la **izquierda**, porque abajo a la derecha Netlify pone su letrero). Resume, busca archivos y prepara tareas (con confirmación). Corre en la Mac de Eduardo bajo NEX (`bridge/ultron.mjs`, `bridge/nucleo/ultron.mjs`) y habla por un buzón en Supabase (`ultron_mensajes`, `ultron_memoria`, `ultron_tablero`). Voz de ElevenLabs; el oído es `crm/netlify/functions/oido.mjs`.
- **Frase del día** (`crm/public/frases.js`): solo para rol cliente, 60 frases aprobadas por Eduardo sobre su marca en buenas manos; cada tercer día una con sus propios números.

## Diseño
"Cristal" sobre una luz cálida (arena, madera, crema): bloque al final de `crm/public/estilo.css`. Los logos, el color de cada empresa y el orbe de Ultron no cambian. Antes de subir cambios visuales: hacer la muestra y mandarle fotos a Eduardo.

## Archivos
- `crm/public/app.js` — toda la página (vistas, ventanas, acciones).
- `crm/public/datos-supabase.js` — los datos de verdad; `crm/public/datos-muestra.js` — la muestra en memoria con las **mismas reglas** (si cambias una regla, cámbiala en los dos y en el esquema).
- `crm/public/inicio.js` — decide muestra o real según `config`.
- `crm/supabase/esquema.sql` — tablas: `empresas`, `perfiles`, `tareas`, `correcciones`, `notas`, `carpetas`, `archivos`, `bitacora`, `ultron_*`, `contenidos`; funciones de rol (`es_admin`, `es_equipo`, `veo`, `es_sistema`) y triggers que protegen lo que escribe cada quien. Se puede volver a correr completo sin perder nada: así se aplican mejoras (Eduardo lo pega en Supabase → SQL Editor → Run).
- `crm/netlify/functions/` — `config` (llaves públicas), `usuarios` (crear usuarios, contraseñas y corregir correos con la llave de servicio, solo admin; nunca al dueño; manda el acceso con `google/accesos.gs`), `correo` ("A mi correo", sale de la cuenta de Google de la empresa vía `crm/google/correo.gs`), `oido` (voz → texto para Ultron).
- `scripts/crm-muestra.mjs` — arma la muestra en un solo HTML.
- Video para Senen (inglés): se hizo grabando la muestra; no está en GitHub.

## Cómo probar antes de entregar
- Reglas de la base de datos: probar el esquema en PGlite con roles `authenticated`, `anon` y `service_role` y stubs de `auth.uid()` y `storage` (correrlo dos veces para probar que es re-ejecutable).
- Pantallas: construir la muestra y recorrerla con Playwright como cliente, equipo y admin, en computadora y celular.

## Reglas que no se rompen
- Senen y Gerardo nunca ven las tareas del otro.
- Solo Eduardo borra.
- Nadie más que Eduardo toca su perfil o su acceso, ni nombra administradores (candados en `cuidar_perfil`, `cuidar_dueno` y `cuidar_alta`).
- Lo que escribe el cliente no se cambia; nada se reemplaza (versiones).
- El "núcleo" que corre en máquinas del cliente (`bridge/nucleo/`) nunca menciona a NEX, NXUS interno, Jarvis, "Ramos & Co" ni correos de NXUS (se revisa con `node scripts/nucleo.mjs`).
- El agente de Ana Sofi no se toca sin que Eduardo lo pida.

## Hacia dónde va
Ya empezó (ver `docs/estado-ana-sofi.md`, fases): **los leads de Mi Semago llegan a este CRM** (hoy viven en el Google Sheet "Leads Mi Semago" que lee NEX para Ana Sofi; ver `docs/estado-ana-sofi.md`). Diseñarlo con él antes de construir: quién del cliente los ve (seguramente el gerente de ventas y Senen), qué etapas tienen, cómo se conecta con Ana Sofi y con las videollamadas, y que respete los candados de arriba.
