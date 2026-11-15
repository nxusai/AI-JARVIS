#!/usr/bin/env node
// Finished videos and images for the team, by Telegram (see bridge/entregas.mjs).
//
//   node scripts/entregas.mjs estado            the Drive folder, the team's group and what waits for the owner's yes
//   node scripts/entregas.mjs carpeta [correo]  choose which Google Drive account's "Videos listos NXUS" to watch
//
// Nothing here sends anything: sending is only the owner's tap in Telegram.

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FOLDER_NAME, driveFolders, findFolder, readDeliveries, writeDeliveries } from '../bridge/entregas.mjs'

const cmd = process.argv[2]
if (cmd === 'carpeta') {
  // Google Drive for desktop keeps each account under ~/Library/CloudStorage/GoogleDrive-<correo>.
  const want = (process.argv[3] ?? '').toLowerCase()
  const cloud = join(homedir(), 'Library', 'CloudStorage')
  const drives = existsSync(cloud) ? readdirSync(cloud).filter((d) => d.startsWith('GoogleDrive-')) : []
  const drive = want ? drives.find((d) => d.toLowerCase().includes(want)) : drives.length === 1 ? drives[0] : null
  if (!drive) {
    console.log(drives.length ? ` Hay varias cuentas de Google Drive: ${drives.map((d) => d.slice(12)).join(', ')}.\n Escribe cuál: node scripts/entregas.mjs carpeta correo@ejemplo.com` : ' No encuentro Google Drive en esta Mac. Abre la app Google Drive, inicia sesión y vuelve a correr esto.')
    process.exit(1)
  }
  const root = ['My Drive', 'Mi unidad'].map((n) => join(cloud, drive, n)).find((p) => existsSync(p))
  if (!root) {
    console.log(` No encuentro "Mi unidad" dentro de ${drive}. Abre la app Google Drive, espera a que termine de cargar y vuelve a intentarlo.`)
    process.exit(1)
  }
  const carpeta = join(root, FOLDER_NAME)
  mkdirSync(carpeta, { recursive: true })
  writeDeliveries({ ...readDeliveries(), carpeta })
  console.log(` ✅ Carpeta lista: ${carpeta}\n (En Google Drive se ve como "Mi unidad › ${FOLDER_NAME}".) No hace falta reiniciar NEX.`)
} else if (cmd === 'estado') {
  const state = readDeliveries()
  const dir = findFolder(state)
  const all = Object.values(state.entregas)
  console.log(dir ? ` Carpeta: ${dir}` : ` Carpeta: NO la encuentro (${state.carpeta ?? `"${FOLDER_NAME}" en Google Drive`}). ¿Está abierta la app Google Drive? Para elegirla: node scripts/entregas.mjs carpeta`)
  if (!state.carpeta && driveFolders().length > 1) console.log(` Ojo: hay ${driveFolders().length} cuentas con esa carpeta; uso la primera. Para elegir: node scripts/entregas.mjs carpeta correo@ejemplo.com`)
  console.log(state.grupo ? ` Grupo del equipo: ${state.grupo.titulo}` : ' Grupo del equipo: falta. En Telegram, agrega el bot al grupo y escribe ahí /grupovideos')
  const waiting = all.filter((e) => e.estado === 'pendiente')
  console.log(` Esperan tu ✅ en Telegram: ${waiting.length ? waiting.map((e) => e.nombre).join(', ') : 'nada'}`)
  console.log(` Mandados al equipo: ${all.filter((e) => e.estado === 'enviado').length} · No mandados: ${all.filter((e) => e.estado === 'descartado').length}`)
} else {
  console.log(' Uso: node scripts/entregas.mjs estado | carpeta [correo]')
  process.exit(1)
}
