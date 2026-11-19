// Dibuja el panel de texto (y la foto, en las imágenes) con la tipografía y colores del sitio de Mi Semago.
const { chromium } = require('playwright')
const fs = require('fs'), path = require('path')
const D = __dirname
const b64 = (f) => 'data:image/' + (f.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(path.join(D, f)).toString('base64')
const css = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1350px;background:transparent}
.foto{position:absolute;left:0;top:0;width:1080px;height:810px;background-size:var(--zoom,cover);background-repeat:no-repeat;background-position:var(--pos,center)}
.panel{position:absolute;left:0;top:770px;width:1080px;height:580px;background:#061a38;clip-path:polygon(0 0,100% 44px,100% 100%,0 100%);padding:92px 64px 0}
.filo{position:absolute;left:0;top:764px;width:1080px;height:60px;background:#c19a32;clip-path:polygon(0 0,100% 44px,100% 52px,0 8px)}
h1{font:700 var(--t,74px)/1.04 Fraunces,serif;color:#fff;letter-spacing:-.5px}
h2{font:700 var(--s,40px)/1.18 Manrope,sans-serif;color:#e6c873;margin-top:18px}
p{font:600 34px/1.3 Manrope,sans-serif;color:#dfe6f2;margin-top:14px}
.pie{position:absolute;left:64px;right:64px;bottom:46px;display:flex;align-items:center;justify-content:space-between}
${''}.cta{font:800 32px Manrope,sans-serif;color:#061a38;background:linear-gradient(180deg,#e6c873,#c19a32);padding:17px 30px;border-radius:999px}
.pie img{height:54px}`
const html = (x, conFoto) => `<html><head><style>${css}</style></head><body>${conFoto ? `<div class="foto" style="background-image:url(${b64(x.foto)});--pos:${x.pos || 'center'}${x.zoom ? ';--zoom:' + x.zoom : ''}"></div>` : ''}<div class="filo"></div><div class="panel" style="--t:${x.t || 74}px;--s:${x.s || 38}px"><h1>${x.h1}</h1>${x.h2 ? `<h2>${x.h2}</h2>` : ''}${x.p ? `<p>${x.p}</p>` : ''}<div class="pie"><span class="cta">${x.cta || 'Escríbenos por WhatsApp'}</span><img src="${b64('logo-white.png')}"></div></div></body></html>`
;(async () => {
  const piezas = JSON.parse(fs.readFileSync(path.join(D, 'piezas.json'), 'utf8'))
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1080, height: 1350 } })
  for (const x of piezas) {
    await pg.setContent(html(x, Boolean(x.foto)), { waitUntil: 'networkidle' }); await pg.evaluate(() => document.fonts.ready)
    await pg.screenshot({ path: path.join(D, x.out), omitBackground: true, type: 'png' })
    const alto = await pg.evaluate(() => { const p = document.querySelector('.panel'); const pie = document.querySelector('.pie'); const u = [...p.children].filter((e) => e !== pie).pop(); return Math.round(pie.getBoundingClientRect().top - u.getBoundingClientRect().bottom) })
    console.log(x.out, 'espacio libre sobre el pie:', alto, 'px')
  }
  await br.close()
})()
