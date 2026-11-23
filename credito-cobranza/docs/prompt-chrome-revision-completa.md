# Prompt para Claude in Chrome · revisión completa en vivo (después del SQL 11)

```
Vas a REVISAR (no a cambiar) el portal de crédito y cobranza de Nexus Capital y a darme un reporte. Reglas:
- No escribas, copies ni muestres contraseñas ni claves. Si el portal pide iniciar sesión, DETENTE y pídeme que yo inicie sesión; luego sigue.
- En el portal NO guardes, autorices, rechaces, cobres, subas archivos ni cambies permisos. Sólo abre pantallas y lee. Si un paso pide «Guardar», cierra con la X.
- En Supabase trabaja SOLO en la organización "Credito y Cobranza", proyecto "credito-cobranza". No toques otros proyectos ni configuraciones.
- Si algo falla, anótalo con el texto exacto que aparece y sigue con lo demás.

PARTE A · Portal en computadora: https://credito-cobranza-demo.netlify.app
A1. Entra (ya con mi sesión de dueño). Anota qué menú aparece a la izquierda y si se ve el tablero con números.
A2. Administración → revisa que existan las pestañas: Usuarios, Permisos, Modalidades y %, Estructura, Personal, Parámetros, Peticiones, Bitácora.
A3. Administración → Permisos: anota si se ve la tabla de permisos por cargo y, más abajo, la sección de permisos por persona.
A4. Administración → Modalidades y %: anota qué modalidades aparecen, con su % y número de pagos, y cuáles están activas (la diaria debe decir 50 %, 30 pagos, apagada).
A5. Administración → Parámetros: anota si aparece «comprobante_vigencia_dias» con valor 90 (o su descripción «Renovaciones: días que sigue sirviendo el comprobante…»).
A6. Administración → Usuarios: abre «Editar» de cualquier usuario y anota si el ámbito se elige con casillas (rutas, oficinas, gerencias, zonas). Cierra con la X sin guardar.
A7. Clientes → abre la ficha de cualquier cliente: anota si aparecen los botones «Cambiar de ruta» y «📍 Guardar ubicación». Abre «Cambiar de ruta» y ciérralo con la X sin guardar.
A8. En el tablero, toca un color de la leyenda (por ejemplo «atrasado»): anota si se abre la lista de clientes de ese color.

PARTE B · «Ver como…» (botón abajo del menú izquierdo; en celular está en «Más»). Es sólo lectura.
B1. Ver como → Cargo: Mesa de control. Anota: qué opciones tiene el menú (debe ser SÓLO Solicitudes), si se ven bandejas de colores, y abre una solicitud: anota las pestañas (Datos, Archivos, Historial, Conversación). Abre «Historial» y anota si muestra créditos o «Cliente nuevo». Anota si está el botón «Expediente PDF».
B2. En la barra de arriba toca «Otro cargo» → Cargo: Asesor, y en Ámbito elige una ruta (o una persona asesor si aparece). Anota:
   - si la pantalla de inicio es tipo app: un anillo con % «de la meta de hoy», saludo, y botones grandes (Cobrar mi ruta, Nuevo crédito, Desembolsos, Correcciones, Renovar, Mis clientes, Mi caja, Registrar gasto, Mi normalidad). Anota cuáles aparecen.
   - el menú: NO debe aparecer «Solicitudes» (las bandejas de mesa).
   - toca «Nuevo crédito»: escribe en CURP: LORM850312MMCPZR04 y anota qué se llenó solo en Fecha de nacimiento y Sexo. Revisa que haya secciones de Datos del cliente, Domicilio (con «Capturar ubicación»), Referencias (2) y Crédito. Lee la nota de arriba. Cierra con la X.
   - toca «Cobrar mi ruta»: anota si las tarjetas de clientes tienen colores y si algunas tienen botón «Renovar». Toca un «Renovar» y copia el texto de la nota de arriba (debe decir «No se vuelve a subir todo…»). Cierra con la X.
   - menú «Crear crédito»: anota si existe la sección «Desembolsos pendientes» y la columna «Fotos» con 📷 x/13 en Mis solicitudes.
B3. «Otro cargo» → Gerente y luego → Gerente zonal: anota en cada uno qué menú aparece.
B4. «Otro cargo» → Tesorería: anota qué menú aparece.
B5. Toca «Salir» en la barra de arriba y confirma que regresas a la vista de dueño.

PARTE C · Celular
C1. Si puedes, angosta la ventana del navegador a unos 400 px de ancho (como celular) y repite rápido B1 y B2 (inicio del asesor y Nuevo crédito). Anota si algo se sale de la pantalla hacia los lados o se encima. Si no puedes angostar la ventana, dímelo y omite esta parte.

PARTE D · Prueba de renovación en Supabase (no guarda nada)
D1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/prueba_11_renovacion.sql → «Raw». Pon el archivo COMPLETO en una consulta nueva del SQL Editor y da «Run». Si aparece un aviso de operación destructiva, elige correrla.
D2. Es NORMAL que salga un mensaje en rojo que empieza con «RESULTADO (se deshizo todo)». Cópiamelo completo. Debe decir: tomados: Foto del cliente, INE (frente), INE (reverso) · no tomados: Comprobante de domicilio, Negocio (frente).
D3. Para confirmar que no quedó nada, corre esto (es lectura) y dame el resultado:
select (select count(*) from public.documentos where path like '%/prueba-%') as docs_prueba,
       (select count(*) from public.solicitudes where cliente_nombre like 'PRUEBA renovación%') as solicitudes_prueba;
   Debe dar 0 y 0. No guardes las consultas. Cierra la pestaña de GitHub.

REPORTE FINAL: una tabla con cada punto (A1…D3), «OK» o «FALLA», y lo que anotaste. Al final, una lista sólo con las fallas y el texto exacto de cada error.
```
