import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA } from './lugar.mjs'

/**
 * Las instrucciones vigentes que Ultron les da a sus IAs ("hoy no prometan
 * entregas"). Ultron las guarda aquí, en la misma máquina, y cada IA las lee
 * con cada mensaje, así que valen desde ese momento.
 *
 *   <data>/ultron-instrucciones.json   [{ para: 'ana-sofi' | 'todas', texto, desde }]
 */

export const INSTRUCCIONES_FILE = join(DATA, 'ultron-instrucciones.json')

export function leerInstrucciones(para) {
  try {
    const lista = JSON.parse(readFileSync(INSTRUCCIONES_FILE, 'utf8'))
    return (Array.isArray(lista) ? lista : []).filter((i) => i && typeof i.texto === 'string' && (!para || i.para === para || i.para === 'todas'))
  } catch {
    return []
  }
}

export function escribirInstrucciones(lista) {
  mkdirSync(DATA, { recursive: true })
  writeFileSync(INSTRUCCIONES_FILE, `${JSON.stringify(lista, null, 2)}\n`, { mode: 0o600 })
  chmodSync(INSTRUCCIONES_FILE, 0o600)
}

/** Para pegarlas a un mensaje: una línea por instrucción, o nada. */
export function instruccionesEnTexto(para) {
  const lista = leerInstrucciones(para)
  if (!lista.length) return ''
  return `\n[Instrucciones vigentes de la dirección (síguelas): ${lista.map((i) => i.texto).join(' · ')}]`
}
