const { chromium } = require('playwright'); const fs = require('fs')
const D = __dirname, MODO = process.argv[2], P = JSON.parse(fs.readFileSync(D + '/plan.json', 'utf8'))
const prueba = process.argv[3] ? process.argv[3].split(',').map(Number) : null
;(async () => {
  const out = `${D}/${prueba ? 'p-' : ''}${MODO}`; fs.mkdirSync(out, { recursive: true })
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript(([c, m]) => { window.CFG = c; window.MODO = m }, [P, MODO])
  await p.goto('file://' + D + '/capa.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
  const ts = prueba || Array.from({ length: Math.round(P.T * 30) }, (_, f) => f / 30)
  for (let i = 0; i < ts.length; i++) { await p.evaluate((t) => window.render(t), ts[i]); await p.screenshot({ path: `${out}/${String(i).padStart(4, '0')}.png`, omitBackground: true }) }
  await b.close(); console.log(MODO, ts.length)
})()
