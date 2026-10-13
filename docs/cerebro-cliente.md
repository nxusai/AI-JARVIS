# Cerebro del cliente — esquema

Estado: **esquema aprobado por partes; nada construido todavía.** Se construye
poco a poco, empezando por Ana Sofi.

## Quién manda

```
Eduardo ──► Nexy (Mac de Eduardo, "la madre")
              │  baja: actualizaciones firmadas y órdenes
              │  sube: solo reportes (salud, errores, gasto)
              ▼
        Cerebro del cliente (Mac mini en el cliente)
          ├── Ana Sofi ──► Mi Semago
          ├── Regina   ──► Abuelito Inc ─► Cheese · Meat · Corn
          └── Vivian   ──► VAYRO
```

- Solo Eduardo le habla a Nexy (su cuenta de Telegram).
- Nexy controla el cerebro. El cerebro nunca puede hablarle ni preguntarle
  nada a Nexy.
- El cliente solo ve y habla con Ana Sofi, Regina y Vivian.
- En el Mac mini no se instala Nexy, sino un programa aparte que solo trae a
  las tres IA's: sin código, nombre, memoria, correos ni llaves de Nexy.
- El Mac mini solo acepta paquetes firmados con la llave que vive en la Mac de
  Eduardo. Si una actualización falla, regresa solo a la versión anterior.

## Nexy guarda el original

- Nada del cliente desaparece de Nexy. Nexy guarda el original de cada IA:
  personalidad, reglas, productos, etiquetas y voces. El cerebro solo recibe
  una copia.
- Lo único que "se muda" es dónde contesta cada bot de Telegram, porque un bot
  solo puede contestar desde un lugar a la vez.
- Lo que pasa en el cerebro (conversaciones, impresiones, leads, cambios hechos
  por el cliente) sube a Nexy como copia, para que Eduardo lo siga viendo todo.
- Los cambios de datos hechos en Nexy (productos, días, prompts) llegan al
  cerebro en un minuto.
- Los cambios de programa llegan en la noche o cuando Eduardo lo ordene, con
  regreso automático a la versión anterior si fallan.
- Si alguien en el cerebro cambia algo con permiso (por ejemplo, los días de
  vida por medio de Ana Sofi), el cambio sube a Nexy y se guarda en el original.

## Candados

- El usuario del cliente es estándar, sin permisos de administrador. Terminal
  y las herramientas de desarrollo están bloqueadas para ese usuario.
- El programa corre como servicio oculto con su propio usuario del sistema.
  Su carpeta no la puede abrir el usuario del cliente y no hay ventanas ni
  íconos.
- El código va empaquetado en un solo archivo compactado e ilegible.
  Las llaves van en un archivo que solo el usuario escondido del cerebro
  (`_cerebro`) puede abrir, dentro del disco cifrado.
- Sin Apple ID en el Mac mini: ni de Eduardo ni del cliente. El administrador
  es una cuenta local ("Soporte NXUS") con contraseña que solo tiene Eduardo.
- Disco cifrado (FileVault). Las herramientas de Recuperación piden la
  contraseña del administrador local.
- Tras un apagón, el usuario del cliente puede desbloquear el disco con su
  propia contraseña, y eso no le da permisos de administrador.
- Al arrancar, el cerebro revisa la firma de cada archivo. Si alguien lo
  modificó, se detiene y le avisa a Nexy.
- Nexy recibe aviso si alguien entra como administrador o si el cerebro deja
  de reportarse.
- Desde Nexy se puede apagar el cerebro y borrar sus llaves a distancia.
- Las IA's no tienen herramientas para leer su propio código, y la regla de no
  revelar sus instrucciones es fija.
- El Mac mini queda en un lugar con llave.
- El contrato incluye licencia de uso y confidencialidad: el programa es de
  NXUS.

## Si un técnico del cliente intenta entrar

- Terminal está bloqueada con un código de Tiempo en pantalla que solo tiene
  Eduardo.
- Si logra abrir una terminal, como usuario estándar no puede leer la carpeta
  del programa. Cualquier comando de administrador (`sudo`) pide la contraseña
  de Eduardo.
- Cada intento fallido de contraseña de administrador le llega como alarma a
  Eduardo en Telegram.
- No puede instalar programas, apagar el servicio ni cambiar candados sin esa
  contraseña.
- En Recuperación, todo lo que abre el disco (Terminal, Utilidad de Discos,
  reinstalar conservando datos) pide la contraseña del administrador local.
- Lo único que puede hacer sin ella es borrar el Mac completo. Eso destruye el
  cerebro cifrado sin dejar nada legible: no se lleva código ni llaves. Nexy
  avisa porque el cerebro deja de reportarse, y se reinstala desde el original.
- El disco va soldado y cifrado por el chip del Mac, así que sacarlo no sirve
  de nada.
- No hay acceso remoto para nadie más. El de Eduardo es con llave propia, sin
  contraseña que adivinar.
- El único punto débil es la contraseña de administrador de Eduardo. Debe ser
  única para este Mac, de 16 caracteres o más y guardada solo en su
  administrador de contraseñas. No se le da a nadie del cliente: el contrato
  dice que la administración del equipo es de NXUS.

## Contacto entre las IA's

Mi Semago distribuye los quesos de Abuelito Inc y VAYRO, por eso:

| Entre | ¿Hablan? | De qué |
|---|---|---|
| Ana Sofi ↔ Regina | Sí | Pedidos, existencias, etiquetas, entregas y precios de distribución |
| Ana Sofi ↔ Vivian | Sí | Pedidos, existencias, etiquetas, entregas y precios de distribución |
| Regina ↔ Vivian | No (por ahora) | — |

- Se mandan mensajes de trabajo ("pedido", "pregunta", "aviso") por una mesa
  interna. Ninguna lee la memoria, los correos ni las cuentas de la otra.
- Cada mensaje queda registrado y Nexy lo puede ver.

## Departamentos

Son los nueve departamentos que Nexy ya maneja. Cada empresa los tiene, menos
los que Nexy se queda o los que la empresa todavía no tiene (`ocultos`; por
ejemplo, Abuelito Cheese, Meat y Corn no tienen Finanzas).

| Departamento | Dónde vive | Qué hace en el cerebro |
|---|---|---|
| Dirección | Cerebro (cada IA) | Coordina su empresa, aprobaciones y reparto de trabajo |
| Marketing (parrillas y edición de video) | **Nexy** | Nexy lo hace y entrega PDFs y videos |
| Publicidad (avisos de anuncios de Meta) | **Nexy** | Nexy lo hace y manda los avisos |
| Ventas | Cerebro | Leads, prospectos y seguimiento |
| Finanzas | Cerebro | Facturas, cotizaciones y cobros, con aprobación |
| Comunicación | Cerebro | Correos y Telegram de la empresa |
| Llamadas y Recepción | Cerebro | Recepcionista, recados y contactos de la empresa |
| Operaciones | Cerebro | Calendario, tareas, rutinas y etiquetas Zebra |
| IA | Cerebro (solo herramientas de la empresa) | Voz de su IA, imágenes y agentes de la empresa. Nada personal de Eduardo |

## Cuentas

La suscripción de Claude con la que Eduardo construye es su herramienta de
trabajo: nunca entra al cerebro. Que el cliente la pague es parte del cobro
mensual de NXUS.

Lo que usa el cerebro sale de las cuentas de Eduardo, separado y con tope:

- Claude: un espacio de trabajo propio en console.anthropic.com
  ("Cerebro Mi Semago") con límite de gasto mensual y su propia llave. El
  gasto sale separado y se le cobra al cliente.
- ElevenLabs: una llave aparte ("Cerebro Mi Semago") solo con voz a texto y
  texto a voz, con tope de créditos. La voz de Ana Sofi es de Eduardo y no
  se copia a ningún lado.
- Google: la del cliente (Mi Semago ya la tiene: info@misemago.com), solo
  para la carpeta de etiquetas.
- Bots de Telegram (Ana Sofi, Regina, Vivian): del BotFather de Eduardo; si
  algo pasa, Eduardo cambia la llave y el cerebro se queda mudo.
- Administrador del Mac mini: "Soporte NXUS".

El cliente no tiene usuario en Claude ni en ElevenLabs, así que no hay
accesos que pedir. Cualquier llave del cerebro se puede cancelar desde la
cuenta de Eduardo al instante. Las llaves se escriben solo en la pantalla
oculta del cerebro el día de la instalación, nunca en un chat.

## Orden de construcción

1. Preparar el Mac mini (cuando esté instalado). Además de los candados:
   prender "Inicio de sesión remoto" solo para "Soporte NXUS", y una red
   privada entre la Mac de Eduardo y el Mac mini: Tailscale (decidido),
   gratis, sin abrir puertos en el internet del cliente.
2. Crear el programa "Cerebro" (aquí, sin tocar al cliente):
   1. ✅ separar a Ana Sofi y las etiquetas en un núcleo que no dependa de Nexy
      (`bridge/nucleo`; `node scripts/nucleo.mjs` revisa que siga limpio);
   2. ✅ programa propio que guarda todo en su carpeta, no en la de Nexy
      (`bridge/cerebro`): `cerebro.mjs` (las IA's), `llaves.mjs` (pantalla
      oculta de llaves) e `instalar.sh` (usuario escondido `_cerebro`,
      carpeta cerrada y arranque solo con el Mac, sin ventanas);
   3. ✅ empaquetador que revisa fugas y firma (`node scripts/cerebro.mjs
      armar`): si algo dice "Nexy", "NXUS" o el correo de Eduardo, no se arma.
      Cada paquete va firmado con la llave de Eduardo
      (`~/.nexy/cerebro/firma-privada.pem`, entra en su respaldo; huella con
      `node scripts/cerebro.mjs llave`). El Mac mini guarda la llave pública
      la primera vez (Eduardo compara la huella) y solo instala paquetes
      firmados con ella. Al arrancar revisa el sello: si un archivo cambió,
      sobra o falta, no prende ninguna IA y lo dice en su estado;
   4. ✅ canal de Nexy al cerebro (`bridge/cerebros.mjs`,
      `bridge/cerebro/canal.sh`): Nexy entra por SSH con su propia llave
      (`~/.nexy/cerebro/canal_ed25519`), que en el Mac mini solo puede correr
      la "puerta" con una lista cerrada de órdenes: estado, espejo, registro,
      paquete (firmado), datos (firmados y más nuevos que los últimos),
      reiniciar, apagar, prender y borrar-llaves. El cerebro no tiene ninguna
      llave ni dirección hacia Nexy. Desde la Mac de Eduardo:
      `node scripts/cerebro.mjs conectar | estado | enviar | datos | espejo | …`.
      `datos --etiquetas` no pisa cambios hechos en el cerebro (pide
      `--forzar`). Cuando Ana Sofi ya contesta desde el cerebro, `espejo` guarda
      en Nexy los cambios hechos allá, y Nexy ya no prende su propia Ana Sofi;
   5. prueba completa en una Mac de ensayo.

   Pendiente de decidir en el paso 4: el cerebro corre con su propio usuario
   escondido, y Google Drive para escritorio vive en la sesión del usuario
   del cliente, así que el cerebro no puede escribir en esa carpeta. La
   impresión no depende de Drive (va por la línea directa). Para que el
   programa de etiquetas se actualice solo en la compu de la Zebra, el
   cerebro subirá el archivo a Drive directo por internet, con permiso solo
   sobre esa carpeta.
3. Mudar a Ana Sofi y las etiquetas (se apaga en Nexy el mismo día).
4. Crear la mesa interna entre IA's.
5. Crear a Regina (Abuelito Inc).
6. Crear a Vivian (VAYRO).
7. Agregar en Nexy el panel "Cerebros": salud, versión y gasto de cada IA.
   ✅ Ya están las alarmas (`startBrainWatch` en `bridge/cerebros.mjs`): cada
   5 minutos Nexy pregunta a cada cerebro y le avisa a Eduardo en su Telegram
   cuando:
   - no contesta 15 minutos;
   - está apagado o trabado;
   - el sello no cuadra;
   - una IA no está prendida;
   - el cerebro deja un aviso;
   - alguien escribe mal la contraseña de administrador;
   - alguien entra a la pantalla con la cuenta de administrador.

   Cada alarma llega una vez al empezar y otra al resolverse. Las de
   seguridad salen de los registros del Mac y se confirman el día de la
   instalación.
