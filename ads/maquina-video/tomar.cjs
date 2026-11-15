const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const [modo, ...args] = process.argv.slice(2)
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript({ content: `window.PALABRAS=${fs.readFileSync('palabras.json', 'utf8')}` })
  await p.goto('file://' + process.cwd() + '/escena.html')
  await p.waitForTimeout(1500)
  if (modo === 'fotos') {
    for (const t of args) { await p.evaluate((t) => window.render(+t), t); await p.waitForTimeout(80); await p.screenshot({ path: `foto-${t}.png` }) }
  } else {
    const fps = 30, T = +args[0]; fs.mkdirSync('cuadros', { recursive: true })
    for (let i = 0; i < Math.round(T * fps); i++) { await p.evaluate((t) => window.render(t), i / fps); await p.screenshot({ path: `cuadros/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }) }
  }
  await b.close()
})()
