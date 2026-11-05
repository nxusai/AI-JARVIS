// Graba pantallas de un sitio para una lección: cada toma es una página con movimientos de
// cursor y scroll suaves. Deja un .webm por toma en public/curso/<leccion>/ y un tomas.json con
// cuándo quedó lista la página (para cortar la carga en la edición).
//
//   node cursos/grabar.mjs cursos/leccion-1.json          graba las tomas que faltan
//   node cursos/grabar.mjs cursos/leccion-1.json home     vuelve a grabar una
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Playwright viene instalado en la máquina (no en el proyecto).
const { chromium } = createRequire(import.meta.url)('playwright')
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const guion = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const SALIDA = join(RAIZ, 'public', 'curso', guion.id)
mkdirSync(SALIDA, { recursive: true })

// Un cursor visible (el headless no dibuja el del sistema), con un halo al hacer clic.
const CURSOR = `(() => {
  if (document.getElementById('__cursor')) return;
  const c = document.createElement('div'); c.id = '__cursor';
  c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(960px,540px);transition:transform 0s;';
  c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(c);
  addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
})()`

// Quita avisos que tapan la pantalla (cookies, invitaciones, ventanas emergentes), y los que aparezcan después.
const LIMPIAR = `(() => {
  const molesto = /cookie|discord|comunidad en espa|newsletter|subscribe|suscr/i;
  const limpiar = () => {
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && el.childElementCount < 40 && el.id !== '__cursor' && !el.closest('header,nav') && molesto.test((el.innerText || '').slice(0, 400))) el.style.setProperty('display', 'none', 'important');
    }
  };
  limpiar(); setInterval(limpiar, 300);
})()`

/** Mueve el mouse en curva suave (ease in-out) de donde está a (x, y). */
async function mover(p, desde, x, y, ms = 900) {
  const pasos = Math.max(12, Math.round(ms / 16))
  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    await p.mouse.move(desde.x + (x - desde.x) * e, desde.y + (y - desde.y) * e + Math.sin(t * Math.PI) * -18)
    await p.waitForTimeout(16)
  }
  desde.x = x; desde.y = y
}

/** Scroll suave de `px` en `ms`. */
async function deslizar(p, px, ms = 1500) {
  const pasos = Math.round(ms / 16)
  let hecho = 0
  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const objetivo = px * e
    await p.mouse.wheel(0, objetivo - hecho)
    hecho = objetivo
    await p.waitForTimeout(16)
  }
}

/** Cuánto duran los pasos de una toma (para saber cuándo quedó lista sin volver a grabarla). */
const duracionPasos = (toma) => (toma.pasos ?? []).reduce((s, p) => s + (p.ms ?? (p.scroll ? 1500 : 900)) + (p.pausa ?? 0), 0) / 1000 + (toma.final ?? 600) / 1000

const duracionDe = (archivo) => {
  const r = createRequire(import.meta.url)('node:child_process').spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { encoding: 'utf8' })
  return Number(r.stdout.trim()) || 0
}

const LIMITE = 90_000
const rehacer = process.argv[3]
const RESUMEN = join(SALIDA, 'tomas.json')
const anterior = existsSync(RESUMEN) ? JSON.parse(readFileSync(RESUMEN, 'utf8')) : []
const navegador = await chromium.launch()
const resumen = []
const guardar = () => writeFileSync(RESUMEN, JSON.stringify(resumen, null, 2))
for (const toma of guion.tomas) {
  const archivo = join(SALIDA, `${toma.nombre}.webm`)
  if (existsSync(archivo) && rehacer !== toma.nombre) {
    // Ya grabada: se conserva; si no hay registro, se calcula cuándo quedó lista.
    const total = duracionDe(archivo)
    resumen.push(anterior.find((t) => t.nombre === toma.nombre) ?? { nombre: toma.nombre, lista: +Math.max(0, total - duracionPasos(toma)).toFixed(2), total: +total.toFixed(2) })
    guardar()
    continue
  }
  const ctx = await navegador.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: SALIDA, size: { width: 1920, height: 1080 } }, locale: 'es-MX' })
  const p = await ctx.newPage()
  const inicio = Date.now()
  // Una página que se traba no detiene la lección: se corta y se sigue con la siguiente.
  const corte = setTimeout(() => ctx.close().catch(() => {}), LIMITE)
  try {
  await p.goto(toma.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(toma.espera ?? 4500)
  await p.keyboard.press('Escape').catch(() => {})
  await p.evaluate(LIMPIAR).catch(() => {})
  await p.waitForTimeout(400)
  await p.evaluate(CURSOR)
  const raton = { x: 960, y: 620 }
  await p.mouse.move(raton.x, raton.y)
  await p.waitForTimeout(300)
  const lista = (Date.now() - inicio) / 1000
  for (const paso of toma.pasos ?? []) {
    if (paso.hover) {
      const el = p.getByText(paso.hover, { exact: true }).first()
      const caja = await el.boundingBox().catch(() => null)
      if (caja) await mover(p, raton, caja.x + caja.width / 2, caja.y + caja.height / 2, paso.ms ?? 700)
    } else if (paso.ir) await mover(p, raton, paso.ir[0], paso.ir[1], paso.ms ?? 900)
    else if (paso.scroll) await deslizar(p, paso.scroll, paso.ms ?? 1500)
    else if (paso.clic) {
      await mover(p, raton, paso.clic[0], paso.clic[1], paso.ms ?? 700)
      await p.mouse.click(paso.clic[0], paso.clic[1]).catch(() => {})
    } else if (paso.escribir) await p.keyboard.type(paso.escribir, { delay: paso.cada ?? 35 })
    else if (paso.campo) {
      // Llenar un campo: el cursor va a él, da clic y escribe (o solo da clic si no hay texto).
      const caja = await p.locator(paso.campo).first().boundingBox().catch(() => null)
      if (caja) {
        await mover(p, raton, caja.x + Math.min(caja.width / 2, 160), caja.y + caja.height / 2, paso.ms ?? 600)
        await p.mouse.click(raton.x, raton.y).catch(() => {})
        if (paso.texto) await p.keyboard.type(paso.texto, { delay: paso.cada ?? 35 })
      }
    }
    if (paso.pausa) await p.waitForTimeout(paso.pausa)
  }
  await p.waitForTimeout(toma.final ?? 600)
  const video = p.video()
  clearTimeout(corte)
  await ctx.close()
  renameSync(await video.path(), archivo)
  resumen.push({ nombre: toma.nombre, lista: +lista.toFixed(2), total: +((Date.now() - inicio) / 1000).toFixed(2) })
  guardar()
  console.log(`🎥 ${toma.nombre}: lista en ${lista.toFixed(1)} s`)
  } catch (err) {
    clearTimeout(corte)
    await ctx.close().catch(() => {})
    const video = p.video()
    if (video) rmSync(await video.path().catch(() => ''), { force: true })
    console.log(`❌ ${toma.nombre}: ${err.message.split('\n')[0]}`)
  }
}
await navegador.close()
