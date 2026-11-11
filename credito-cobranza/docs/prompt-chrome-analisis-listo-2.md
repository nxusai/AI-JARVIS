# Prompt para Claude in Chrome · segundo análisis del sistema Listo (sólo lectura)

Abre Listo en Chrome con la sesión ya iniciada (cuenta DonGaston), abre el panel de Claude y pega:

---

⚠️ REGLA NÚMERO UNO, POR ENCIMA DE TODO LO DEMÁS:
ESTE SISTEMA CONTIENE DINERO E INFORMACIÓN REAL DE CLIENTES. TIENES PROHIBIDO MODIFICAR, CREAR,
BORRAR, MOVER, REGISTRAR, COBRAR, ANULAR, TRASLADAR, APROBAR O DESEMBOLSAR CUALQUIER COSA. TU ÚNICO
PERMISO ES MIRAR Y LEER. Si una acción pudiera cambiar algo, aunque sea mínimo, NO la hagas,
detente y pregúntame.

Eres analista funcional. En esta pestaña está abierto "Listo" (v4.16.0, Play Technologies), el
sistema actual de una financiera en México. Ya hiciste un primer recorrido; ahora necesito un
análisis MÁS PROFUNDO de cómo funciona por dentro, para construir un sistema nuevo que haga lo mismo
y mejor. Ya inicié sesión; no me pidas ni escribas contraseñas.

LO ÚNICO QUE PUEDES HACER
- Hacer clic en menús, submenús, pestañas y flechas de árboles para navegar.
- Hacer clic en botones que SÓLO consultan: "Buscar", "Generar" (reporte en pantalla), "Ver",
  "Detalle", lupa u ojo.
- En pantallas de CONSULTA (Administración créditos, Aprobación solicitudes, Desembolsar
  solicitudes, Reportes, Dashboard) puedes ELEGIR un valor en un FILTRO o lista de búsqueda (oficina,
  ruta, cliente, fechas) únicamente para consultar. Antes de elegir, confirma que en esa pantalla no
  hay un botón que se ejecute solo al cambiar el valor.
- Leer las opciones de una lista directamente del contenido de la página (HTML) sin seleccionarlas.
- Desplazarte, leer y regresar con "Atrás", "Cancelar", "Cerrar" o la X.

LO QUE TIENES ESTRICTAMENTE PROHIBIDO
1. Escribir en campos de captura (montos, abonos, observaciones, datos de cliente, usuarios).
2. Presionar: Guardar, Grabar, Aceptar, Confirmar, Aplicar, Registrar, Nuevo, Agregar, Crear,
   Editar, Modificar, Actualizar, Cobrar, Abonar, Pagar, Desembolsar, Entregar, Renovar, Anular,
   Reversar, Eliminar, Borrar, Cerrar caja, Cuadrar, Trasladar, Transferir, Asignar, Autorizar,
   Aprobar, Rechazar, Enviar, Importar, Sincronizar, Procesar, Liquidar, Habilitar, Homologar,
   Bloquear, Desbloquear, Restablecer o "Actualizar parámetros".
3. En "Caja > Pago de abonos" sólo puedes BUSCAR un crédito para ver su detalle. NO toques
   "Tipo de abono", "Abono", "Medio de pago", "Responsable", "Fecha próximo pago" ni "Registrar".
4. Aceptar cualquier ventana de confirmación: elige siempre Cancelar o No y avísame.
5. Descargar, exportar a Excel/PDF, imprimir o instalar nada. No uses "Descargas".
6. Cambiar permisos, usuarios o parámetros (puedes leer esas pantallas sin tocar casillas).
7. Cerrar la sesión.

SI TIENES CUALQUIER DUDA: no lo hagas, anótalo como "no verificado: [qué] en [pantalla]" y sigue.
Si crees que algo se modificó, DETENTE de inmediato y dime exactamente qué pasó.

DATOS PERSONALES: no copies nombres, teléfonos, domicilios, CURP/INE ni montos de clientes reales.
Si necesitas un ejemplo, anonimízalo ("Cliente A", "$X"). Sí puedes anotar estructuras, fórmulas,
tasas, plazos y nombres de campos.

QUÉ NECESITO QUE INVESTIGUES (lo que el primer recorrido no pudo ver)
A. FICHA DE UN CRÉDITO: en Administración créditos, elige en el filtro 2 o 3 créditos distintos
   (uno al día, uno atrasado, uno liquidado si existe) y documenta TODO lo que muestra: condiciones,
   tabla o calendario de pagos, cómo se reparte cada pago (capital, interés, mora), saldos,
   historial de abonos y cualquier pestaña interna.
B. CÁLCULO: con esos ejemplos, deduce y muestra la fórmula: monto prestado, % de interés total,
   % por periodo, número de cuotas, valor de cuota, total a pagar, cómo se genera la mora si existe.
   Marca qué es "visto" y qué es "deducido".
C. ESTADOS DE CARTERA: en el Dashboard, coloca el cursor sobre cada sección de la gráfica y busca
   en la página o la ayuda qué criterio usa para "al día", "atrasado", "alto riesgo" y "vencido".
D. ESTRUCTURA: ¿dónde se definen regiones, zonas, gerencias, oficinas y rutas? ¿Quién está asignado
   a cada una (cargo, no nombres)? ¿Cómo se agrupa una gerencia en el selector de rutas?
E. PERMISOS: en "Asignación de permisos", elige en la lista 2 usuarios con cargos distintos (por
   ejemplo un asesor y un gerente) y despliega TODO el árbol Web y Móvil SIN marcar casillas.
   Documenta qué tiene marcado cada cargo.
F. LISTAS: lee del contenido de la página (sin seleccionar) todas las opciones de: tipo de abono,
   medio de pago, modalidad, modelo de negocio, forma de pago, estado de crédito, tipo de garantía,
   tipo de vivienda, cargos, naturaleza y categorías de ingresos/egresos.
G. CONTADORES: los 6 íconos con número de la barra superior. Lee su texto alternativo o el HTML
   para saber qué cuenta cada uno. No les hagas clic si al hacerlo cambian algo.
H. REPORTES: genera EN PANTALLA (botón "Generar", nunca Excel) estos reportes para una ruta y una
   fecha reciente, y anota sus columnas y totales: Planilla recaudador sin totalizar, Cuadre
   recaudador, Cuadre ruta, Saldo caja por rutas, Créditos, Utilidad y Balance.
I. CAJA Y TRASLADOS: en "Cuadre usuarios" y "Traslados" sólo lee: qué campos se calculan solos,
   qué se captura a mano y qué historial muestra.
J. MÓVIL: en "Configuración móvil" y en el árbol de permisos Móvil, qué hace la app del cobrador.

ENTREGA FINAL (un solo documento en Markdown)
1. Resumen de los hallazgos nuevos en 10 líneas.
2. Fichas de crédito anonimizadas (A) y la fórmula deducida (B), con ejemplos numéricos ficticios.
3. Criterios de estados de cartera (C).
4. Estructura organizativa y cómo se asignan responsables (D).
5. Matriz de permisos por cargo, Web y Móvil (E).
6. Catálogo de todas las listas y sus opciones (F).
7. Qué cuentan los contadores (G).
8. Columnas y totales de cada reporte generado (H).
9. Flujo de caja, cuadre y traslados paso a paso (I).
10. Funciones de la app móvil (J).
11. Lo que siga sin poder verse y por qué (lista de "no verificado").
12. Preguntas que sólo el dueño puede responder.
13. Confirmación final: declara que no escribiste en campos de captura, no ejecutaste acciones que
    modifiquen datos, no descargaste nada y no aceptaste confirmaciones. Lista los filtros que
    usaste y los botones de consulta que pulsaste. Si hubo cualquier incidente, descríbelo.

Antes de empezar, dime en una línea qué ves en la pantalla de inicio y espera a que te diga
"adelante".

---

Cuando tengas el documento, pásalo a Claude Code. Con él se ajustan los cálculos, los estados y
los permisos del sistema nuevo, y se prepara el video de presentación.
