const { chromium } = require('playwright')
const fs = require('fs')
;(async () => {
  const [modo, ...args] = process.argv.slice(2)
  const T_FIN = 28.5
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.addInitScript({ content: `window.PALABRAS=${fs.readFileSync('palabras.json', 'utf8')};window.FRASES=${fs.readFileSync('frases.json', 'utf8')};window.T_FIN=${T_FIN}` })
  await p.goto('file://' + process.cwd() + '/escena.html')
  await p.evaluate(() => document.fonts.ready); await p.evaluate(() => window.render(1)); await p.waitForTimeout(1500)
  if (modo === 'fotos') {
    fs.mkdirSync('fotos', { recursive: true })
    for (const t of args) { await p.evaluate((t) => window.render(+t), t); await p.waitForTimeout(120); await p.screenshot({ path: `fotos/f-${(+t).toFixed(2).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 }) }
  } else {
    const fps = 30, de = +(args[0] ?? 0), a = +(args[1] ?? T_FIN); fs.mkdirSync('cuadros', { recursive: true })
    for (let i = Math.round(de * fps); i < Math.round(a * fps); i++) { await p.evaluate((t) => window.render(t), i / fps); await p.screenshot({ path: `cuadros/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 }) }
  }
  await b.close()
})()
