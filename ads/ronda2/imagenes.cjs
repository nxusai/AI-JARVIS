const { chromium } = require('playwright')
const D = __dirname
const C = {
  D: { fondo: 'claves/k1.png', pregunta: '¿Su negocio tiene <b>varias sucursales</b>?', lema: 'Una IA contesta y agenda citas en todas sus sucursales.', puntos: ['Diagnóstico gratis', 'Funcionando en 7 días'] },
  E: { fondo: 'claves/k5.png', pregunta: '¿Sabe dónde está su <b>equipo</b> AHORA?', lema: 'Rutas y visitas de su equipo en una sola pantalla.', puntos: ['Plataforma a la medida', 'Diagnóstico gratis'] },
  F: { fondo: 'claves/k7.png', pregunta: 'Escríbanos… <b>y en 1 minuto una IA le llama</b>', lema: 'Así de rápido le contestaría a sus clientes.', puntos: ['Pruébelo usted mismo', 'Diagnóstico gratis'] },
}
;(async () => {
  const b = await chromium.launch()
  for (const [k, c] of Object.entries(C)) for (const [nom, alto] of [['feed', 1350], ['historia', 1920]]) {
    const p = await b.newPage({ viewport: { width: 1080, height: alto } })
    await p.goto('file://' + D + '/imagenes.html')
    await p.evaluate(([c, alto]) => window.pintar(c, alto), [c, alto])
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700)
    await p.screenshot({ path: `${D}/NXUS-R2-${k}-${nom}.png` })
    await p.close()
  }
  await b.close(); console.log('imágenes listas')
})()
