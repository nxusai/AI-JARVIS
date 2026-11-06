const { chromium } = require('playwright')
const fs = require('fs')
const D = __dirname, V = process.argv[2]
const plan = JSON.parse(fs.readFileSync(D + '/plan.json', 'utf8'))[V]
;(async () => {
  fs.mkdirSync(`${D}/capa-${V}`, { recursive: true })
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript((c) => { window.CFG = c }, plan)
  await p.goto('file://' + D + '/capa.html')
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(800)
  const FPS = 30, n = Math.ceil(plan.T * FPS)
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.render(t), f / FPS)
    await p.screenshot({ path: `${D}/capa-${V}/${String(f).padStart(4, '0')}.png`, omitBackground: true })
  }
  await b.close()
  console.log(V, 'cuadros', n)
})()
