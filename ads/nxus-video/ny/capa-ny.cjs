// Renderiza los cuadros de un video de NY: node capa-ny.cjs en 1 [solo,tiempos,separados,por,coma]
const { chromium } = require('playwright')
const fs = require('fs')
const D = __dirname, [lang, hook, prev] = process.argv.slice(2)
const T = 19, CFG = { lang, hook: Number(hook), T }, dir = `${D}/cuadros-${lang}${hook}`
;(async () => {
  fs.mkdirSync(dir, { recursive: true })
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript((c) => { window.CFG = c }, CFG)
  await p.goto('file://' + D + '/capa-ny.html')
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(800)
  const ts = prev ? prev.split(',').map(Number) : Array.from({ length: Math.ceil(T * 30) }, (_, f) => f / 30)
  for (const [i, t] of ts.entries()) {
    await p.evaluate((t) => window.render(t), t)
    await p.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.${prev ? 'png' : 'jpg'}`, ...(prev ? {} : { type: 'jpeg', quality: 95 }) })
  }
  await b.close()
  console.log(lang + hook, 'cuadros', ts.length)
})()
