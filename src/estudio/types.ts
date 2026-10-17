/** The shapes the bridge's studio API sends (see bridge/estudio.mjs and bridge/reels/proyectos.mjs). */

export type Word = { text: string; start: number; end: number }

export type Source = {
  fuente: string
  file: string
  duration: number
  width: number
  height: number
  audio: boolean
  engine: string | null
  words: Word[]
}

export type Range = { fuente: number; inicio: number; fin: number }

export type TextOverlay = { texto: string; inicio: number; fin: number; altura?: number; tamano?: number; color?: string }

export type ZoomMark = { fuente?: number; t: number; escala: number }

export type Edit = {
  estilo: string | null
  ajustes: Record<string, any> | null
  quitar: Range[]
  solo: Range[]
  forzar: Range[]
  titulo: string
  musica: string | null
  textos: TextOverlay[]
  zooms: ZoomMark[]
}

export type Style = {
  formato: '9:16' | '4:5' | '1:1' | '16:9'
  encuadre: { modo: 'cover' | 'blur'; x: number; y: number }
  cortes: { activo: boolean; silencioDb: number; pausaMax: number; margen: number; quitarMuletillas: boolean; minimo: number }
  zoom: { activo: boolean; tipo: 'golpe' | 'suave'; escala: number; cada: number }
  subtitulos: {
    activo: boolean
    animacion: 'palabra' | 'pop' | 'frase'
    fuente: string
    tamano: number
    color: string
    resaltado: string
    contorno: string
    grosor: number
    sombra: boolean
    altura: number
    palabras: number
    mayusculas: boolean
  }
  titulo: { activo: boolean; segundos: number; fuente: string; tamano: number; color: string; fondo: string; altura: number; mayusculas: boolean }
  color: { contraste: number; saturacion: number; brillo: number }
  audio: { lufs: number; limpiar: boolean }
  musica: { volumen: number; ducking: boolean }
}

/** One kept piece of a recording, placed on the reel's clock. */
export type Piece = { source: number; start: number; end: number; at: number; zoom: number }

export type Phrase = { start: number; end: number; words: Word[] }

export type Plan = {
  edit: Edit
  style: Style
  styleName: string
  size: [number, number]
  pieces: Piece[]
  words: Word[]
  phrases: Phrase[]
  length: number
  total: number
}

export type Version = { fecha: string; salida: string; estilo: string; titulo: string; vistaPrevia: boolean; duracion?: number }

export type Project = { id: string; nombre: string; creado: string; fuentes: Source[]; versiones: Version[] }

export type ProjectView = { proyecto: Project; plan: Plan; renderizando: number | null }

export type ProjectSummary = { id: string; nombre: string; creado: string; actualizado: string; duracion: number; fuentes: number; versiones: number; ultima: string | null; portada: string | null }

export type SavedStyle = { nombre: string; descripcion: string; ajustes: Record<string, any>; referencias: string[] }

export type FileItem = { nombre: string; ruta: string; mb: number; fecha: string }

export type Status = {
  motor: { ffmpeg: boolean; transcripcion: string | null }
  proyectos: ProjectSummary[]
  estilos: SavedStyle[]
  gustos: { respuestas: Record<string, string>; leGusta: string[]; noLeGusta: string[]; estiloPorDefecto: string | null; pendientes: { clave: string; pregunta: string }[] }
  entrada: FileItem[]
  referencias: FileItem[]
  musica: FileItem[]
  listos: FileItem[]
  renders: Record<string, number>
}

export type ChatMessage = { de: 'yo' | 'nexy'; texto: string; fecha: string }

export type RenderState = { estado: 'renderizando' | 'listo' | 'error'; progreso?: number; salida?: string; error?: string; vistaPrevia?: boolean }
