/**
 * How each connected service looks on the console.
 *
 * A server that is not listed here still appears — with its own name and a
 * plug icon — the moment Nexy connects to it, so nothing breaks when a new app
 * is added. A line here only makes it look nicer. To add Notion, for example:
 *
 *   notion: { label: 'Notion', icon: '📓' },
 *
 * The key is the server's name as it appears in `claude mcp list`.
 */

export type Service = { label: string; icon: string; hidden?: boolean }

export const SERVICES: Record<string, Service> = {
  gmail: { label: 'Gmail', icon: '📧' },
  'google-calendar': { label: 'Calendario', icon: '📅' },
  jarvis_phone: { label: 'Llamadas', icon: '📞' },
  jarvis_contacts: { label: 'Contactos', icon: '👥' },
  jarvis_messages: { label: 'Recados', icon: '📝' },
  jarvis_memory: { label: 'Memoria', icon: '🧠' },
  jarvis_eyes: { label: 'Cámara', icon: '📷' },
  jarvis_chrome: { label: 'Chrome', icon: '🌐' },
  web: { label: 'Internet', icon: '🔎' },
  // Nexy's own screen: busy all the time, and not a connection worth watching.
  jarvis: { label: 'Pantalla', icon: '🖥️', hidden: true },
  jarvis_ui: { label: 'Interfaz', icon: '🎨', hidden: true },
  builtin: { label: 'Sistema', icon: '⚙️', hidden: true },
  notion: { label: 'Notion', icon: '📓' },
  // Añade aquí tus apps nuevas, una línea cada una:
  // instagram: { label: 'Instagram', icon: '📸' },
}

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
  'jarvis_contacts__list_contact_replies': 'Ver respuestas de contactos',
  'jarvis_messages__list_messages': 'Revisar recados',
  'jarvis_messages__clear_messages': 'Borrar recados',
  'jarvis_memory__remember': 'Guardar en memoria',
  'jarvis_memory__forget': 'Olvidar de la memoria',
  'jarvis_memory__list_memories': 'Leer memoria',
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
  return SERVICES[key] ?? { label: humanize(key), icon: '🔌' }
}

export function stepLabel(server: string, tool: string): string {
  return STEPS[`${server}__${tool}`] ?? humanize(tool)
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
}

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

export function describeInput(input: unknown): Array<[string, string]> {
  if (!input || typeof input !== 'object') return []
  const entries = Object.entries(input as Record<string, unknown>).filter(
    ([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'parent',
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
