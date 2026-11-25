const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const [modo, ...args] = process.argv.slice(2)
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.goto('file://' + process.cwd() + '/escena.html')
  await p.waitForTimeout(2000); await p.evaluate(() => document.fonts.ready)
  if (modo === 'fotos') {
    for (const t of args) { await p.evaluate((t) => window.render(+t), t); await p.screenshot({ path: `foto-${t}.jpg`, type: 'jpeg', quality: 85 }) }
  } else {
    const fps = 30, [a, z] = args.map(Number); fs.mkdirSync('cuadros', { recursive: true })
    for (let i = Math.round(a * fps); i < Math.round(z * fps); i++) { await p.evaluate((t) => window.render(t), i / fps); await p.screenshot({ path: `cuadros/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 }) }
  }
  await b.close()
})()
