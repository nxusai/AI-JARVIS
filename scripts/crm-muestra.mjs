#!/usr/bin/env node
// La muestra del Centro de trabajo en un solo archivo HTML (sin internet),
// para enseñarla antes de conectar Supabase:
//   node scripts/crm-muestra.mjs [salida.html] [--artefacto]
// --artefacto deja solo el contenido (sin <html>/<head>), para publicarla.
// --consola arma la consola de Ultron (crm/public/ultron) en vez del Centro de trabajo.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const crm = join(dirname(fileURLToPath(import.meta.url)), '..', 'crm', 'public')
const args = process.argv.slice(2)
const artefacto = args.includes('--artefacto')
const consola = args.includes('--consola')
const salida = args.find((a) => !a.startsWith('--')) || 'crm-muestra.html'
const js = await build({ entryPoints: [join(crm, consola ? 'ultron/consola.js' : 'muestra-entrada.js')], bundle: true, format: 'esm', write: false, minify: true, target: 'es2022' })
const css = readFileSync(join(crm, consola ? 'ultron/consola.css' : 'estilo.css'), 'utf8')
const html = readFileSync(join(crm, consola ? 'ultron/index.html' : 'index.html'), 'utf8')
  .replace(consola ? '<link rel="stylesheet" href="/ultron/consola.css">' : '<link rel="stylesheet" href="/estilo.css">', () => `<style>${css}</style>`)
  .replace(consola ? '<script type="module" src="/ultron/consola.js"></script>' : '<script type="module" src="/inicio.js"></script>', () => `<script type="module">${js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace('<title>Centro de trabajo · Mi Semago · Abuelito</title>', '<title>Centro de trabajo</title>')
const fragmento = () => {
  const title = html.match(/<title>.*?<\/title>/)[0]
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0]
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
  return `${title}\n${style}\n${body}`
}
writeFileSync(salida, artefacto ? fragmento() : html)
console.log(`Listo: ${salida} (${Math.round(html.length / 1024)} KB)`)
