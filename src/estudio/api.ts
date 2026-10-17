import { create } from 'zustand'
import { BRIDGE_HTTP_URL, BRIDGE_WS_URL } from '../config'
import type { Edit, ProjectView, Status } from './types'

/** Everything the studio asks the bridge (see bridge/estudio.mjs). */

const base = BRIDGE_HTTP_URL.replace(/\/+$/, '')

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export const api = {
  status: () => call<Status>('/estudio/api/estado'),
  project: (id: string) => call<ProjectView>(`/estudio/api/proyecto?id=${encodeURIComponent(id)}`),
  create: (fuentes: string[], nombre: string) => call<{ trabajo: string }>('/estudio/api/proyecto', { fuentes, nombre }),
  edit: (id: string, cambios: Partial<Edit> & { nombre?: string }, extra: { reemplazos?: { de: string; a: string }[]; palabras?: { fuente: number; indice: number; texto: string }[] } = {}) =>
    call<ProjectView>('/estudio/api/edicion', { id, cambios, ...extra }),
  render: (id: string, vistaPrevia: boolean) => call<{ ok: boolean }>('/estudio/api/render', { id, vistaPrevia }),
  saveStyle: (nombre: string, ajustes: Record<string, any>, opts: { descripcion?: string; porDefecto?: boolean; reemplazar?: boolean } = {}) => call('/estudio/api/estilo', { nombre, ajustes, ...opts }),
  deleteStyle: (nombre: string) => call('/estudio/api/estilo/borrar', { nombre }),
  deleteProject: (id: string) => call('/estudio/api/proyecto/borrar', { id }),
  waveform: (id: string, fuente: number) => call<{ picos: number[]; porSegundo: number }>(`/estudio/api/onda?id=${encodeURIComponent(id)}&fuente=${fuente}`),
}

/** A file from the Nexy folders, as the player can stream it. */
export const mediaUrl = (path: string) => `${base}/estudio/media?path=${encodeURIComponent(path)}`

/** Upload a video into ~/Movies/Nexy/entrada, with progress (0 to 1). */
export function upload(file: File, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/estudio/api/subir?nombre=${encodeURIComponent(file.name)}`)
    xhr.setRequestHeader('content-type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status === 200) resolve(data.ruta)
        else reject(new Error(data.error ?? `HTTP ${xhr.status}`))
      } catch {
        reject(new Error(`HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('No pude subirlo: ¿está corriendo Nexy?'))
    xhr.send(file)
  })
}

/** The socket to the studio: Nexy's chat and the news the editor redraws on. */
export function connect(onMessage: (msg: any) => void, onState: (up: boolean) => void) {
  let ws: WebSocket | null = null
  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined
  const open = () => {
    ws = new WebSocket(`${BRIDGE_WS_URL.replace(/\/+$/, '')}/estudio`)
    ws.onopen = () => onState(true)
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        // Not for us.
      }
    }
    ws.onclose = () => {
      onState(false)
      if (!stopped) retry = setTimeout(open, 2000)
    }
  }
  open()
  return {
    send: (msg: unknown) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)),
    close: () => {
      stopped = true
      clearTimeout(retry)
      ws?.close()
    },
  }
}

/** The playhead, on its own store: it moves sixty times a second and only a few things watch it. */
export const usePlayhead = create<{ t: number; playing: boolean; set: (t: number) => void; setPlaying: (p: boolean) => void }>((set) => ({
  t: 0,
  playing: false,
  set: (t) => set({ t }),
  setPlaying: (playing) => set({ playing }),
}))

export const clock = (t: number) => {
  const s = Math.max(0, t)
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
