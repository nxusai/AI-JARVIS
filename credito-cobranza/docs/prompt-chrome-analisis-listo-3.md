# Prompt para Claude in Chrome · análisis completo de Listo v3 (sólo lectura)

Incluye lo pendiente del segundo análisis y agrega Tesorería, Normalidad y altas de catálogos
(usuarios, rutas, oficinas, zonas, productos). Abre Listo con la sesión iniciada y pega:

---

⚠️ REGLA NÚMERO UNO, POR ENCIMA DE TODO LO DEMÁS:
ESTE SISTEMA CONTIENE DINERO E INFORMACIÓN REAL DE CLIENTES. TIENES PROHIBIDO MODIFICAR, CREAR,
BORRAR, MOVER, REGISTRAR, COBRAR, ANULAR, TRASLADAR, APROBAR O DESEMBOLSAR CUALQUIER COSA. TU ÚNICO
PERMISO ES MIRAR Y LEER. Si una acción pudiera cambiar algo, aunque sea mínimo, NO la hagas,
detente y pregúntame.

Eres analista funcional. En esta pestaña está abierto "Listo" (v4.16.0, Play Technologies), el
sistema actual de una financiera en México. Necesito un análisis COMPLETO de cómo funciona por
dentro para construir un sistema nuevo que haga lo mismo y mejor. Ya inicié sesión; no me pidas
ni escribas contraseñas.

LO ÚNICO QUE PUEDES HACER
- Hacer clic en menús, submenús, pestañas y flechas de árboles para navegar.
- Hacer clic en botones que SÓLO consultan: "Buscar", "Generar" (reporte en pantalla), "Ver",
  "Detalle", lupa u ojo.
- En pantallas de CONSULTA (Dashboard, Reportes, Administración créditos, Aprobación solicitudes,
  Desembolsar solicitudes, Tesorería o caja empresa) puedes ELEGIR un valor en un FILTRO (oficina,
  ruta, cliente, fechas) sólo para consultar. Antes de elegir, confirma que esa pantalla no ejecuta
  nada sola al cambiar el valor.
- Leer formularios de alta (usuarios, rutas, oficinas, zonas, productos, parámetros) SIN escribir en
  ellos: anota sus campos, cuáles son obligatorios (*) y las opciones de sus listas.
- Leer las opciones de una lista directamente del contenido de la página (HTML) sin seleccionarlas.
- Desplazarte, leer y regresar con "Atrás", "Cancelar", "Cerrar" o la X.

LO QUE TIENES ESTRICTAMENTE PROHIBIDO
1. Escribir en campos de captura (montos, abonos, observaciones, datos de cliente o de usuario).
2. Presionar: Guardar, Grabar, Aceptar, Confirmar, Aplicar, Registrar, Nuevo, Agregar, Crear,
   Editar, Modificar, Actualizar, Cobrar, Abonar, Pagar, Desembolsar, Entregar, Renovar, Anular,
   Reversar, Eliminar, Borrar, Cerrar caja, Cuadrar, Trasladar, Transferir, Asignar, Autorizar,
   Aprobar, Rechazar, Enviar, Importar, Sincronizar, Procesar, Liquidar, Habilitar, Homologar,
   Bloquear, Desbloquear, Restablecer o "Actualizar parámetros".
3. En "Caja > Pago de abonos" sólo puedes BUSCAR un crédito para ver su detalle. NO toques
   "Tipo de abono", "Abono", "Medio de pago", "Responsable", "Fecha próximo pago" ni "Registrar".
4. Hacer clic en íconos de lápiz o editar de una tabla: abren la edición de un registro real.
5. Aceptar cualquier ventana de confirmación: elige siempre Cancelar o No y avísame.
6. Descargar, exportar a Excel/PDF, imprimir o instalar nada. No uses "Descargas".
7. Marcar o desmarcar casillas de permisos o parámetros.
8. Cerrar la sesión.

SI TIENES CUALQUIER DUDA: no lo hagas, anótalo como "no verificado: [qué] en [pantalla]" y sigue.
Si crees que algo se modificó, DETENTE de inmediato y dime exactamente qué pasó.

DATOS PERSONALES: no copies nombres, teléfonos, domicilios, CURP/INE ni montos de clientes reales.
Si necesitas un ejemplo, anonimízalo ("Cliente A", "$X"). Sí puedes anotar estructuras, fórmulas,
tasas, plazos, nombres de campos, cargos y totales agregados.

QUÉ NECESITO QUE INVESTIGUES

A. FICHA DE UN CRÉDITO: en Administración créditos elige con el filtro 2 o 3 créditos distintos
   (al día, atrasado y liquidado si existe). Documenta condiciones, tabla o calendario de pagos,
   cómo se reparte cada pago (capital, interés, mora), saldos, historial de abonos y pestañas.
B. CÁLCULO: con esos ejemplos deduce la fórmula: monto, % de interés total y por periodo, número de
   cuotas, valor de cuota, total a pagar y mora. Marca qué es "visto" y qué es "deducido".
C. ESTADOS DE CARTERA: qué criterio usa para "al día", "atrasado", "alto riesgo" y "vencido".
D. NORMALIDAD (importante): busca en todo el sistema (Dashboard, Reportes, Estadísticas, Cuadres,
   ayuda) cualquier indicador de "normalidad", "% de cumplimiento", "cobranza esperada vs cobrada",
   "efectividad" o "cartera sana". Para cada uno: dónde está, cómo se calcula (qué entra en el
   numerador y el denominador), por qué periodo (día, semana, mes) y a qué nivel (ruta, oficina,
   gerencia, empresa). Si no existe, dilo claramente.
E. TESORERÍA (importante): todo lo relacionado con el dinero de la empresa más allá de cada ruta:
   Saldo caja empresa, Cuadre empresa, Balance, Utilidad, bancos, depósitos, ingresos y egresos de
   oficina, fondeo o capital, devoluciones de depósito, causantes y conceptos. Documenta cada
   pantalla, sus columnas, cómo se mueve el dinero entre cajas (asesor → gerente → oficina →
   empresa → banco) y qué se captura a mano. Si una parte de tesorería no existe en Listo, dilo.
F. ESTRUCTURA: dónde se definen regiones, zonas, gerencias, oficinas y rutas; qué cargo queda a
   cargo de cada nivel (sin nombres); cómo se agrupa una gerencia en el selector de rutas.
G. ALTAS Y CATÁLOGOS (sin guardar nada): lee los formularios de alta de Usuarios, Rutas, Oficinas,
   Zonas, Ciudades, Barrios, Cargos, Bancos, Medios de pago, Mora por mes, Día no laboral,
   Archivos obligatorios, Productos o modelos de negocio y Configuración móvil. Para cada uno:
   campos, obligatorios, listas y sus opciones, reglas que muestre la pantalla y qué pasa después
   (por ejemplo, si al crear una ruta se le asigna un usuario o una caja).
H. PERMISOS: en "Asignación de permisos" elige 2 usuarios con cargos distintos (asesor y gerente,
   o gerente y administrador) y despliega TODO el árbol Web y Móvil SIN marcar casillas. Documenta
   qué tiene cada cargo.
I. LISTAS: opciones de tipo de abono, medio de pago, modalidad, modelo de negocio, forma de pago,
   estado de crédito, tipo de garantía, tipo de vivienda, naturaleza y categorías de
   ingresos/egresos.
J. CONTADORES: qué cuenta cada uno de los 6 íconos con número de la barra superior (texto
   alternativo o HTML; no les hagas clic si al hacerlo cambian algo).
K. REPORTES: genera EN PANTALLA (botón "Generar", nunca Excel) para una ruta y una fecha recientes:
   Planilla recaudador sin totalizar, Cuadre recaudador, Cuadre ruta, Cuadre empresa, Saldo caja
   por rutas, Saldo caja empresa, Créditos, Estadística ruta, Utilidad y Balance. Anota columnas,
   totales y para qué sirve cada uno.
L. CAJA Y CUADRE: en "Cuadre usuarios" y "Traslados" sólo lee qué se calcula solo, qué se captura
   a mano y qué historial muestra.
M. MÓVIL: qué hace la app del cobrador según "Configuración móvil" y el árbol de permisos Móvil.
N. CUALQUIER OTRA COSA que encuentres y no esté en esta lista: menús, pantallas o funciones.

ENTREGA FINAL (un solo documento en Markdown)
1. Resumen de los hallazgos en 15 líneas.
2. Fichas de crédito anonimizadas y la fórmula deducida, con ejemplos numéricos ficticios (A, B).
3. Criterios de estados de cartera (C).
4. NORMALIDAD: indicadores encontrados, fórmula, periodo y nivel (D).
5. TESORERÍA: pantallas, flujo del dinero de punta a punta y qué falta (E).
6. Estructura organizativa y responsables por nivel (F).
7. Altas y catálogos: campos, obligatorios, opciones y reglas de cada formulario (G).
8. Matriz de permisos por cargo, Web y Móvil (H).
9. Catálogo de todas las listas y opciones (I).
10. Qué cuentan los contadores (J).
11. Columnas, totales y uso de cada reporte (K).
12. Flujo de caja, cuadre y traslados paso a paso (L).
13. Funciones de la app móvil (M).
14. Hallazgos adicionales (N).
15. Lo que siga sin poder verse y por qué (lista de "no verificado").
16. Preguntas que sólo el dueño puede responder, sobre todo de Tesorería y Normalidad.
17. Confirmación final: declara que no escribiste en campos de captura, no ejecutaste acciones que
    modifiquen datos, no abriste ediciones de registros, no descargaste nada y no aceptaste
    confirmaciones. Lista los filtros que usaste y los botones de consulta que pulsaste. Si hubo
    cualquier incidente, descríbelo.

Antes de empezar, dime en una línea qué usuario ves conectado y qué menús principales aparecen, y
espera a que te diga "adelante".

---

Cuando tengas el documento, pásalo a Claude Code para complementar el sistema nuevo.
