#!/usr/bin/env node
// La muestra del Inventario Mi Semago en un solo archivo HTML (sin internet),
// para verla antes de conectar Supabase:
//   node scripts/inventario-muestra.mjs [salida.html] [--artefacto]
// --artefacto deja solo el contenido (sin <html>/<head>), para publicarla.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'inventario', 'public')
const args = process.argv.slice(2)
const artefacto = args.includes('--artefacto')
const salida = args.find((a) => !a.startsWith('--')) || 'inventario-muestra.html'
const png = (f) => `data:image/png;base64,${readFileSync(join(pub, 'img', f)).toString('base64')}`
const imagenes = (t) => t.replaceAll('/img/logo.png', png('logo.png')).replaceAll('/img/icono.png', png('icono.png'))
const js = await build({ entryPoints: [join(pub, 'muestra-entrada.js')], bundle: true, format: 'esm', write: false, minify: true, target: 'es2022' })
const css = readFileSync(join(pub, 'estilo.css'), 'utf8')
const html = imagenes(
  readFileSync(join(pub, 'index.html'), 'utf8')
    .replace('<link rel="stylesheet" href="/estilo.css">', () => `<style>${css}</style>`)
    .replace('<script type="module" src="/inicio.js"></script>', () => `<script type="module">${js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`),
)
const fragmento = () => {
  const title = html.match(/<title>.*?<\/title>/)[0]
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0]
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
  return `${title}\n${style}\n${body}`
}
writeFileSync(salida, artefacto ? fragmento() : html)
console.log(`Listo: ${salida} (${Math.round(html.length / 1024)} KB)`)
