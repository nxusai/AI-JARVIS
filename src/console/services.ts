/**
 * How each connected service looks on the console, and which department of
 * the map it hangs from.
 *
 * A server that is not listed here still appears — with its own name and a
 * plug icon, under Dirección — the moment Nexy connects to it, so nothing breaks
 * when a new app is added. A line here only makes it look nicer and puts it in
 * the right department. For example:
 *
 *   instagram: { label: 'Instagram', icon: '📸', dept: 'marketing' },
 *
 * The key is the server's name as it appears in `claude mcp list`. The
 * departments are listed in bridge/agents.mjs.
 */

export type Service = { label: string; icon: string; dept?: string; hidden?: boolean }

export const SERVICES: Record<string, Service> = {
  gmail: { label: 'Gmail', icon: '📧', dept: 'comunicacion' },
  'google-calendar': { label: 'Calendario', icon: '📅', dept: 'operaciones' },
  notion: { label: 'Notion', icon: '📓', dept: 'operaciones' },
  jarvis_phone: { label: 'Teléfono', icon: '☎️', dept: 'llamadas' },
  jarvis_contacts: { label: 'Contactos', icon: '👥', dept: 'llamadas' },
  jarvis_messages: { label: 'Recados', icon: '📝', dept: 'llamadas' },
  jarvis_memory: { label: 'Memoria', icon: '💭', dept: 'direccion' },
  jarvis_brands: { label: 'Marcas', icon: '🏷️', dept: 'direccion' },
  jarvis_rutinas: { label: 'Rutinas', icon: '⏰', dept: 'operaciones' },
  jarvis_crudo: { label: 'Crudo (memoria)', icon: '🗂️', dept: 'marketing' },
  jarvis_ventas: { label: 'Ana Sofi (ventas)', icon: '🧀', dept: 'ventas' },
  jarvis_files: { label: 'Archivos de marca', icon: '📤', dept: 'marketing' },
  jarvis_video: { label: 'Editor de video', icon: '🎞️', dept: 'marketing' },
  jarvis_taller: { label: 'Taller de edición', icon: '🛠️', dept: 'marketing' },
  jarvis_telegram: { label: 'Telegram', icon: '✈️', dept: 'comunicacion' },
  jarvis_eyes: { label: 'Cámara', icon: '📷', dept: 'ia' },
  jarvis_chrome: { label: 'Chrome', icon: '🌐', dept: 'ia' },
  web: { label: 'Internet', icon: '🔎', dept: 'ventas' },
  elevenlabs: { label: 'ElevenLabs', icon: '🎙️', dept: 'ia' },
  // Redes y contenido, para cuando se conecten:
  ayrshare: { label: 'Ayrshare', icon: '🗓️', dept: 'marketing' },
  metricool: { label: 'Metricool', icon: '🗓️', dept: 'marketing' },
  buffer: { label: 'Buffer', icon: '🗓️', dept: 'marketing' },
  instagram: { label: 'Instagram', icon: '📸', dept: 'marketing' },
  tiktok: { label: 'TikTok', icon: '🎵', dept: 'marketing' },
  linkedin: { label: 'LinkedIn', icon: '💼', dept: 'marketing' },
  heygen: { label: 'HeyGen', icon: '🧑‍💻', dept: 'ia' },
  higgsfield: { label: 'Higgsfield', icon: '🎥', dept: 'ia' },
  canva: { label: 'Canva', icon: '🎨', dept: 'marketing' },
  zoho: { label: 'Zoho Invoice', icon: '🧾', dept: 'finanzas' },
  jarvis_facturas: { label: 'PDF de facturas', icon: '📄', dept: 'finanzas' },
  jarvis_respaldo: { label: 'Respaldo', icon: '💾', dept: 'operaciones' },
  jarvis_anuncios: { label: 'Vigilancia de ads (Meta)', icon: '📢', dept: 'publicidad' },
  jarvis_parrilla: { label: 'Parrilla de contenido', icon: '🗓️', dept: 'marketing' },
  jarvis_atencion: { label: 'Atención a clientes (Telegram)', icon: '🤝', dept: 'comunicacion' },
  zernio: { label: 'Zernio', icon: '🗓️', dept: 'marketing' },
  'meta-ads': { label: 'Meta Ads', icon: '📢', dept: 'publicidad' },
  fal: { label: 'Imágenes (fal)', icon: '🖼️', dept: 'ia' },
  replicate: { label: 'Imágenes (Replicate)', icon: '🖼️', dept: 'ia' },
  // Nexy's own screen: busy all the time, and not a connection worth watching.
  jarvis: { label: 'Pantalla', icon: '🖥️', hidden: true },
  jarvis_ui: { label: 'Interfaz', icon: '🎨', hidden: true },
  builtin: { label: 'Sistema', icon: '⚙️', hidden: true },
  // Añade aquí tus apps nuevas, una línea cada una.
}

/** The department a service hangs from on the map. */
export const deptOf = (key: string) => SERVICES[key]?.dept ?? (key.startsWith('gmail-') ? SERVICES.gmail.dept : undefined) ?? 'direccion'

/** Friendly names for steps. Anything missing is spelled out from its tool name. */
const STEPS: Record<string, string> = {
  'gmail__search_emails': 'Buscar correos',
  'gmail__read_email': 'Leer correo',
  'gmail__send_email': 'Enviar correo',
  'gmail__draft_email': 'Crear borrador',
  'google-calendar__list-events': 'Revisar calendario',
  'google-calendar__search-events': 'Buscar eventos',
  'google-calendar__get-event': 'Ver evento',
  'google-calendar__get-current-time': 'Consultar fecha y hora',
  'google-calendar__create-event': 'Crear evento',
  'google-calendar__update-event': 'Cambiar evento',
  'jarvis_phone__call_me': 'Llamarte',
  'jarvis_phone__list_my_calls': 'Ver llamadas programadas',
  'jarvis_phone__cancel_my_call': 'Cancelar llamada',
  'jarvis_contacts__list_contacts': 'Ver contactos',
  'jarvis_contacts__call_contact': 'Llamar a un contacto',
  'jarvis_contacts__save_contact': 'Guardar contacto',
  'jarvis_contacts__list_contact_calls': 'Ver llamadas programadas a contactos',
  'jarvis_contacts__cancel_contact_call': 'Cancelar llamada a contacto',
  'jarvis_contacts__remove_contact': 'Borrar contacto',
  'jarvis_contacts__list_contact_replies': 'Ver respuestas de contactos',
  'jarvis_messages__list_messages': 'Revisar recados',
  'jarvis_messages__clear_messages': 'Borrar recados',
  'jarvis_memory__remember': 'Guardar en memoria',
  'jarvis_memory__forget': 'Olvidar de la memoria',
  'jarvis_memory__list_memories': 'Leer memoria',
  'jarvis_brands__list_brands': 'Ver marcas',
  'jarvis_brands__use_brand': 'Cambiar de marca',
  'jarvis_brands__read_brand': 'Leer manual de marca',
  'jarvis_facturas__invoice_pdf': 'Hacer PDF de factura',
  'jarvis_respaldo__make_backup': 'Hacer respaldo',
  'jarvis_anuncios__list_running_ads': 'Ver ads activos',
  'jarvis_parrilla__read_content_strategy': 'Leer estrategia de contenido',
  'jarvis_parrilla__save_content_strategy': 'Guardar estrategia de contenido',
  'jarvis_parrilla__list_content_plans': 'Ver parrillas',
  'jarvis_parrilla__read_content_plan': 'Leer parrilla de la semana',
  'jarvis_parrilla__save_content_plan': 'Guardar parrilla de la semana',
  'jarvis_parrilla__update_content_post': 'Cambiar una publicación de la parrilla',
  'jarvis_parrilla__export_content_plan': 'Hacer PDF de la parrilla',
  'jarvis_parrilla__read_planning_context': 'Repasar estrategia, aprendizajes y semanas pasadas',
  'jarvis_parrilla__save_week_results': 'Guardar resultados de la semana',
  'jarvis_parrilla__read_brand_learnings': 'Leer aprendizajes de la marca',
  'jarvis_parrilla__save_brand_learning': 'Guardar un aprendizaje',
  'jarvis_parrilla__remove_brand_learning': 'Quitar un aprendizaje',
  'jarvis_brands__brand_note': 'Anotar en el manual de marca',
  'jarvis_brands__save_brand_reference': 'Guardar referencia visual',
  'jarvis_files__upload_to_url': 'Subir imagen de marca',
  'jarvis_video__edit_video': 'Editar video',
  'jarvis_video__list_videos': 'Ver videos y música',
  'jarvis_video__make_music': 'Crear música para el video',
  'jarvis_video__clone_owner_voice': 'Clonar tu voz',
  'jarvis_video__speak_as_owner': 'Decir una línea con tu voz',
  'jarvis_video__get_reference_video': 'Bajar video de referencia',
  'jarvis_brands__save_edit_style': 'Guardar molde de edición',
  'jarvis_brands__read_edit_molds': 'Leer moldes de edición',
  'jarvis_brands__remove_edit_style': 'Borrar molde de edición',
  'jarvis_taller__add_to_project': 'Preparar proyecto de edición',
  'jarvis_taller__ffmpeg': 'Editar (paso de edición)',
  'jarvis_taller__media_info': 'Revisar el video',
  'jarvis_taller__remove_silences': 'Quitar silencios',
  'jarvis_taller__transcribe': 'Transcribir el audio',
  'jarvis_taller__look_at': 'Mirar cuadros del video',
  'jarvis_taller__write_project_text': 'Escribir subtítulos o lista',
  'jarvis_taller__export_video': 'Exportar video terminado',
  'jarvis_brands__save_brand_logo': 'Guardar logo de la marca',
  'jarvis_telegram__send_file': 'Mandarte el archivo por Telegram',
  'metricool__post_Schedule_Post': 'Programar publicación',
  'metricool__update_Schedule_Post': 'Cambiar publicación programada',
  'metricool__getBrandSettings': 'Ver marcas de Metricool',
  'metricool__get_brands': 'Ver marcas de Metricool',
  'higgsfield__generate_image': 'Generar imagen',
  'higgsfield__jobs_wait': 'Esperar la imagen o el video',
  'higgsfield__media_upload': 'Preparar subida a Higgsfield',
  'jarvis_brands__link_brand_account': 'Conectar cuenta a la marca',
  'jarvis_rutinas__list_routines': 'Ver rutinas',
  'jarvis_crudo__find_raw_folder': 'Buscar carpeta en la memoria',
  'jarvis_crudo__browse_raw_folder': 'Abrir carpeta de la memoria',
  'jarvis_crudo__link_raw_folder': 'Conectar carpeta de crudo',
  'jarvis_crudo__list_raw': 'Revisar crudo en la memoria',
  'jarvis_crudo__mark_raw_used': 'Anotar crudo usado',
  'jarvis_ventas__list_sales_leads': 'Ver leads de Mi Semago',
  'jarvis_ventas__schedule_sales_call': 'Programar llamada de Ana Sofi',
  'jarvis_ventas__cancel_sales_call': 'Cancelar llamada de Ana Sofi',
  'jarvis_ventas__log_sales_meeting': 'Anotar videollamada en el Sheet',
  'jarvis_ventas__ana_sofi_dice': 'Ana Sofi',
  'jarvis_ventas__cliente_dice': 'Cliente',
  'jarvis_rutinas__create_routine': 'Programar rutina',
  'jarvis_rutinas__update_routine': 'Cambiar rutina',
  'jarvis_rutinas__remove_routine': 'Borrar rutina',
  'jarvis_rutinas__run_routine_now': 'Probar rutina',
  'jarvis_brands__unlink_brand_account': 'Desconectar cuenta de la marca',
  'jarvis_eyes__look': 'Mirar con la cámara',
  'jarvis_eyes__watch': 'Observar con la cámara',
  'notion__API-post-search': 'Buscar en Notion',
  'notion__API-query-data-source': 'Consultar tareas',
  'notion__API-retrieve-a-data-source': 'Ver base de datos',
  'notion__API-retrieve-a-database': 'Ver base de datos',
  'notion__API-retrieve-a-page': 'Leer página',
  'notion__API-retrieve-page-markdown': 'Leer página',
  'notion__API-get-block-children': 'Leer contenido',
  'notion__API-get-users': 'Ver personas del equipo',
  'notion__API-get-user': 'Ver persona',
  'notion__API-retrieve-a-comment': 'Leer comentarios',
  'notion__API-post-page': 'Crear tarea o página',
  'notion__API-patch-page': 'Actualizar tarea',
  'notion__API-create-a-comment': 'Comentar',
  'notion__API-patch-block-children': 'Agregar contenido',
  'notion__API-update-a-block': 'Editar contenido',
  'notion__API-update-page-markdown': 'Reescribir página',
  'notion__API-create-a-data-source': 'Crear tabla',
  'notion__API-update-a-data-source': 'Agregar columnas a tabla',
  'builtin__WebSearch': 'Buscar en internet',
  'builtin__WebFetch': 'Leer una página web',
}

/** Built-in tools that belong on the map, and under which node. */
const BUILTIN_HOME: Record<string, string> = { WebSearch: 'web', WebFetch: 'web' }

const humanize = (s: string) => {
  const t = s.replace(/^jarvis_/, '').replace(/[_-]+/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : s
}

/** The map node a step belongs to. */
export function homeOf(server: string, tool: string): string {
  return server === 'builtin' ? (BUILTIN_HOME[tool] ?? 'builtin') : server
}

export function serviceOf(key: string): Service {
  // A company's own mailbox (gmail-mi-semago): a Gmail of its own.
  if (!SERVICES[key] && key.startsWith('gmail-')) return { ...SERVICES.gmail, label: `Gmail ${humanize(key.slice(6))}` }
  return SERVICES[key] ?? { label: humanize(key), icon: '🔌' }
}

export function stepLabel(server: string, tool: string): string {
  return STEPS[`${server}__${tool}`] ?? (server.startsWith('gmail-') ? STEPS[`gmail__${tool}`] : undefined) ?? humanize(tool)
}

/**
 * The fields worth showing for a step, in plain words. Known tools get their
 * own labels in a sensible order; anything else shows its fields as they are.
 */
const FIELD_NAMES: Record<string, string> = {
  to: 'Para',
  cc: 'Copia',
  subject: 'Asunto',
  body: 'Mensaje',
  message: 'Mensaje',
  name: 'Nombre',
  phone: 'Teléfono',
  country: 'País',
  account_id: 'Cuenta (id)',
  account_name: 'Cuenta',
  service: 'Servicio',
  blog_id: 'Cuenta Metricool',
  date: 'Fecha',
  info: 'Publicación',
  fact: 'Dato',
  about: 'Sobre',
  query: 'Búsqueda',
  url: 'Página',
  summary: 'Título',
  start: 'Empieza',
  end: 'Termina',
  at: 'Hora',
  in_minutes: 'En minutos',
  timeZone: 'Zona horaria',
  caption: 'Texto',
  page_id: 'Página',
  data_source_id: 'Base de datos',
  markdown: 'Contenido',
  rich_text: 'Comentario',
  text: 'Texto',
  brand: 'Marca',
  note: 'Nota',
  description: 'Encargo',
  prompt: 'Instrucciones',
}

/** Fields that are plumbing, not something the owner needs to read. */
const SKIP_FIELDS = new Set(['parent', 'subagent_type', 'run_in_background', 'model'])

/** Notion's rich text arrays, as the words they spell. */
const plain = (v: unknown): string =>
  Array.isArray(v)
    ? v.map((t) => (t as { plain_text?: string; text?: { content?: string } })?.plain_text ?? (t as { text?: { content?: string } })?.text?.content ?? '').join('')
    : ''

/** One Notion property value, the way a person would say it. */
function notionValue(p: unknown): string {
  if (!p || typeof p !== 'object') return String(p ?? '')
  const o = p as Record<string, unknown>
  if ('title' in o) return plain(o.title)
  if ('rich_text' in o) return plain(o.rich_text)
  if ('status' in o) return String((o.status as { name?: string })?.name ?? '')
  if ('select' in o) return String((o.select as { name?: string })?.name ?? '')
  if ('multi_select' in o) return ((o.multi_select as Array<{ name?: string }>) ?? []).map((x) => x?.name).join(', ')
  if ('date' in o) {
    const d = o.date as { start?: string; end?: string } | null
    return d ? [d.start, d.end].filter(Boolean).join(' → ') : '(sin fecha)'
  }
  if ('people' in o) return `${((o.people as unknown[]) ?? []).length} persona(s)`
  if ('checkbox' in o) return o.checkbox ? 'Sí' : 'No'
  if ('number' in o) return String(o.number)
  if ('url' in o) return String(o.url ?? '')
  return JSON.stringify(o)
}

/** A scheduled post, read the way bridge/post-preview.mjs reads it. */
export type PostPreview = { caption: string; media: string[]; networks: string[]; when: string | null; draft: boolean }

const NETWORKS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X',
  youtube: 'YouTube',
  threads: 'Threads',
  pinterest: 'Pinterest',
}

export function postPreview(input: unknown): PostPreview | null {
  if (!input || typeof input !== 'object') return null
  const top = input as Record<string, unknown>
  let info: unknown = top.info
  if (typeof info === 'string') {
    try {
      info = JSON.parse(info)
    } catch {
      info = null
    }
  }
  const src = (info && typeof info === 'object' ? info : top) as Record<string, unknown>
  const caption = typeof src.text === 'string' ? src.text : typeof top.text === 'string' ? top.text : null
  const rawMedia = Array.isArray(src.media) ? src.media : Array.isArray(top.media) ? top.media : []
  const media = rawMedia
    .map((m) => (typeof m === 'string' ? m : ((m as { url?: string })?.url ?? null)))
    .filter((u): u is string => typeof u === 'string' && u.startsWith('https://'))
  if (caption == null && !media.length) return null
  const providers = Array.isArray(src.providers) ? (src.providers as Array<{ network?: string }>) : []
  const pub = src.publicationDate as { dateTime?: string; timezone?: string } | undefined
  const when = pub?.dateTime ?? (typeof top.date === 'string' ? top.date : null)
  return {
    caption: caption ?? '',
    media,
    networks: providers.map((p) => NETWORKS[String(p?.network ?? '').toLowerCase()] ?? String(p?.network ?? '')).filter(Boolean),
    when: when ? when.replace('T', ' ').slice(0, 16) + (pub?.timezone ? ` (${pub.timezone})` : '') : null,
    draft: src.draft === true || src.draft === 'true',
  }
}

export function describeInput(input: unknown): Array<[string, string]> {
  if (!input || typeof input !== 'object') return []
  const post = postPreview(input)
  if (post) {
    const rows: Array<[string, string]> = []
    if (post.draft) rows.push(['Tipo', 'Borrador (no se publica)'])
    if (post.when) rows.push([post.draft ? 'Fecha' : 'Se publica', post.when])
    if (post.networks.length) rows.push(['Redes', post.networks.join(', ')])
    rows.push(['Caption', post.caption || '(sin caption)'])
    return rows
  }
  const entries = Object.entries(input as Record<string, unknown>).filter(
    ([k, v]) => v !== undefined && v !== null && v !== '' && !SKIP_FIELDS.has(k),
  )
  // Notion properties read as their own rows: "Estado: Hecho", not raw JSON.
  const props = entries.find(([k, v]) => k === 'properties' && v && typeof v === 'object')
  const rows: Array<[string, string]> = props
    ? Object.entries(props[1] as Record<string, unknown>).map(([k, v]) => [k, notionValue(v)])
    : []
  return rows.concat(
    entries
      .filter(([k]) => k !== 'properties')
      .map(([k, v]) => [
      FIELD_NAMES[k] ?? humanize(k),
        typeof v === 'string' ? v : Array.isArray(v) ? v.map(String).join(', ') : JSON.stringify(v),
      ]),
  )
}
