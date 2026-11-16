# Investigación: puntos de venta y restaurantes "come todo" (16 nov 2026)

Hecha en internet para el video `ads/pos-come-todo/`. Varias páginas no abrieron (comunidad de Toast, TrustRadius, precios de Parrot y de Soft Restaurant). No se encontraron quejas de dueños con fuente (ni en Reddit, grupos de Facebook o reseñas de apps).

## Cómo manejan el buffet los sistemas populares
- **Toast (EE. UU., referencia):** en su comunidad piden soporte nativo para "all you can eat"; hoy se resuelve con artículos en $0 y un botón aparte para cobrar, y reportan errores (cosas gratis en mesas que no son buffet, buffets sin cobrar). https://community.toasttab.com/t5/industry-trends/all-you-can-eat-amp-bottomless-menus-growing-trend-painful-pos/td-p/17739 (visto en el buscador; la página dio 403)
- **SambaPOS:** el arreglo sugerido es un "paquete" a precio fijo con los platillos como etiquetas. https://forum.sambapos.com/t/all-you-can-eat-implementation/6486
- **Poster:** calcula ganancia y costo por recibo. https://knowledge-base.joinposter.com/en/how-profit-is-calculated
- **Soft Restaurant:** tiene productos compuestos y paquetes con cobro de excedentes. https://softrestaurant.com/docs-manual-interactivo-soft-restaurant-12
- **No se encontró** documentación de un modo buffet ni de un reporte "ganó o perdió por mesa" en Soft Restaurant, Parrot, Poster, Wansoft, Loyverse, Square, Fudo ni Restaurant.pe. **Eso no prueba que no exista.**
- Deducción nuestra: lo habitual es un producto "Buffet" a precio fijo más platillos en $0 o cortesías.

## Precios y requisitos publicados
- Soft Restaurant 12: LITE $639 + IVA y PRO $879 + IVA (la página no aclara el periodo); pide Windows 10/11 Pro; varios módulos se venden aparte. https://softrestaurant.com/soft-restaurant-precio
- Comparativo de un competidor (PoloTab, 6 oct 2026): Fudo $360 a $1,050 al mes, Poster $550 a $1,310, Soft Restaurant Cloud $699 a $1,599. https://www.polotab.com/blog/cuanto-cuesta-un-sistema-de-punto-de-venta-en-mexico
- Los precios de terceros cambian y se contradicen: no usarlos en contenido.

## Dolores del "come todo"
- El ingreso es fijo por persona y el costo es variable; el desperdicio se come el margen; hay precio de adulto, niño y horario; las bebidas suelen ir aparte. https://jamezz.com/blog/all-you-can-eat-management-guide
- Sobrepedido de proteínas caras y meseros que se saltan reglas sin registro. https://www.eats365pos.com/blog/post/ayce-tablet-ordering-stop-abuse (sus porcentajes no traen fuente: no usarlos)

## Sistemas hechos para buffet en otros países (ideas para lo que podemos construir)
- Chowbus (EE. UU.): tiempo por mesa con cuenta regresiva, tope por ronda, tope de platillos caros, paquetes por nivel. https://chowbus.com/restaurant-pos/buffet-pos-system
- Eats365, Jamezz y Butlaroo: rondas, QR, reglas por horario, niños, cobro opcional de sobras.
- En las páginas abiertas ninguno describe margen o costo por mesa: ese es nuestro diferenciador (deducción nuestra).

## Qué sí podemos decir en contenido
1. En un come todo el precio es fijo, pero cada mesa cuesta distinto.
2. En los sistemas genéricos lo común es el truco de capturar platillos en $0.
3. Nuestro sistema registra lo consumido sin sumarlo a la cuenta y el ticket sale en una línea.
4. Dice mesa por mesa si se ganó o se perdió (con los costos que capture el restaurante).
5. Se ajusta a sus reglas: tiempo, niños, bebidas aparte, sobras.

## Qué NO decir
- Que ningún sistema tiene modo buffet, o que alguno "no puede".
- Nombrar competidores o decir que son caros, rígidos o de mal soporte.
- Porcentajes de merma, pérdidas o ahorro.
- Que cobrar sobras o limitar tiempo es legal: no está verificado.
- Que somos los únicos o los primeros.
