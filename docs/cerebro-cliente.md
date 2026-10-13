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
