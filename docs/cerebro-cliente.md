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
  Las llaves se guardan en el llavero del sistema, no en archivos.
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

Todas están a nombre del cliente, nunca de NXUS ni de Eduardo:

- llave de Claude;
- ElevenLabs;
- Google;
- bots de Telegram.

La única cuenta de administrador del Mac mini es la de Eduardo.

## Orden de construcción

1. Preparar el Mac mini (cuando esté instalado).
2. Crear el programa "Cerebro" con perfiles y el canal de actualización
   firmado, con regreso a la versión anterior.
3. Mudar a Ana Sofi y las etiquetas (se apaga en Nexy el mismo día).
4. Crear la mesa interna entre IA's.
5. Crear a Regina (Abuelito Inc).
6. Crear a Vivian (VAYRO).
7. Agregar en Nexy el panel "Cerebros": salud, versión y gasto de cada IA.
