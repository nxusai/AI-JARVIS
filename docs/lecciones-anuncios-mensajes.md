LECCIONES DE ANUNCIOS DE MENSAJES EN META (Facebook / Instagram) — aplícalas al armar los anuncios y el prompt para Claude in Chrome

LO QUE NOS PASÓ (para no repetirlo)
Gastamos $210 USD en anuncios de mensajes y llegaron 0 personas reales. Solo llegaban mensajes de OTROS NEGOCIOS
(estéticas, veterinarias, dentistas, florerías), y siempre era su respuesta automática: "Gracias por contactarnos,
déjanos tu mensaje…", "Recibimos tu mensaje, [nombre de mi página]…". Parecía que YO les pedía información a ellos.

POR QUÉ PASÓ
1. Cuando una cuenta de negocio toca el anuncio de mensajes, le llega el saludo de mi página; su respuesta automática
   contesta sola y Meta lo cuenta (y lo cobra) como "conversación". Ninguna persona escribió.
2. Con la meta "Maximize number of conversations" (o campañas Advantage+ abiertas), Meta busca a quien "conversa" más
   barato, y las cuentas de negocio con respuesta automática SIEMPRE contestan: Meta aprende a buscar más de esas.
3. El público estaba abierto: Advantage+ audience, sin intereses, edad desde 18, radios de 10 millas → millones de
   personas, y lo más barato eran negocios chiquitos que usan Instagram todo el día desde su cuenta de empresa.
4. El saludo del chat estaba en inglés ("Hi! Please let us know how we can help you") y sin botones: no filtraba a nadie.
5. El bot (ManyChat) arrancaba cuando un mensaje CONTENÍA "INFO"; "infor-MACIÓN" lo contiene, así que el bot les
   contestaba a los robots de otros negocios (bot contra bot).
6. La campaña optimizaba por "leads", pero nunca llegaba un lead real, así que Meta no tenía de quién aprender.
7. Meta tenía prendidas mejoras automáticas (Enhance CTA, Relevant comments, Video touch-ups) y "Related media".

REGLAS PARA LOS ANUNCIOS (Ads Manager)
- Campaña manual (no "Advantage+ campaign" ni "configuración recomendada"). Objetivo Engagement → Messaging apps.
- Presupuesto en el conjunto (Advantage campaign budget APAGADO); desmarcar "Share up to 20% of your budget with other
  ad sets"; poner Campaign spending limit (tope total). Meta puede gastar hasta 75% más en un día, pero no más de
  7× el diario por semana.
- Público con límites fijos: "Switch to original audience options" / "Reach a limited audience". Edad mínima real del
  cliente ideal (ej. 30+) con "Use as a suggestion" DESMARCADO. Ignorar la sugerencia de Meta de abrir a 18–65+.
- Ubicación precisa: colonias / pines con el radio mínimo (1 milla) o códigos postales; nunca "todo el país" ni radios
  grandes. Las zonas van en la segmentación, no en el video.
- Sin intereses si el público ya está acotado por zona y edad (los intereses tipo "emprendedores" o "dueños de pequeñas
  empresas" traen justo negocios chiquitos).
- Placements manuales: solo Facebook e Instagram Feed, Stories y Reels. Fuera Audience Network, Messenger inbox,
  Threads, Marketplace, Explore, Search, In-stream, etc. Desmarcar "Allow limited spending to excluded placements".
- Apagar TODAS las mejoras de Advantage+ creative, una por una (texto, visuales, música, overlays, animación, filtros,
  expandir, traducir, relevant comments, enhance CTA…), "Multi-advertiser ads" y "Related media". Se vuelven a prender
  al duplicar o editar un anuncio: revisar cada vez.
- En Advertising settings de la cuenta, salirse de "testing new creative and AI enhancements" si aparece.
- El saludo del chat NO debe ser la plantilla de Meta: ligar el anuncio a ManyChat (Message template → Partner app →
  ManyChat → la automatización de ese anuncio). Meta solo deja UNA plantilla para Messenger + Instagram juntos y las de
  Instagram salen en gris; lo práctico es destino SOLO Messenger (el anuncio igual se ve en Instagram).
- No pedir en el texto del anuncio que escriban una palabra si el chat empieza con botones.
- El texto y el gancho del video deben nombrar al cliente ideal ("¿Tienes un restaurante con varias sucursales?"), no
  "¿tienes un negocio o una empresa?". Evitar frases sobre la situación del que ve ("esto te está costando dinero"):
  Meta las puede rechazar por "atributos personales".
- Juzgar por costo por cita/cliente, no por costo por mensaje. 7 días sin tocar nada; "Learning limited" es normal con
  presupuesto chico.

REGLAS PARA EL BOT (ManyChat)
- Una automatización por anuncio con disparador "Facebook Ads – User clicks a Facebook Ad" (o "Instagram Ads"). El
  primer mensaje: un solo bloque, en el idioma del cliente, con BOTONES que una persona toca y un robot no puede tocar
  (ej. "¿Cuántas sucursales o ubicaciones tiene tu negocio? 1 · 2 a 5 · 6 o más"). Cada botón guarda el dato, marca la
  fuente (ej. "Anuncio · Video A") y una etiqueta, y luego arranca el flujo principal. Así se sabe qué anuncio trajo
  a cada lead.
- Palabras clave con regla "Message is" (palabra EXACTA), nunca "contains". Apagar el disparador por "intención".
- Preguntas con Data Collection de opción múltiple SIN texto libre; si contestan con texto, se repite "Toca una opción"
  y el robot se queda atorado sin llegar al CRM ni a la llamada.
- No tener Default Reply, Welcome Message ni Business AI / respuestas automáticas de Meta Business Suite que contesten a
  todo (pueden contestar antes que ManyChat o contestarles a robots).
- Teléfono: tipo de respuesta "Text" (el tipo "Phone" de ManyChat le pone +1 solo a números escritos sin lada). Antes,
  un botón "¿Tu número es de México o de Estados Unidos?" (🇲🇽 +52 · 🇺🇸 +1 · Otro). El número se guarda tal cual; si
  trae lada se respeta, si no, manda el botón.
- Mandar la señal de lead bueno a Meta (ManyChat → Settings → canal → Ads Optimization / Conversions API) solo cuando
  la persona terminó el filtro, no al primer mensaje.

REGLAS PARA LA EXTENSIÓN (Claude in Chrome)
- Que primero revise y reporte cómo está todo (solo mirar), y luego cree.
- Que NUNCA publique la campaña ni cambie pagos, límites de la cuenta o campañas existentes; que se detenga antes de
  "Publish" y pida permiso para publicar en ManyChat. El permiso debe ser explícito ("Sí, te autorizo de forma clara a
  publicar X y Y"), si no lo bloquea.
- Que no suba archivos sin avisar y que verifique que el video correcto quedó en cada anuncio.
- Que al final entregue un informe punto por punto con ✅ / ⚠️ / ❌ para revisarlo antes de publicar.
- Si se cierra la pestaña o se abre un chat nuevo, primero pedirle que solo revise qué ya existe, para no duplicar.
