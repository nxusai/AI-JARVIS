// La consola de Ultron, aparte del Centro de trabajo. Aquí Ultron es completo:
// habla con las IAs que tiene debajo, da instrucciones, resume y recuerda.
// Solo entra la dirección (Senen, Gerardo, Marisol, Miguel).
//
// Tres vistas: Consola (el núcleo y la voz), Ecosistema (todo lo que controla,
// con sus IAs debajo) y Memoria (lo que sabe y las instrucciones vigentes).
// Por ahora es la muestra: contesta con datos de ejemplo y no hay voz real.

const $ = (s, r = document) => r.querySelector(s)
const h = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const sinTilde = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const MOVIMIENTO = !matchMedia('(prefers-reduced-motion: reduce)').matches

// -- el núcleo: una esfera de partículas de luz ---------------------------------

class Nucleo {
  constructor(canvas, { color = [255, 154, 46], puntos = 3200, piso = true, escala = 0.33, apagado = false } = {}) {
    Object.assign(this, { canvas, color, piso, escala, apagado })
    this.ctx = canvas.getContext('2d')
    this.amp = 0
    this.meta = 0
    this.rot = Math.random() * 6
    this.p = []
    const oro = Math.PI * (3 - Math.sqrt(5))
    const nSup = Math.round(puntos * 0.6)
    for (let i = 0; i < nSup; i++) {
      const y = 1 - (i / (nSup - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const t = oro * i
      this.p.push([Math.cos(t) * r, y, Math.sin(t) * r, 1, Math.random() * 6.28, 0.7 + Math.random() * 0.6])
    }
    // Bandas (latitudes con huecos) que le dan estructura de "máquina".
    for (const lat of [-0.62, -0.3, 0.05, 0.38, 0.7]) {
      const n = Math.round(puntos * 0.05)
      const r = Math.sqrt(1 - lat * lat)
      for (let i = 0; i < n; i++) {
        const t = (i / n) * 6.28
        if (Math.sin(t * 3 + lat * 10) > 0.55) continue
        this.p.push([Math.cos(t) * r * 1.04, lat, Math.sin(t) * r * 1.04, 1, Math.random() * 6.28, 1.3])
      }
    }
    // Interior.
    const nIn = Math.round(puntos * 0.15)
    for (let i = 0; i < nIn; i++) {
      const u = Math.random() * 2 - 1
      const t = Math.random() * 6.28
      const r = 0.25 + Math.random() * 0.6
      const s = Math.sqrt(1 - u * u)
      this.p.push([Math.cos(t) * s * r, u * r, Math.sin(t) * s * r, 1, Math.random() * 6.28, 0.6])
    }
    this.polvo = Array.from({ length: piso ? 70 : 18 }, () => [Math.random(), Math.random(), 0.2 + Math.random() * 0.8])
    this.medir()
  }
  medir() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const hh = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== hh) {
      this.canvas.width = w
      this.canvas.height = hh
    }
    this.dpr = dpr
  }
  /** Que "hable" un rato (la esfera late con la voz). */
  hablar(ms) {
    this.hastaHablar = performance.now() + ms
  }
  pintar(t) {
    const { ctx, canvas, color: c, dpr } = this
    const w = canvas.width
    const H = canvas.height
    if (!w || !H) return
    const hablando = this.hastaHablar > t
    this.meta = hablando ? 0.55 + 0.45 * Math.abs(Math.sin(t * 0.011) * Math.sin(t * 0.0047)) : this.escuchando ? 0.25 : 0.06
    this.amp += (this.meta - this.amp) * 0.12
    const amp = this.apagado ? 0.02 : this.amp
    const luz = this.apagado ? 0.45 : 1
    const cx = w / 2
    const cy = H * (this.piso ? 0.42 : 0.5)
    const R = Math.min(w, H) * this.escala * (1 + amp * 0.05)
    const rgb = `${c[0]},${c[1]},${c[2]}`
    ctx.clearRect(0, 0, w, H)

    // Piso: anillos en perspectiva.
    if (this.piso) {
      ctx.globalCompositeOperation = 'source-over'
      const py = cy + R * 1.42
      const g = ctx.createRadialGradient(cx, py, 0, cx, py, R * 2.4)
      g.addColorStop(0, `rgba(${rgb},${0.22 * luz})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx, py, R * 2.6, R * 0.55, 0, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 1; i <= 7; i++) {
        ctx.strokeStyle = `rgba(${rgb},${(0.2 - i * 0.022) * luz})`
        ctx.lineWidth = dpr
        ctx.beginPath()
        ctx.ellipse(cx, py, R * (0.35 + i * 0.36), R * (0.07 + i * 0.07), 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalCompositeOperation = 'lighter'

    // Halo.
    const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6)
    halo.addColorStop(0, `rgba(${rgb},${(0.2 + amp * 0.15) * luz})`)
    halo.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = halo
    ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4)

    // Anillo de marcas y fragmentos de HUD.
    this.rot += (MOVIMIENTO ? 0.0024 : 0.0006) + amp * 0.012
    ctx.lineWidth = dpr
    ctx.strokeStyle = `rgba(${rgb},${0.18 * luz})`
    for (let a = 0; a < 120; a++) {
      const ang = (a / 120) * 6.283 - this.rot * 0.3
      const r1 = R * 1.36
      const r2 = R * (a % 10 === 0 ? 1.42 : 1.39)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
      ctx.stroke()
    }
    for (let i = 0; i < 7; i++) {
      const a0 = i * 0.9 + this.rot * (i % 2 ? 0.7 : -0.5)
      ctx.strokeStyle = `rgba(${rgb},${(0.35 + (i % 3) * 0.12) * luz})`
      ctx.lineWidth = (i % 3 === 0 ? 3.2 : 1.6) * dpr
      ctx.beginPath()
      ctx.arc(cx, cy, R * (1.16 + (i % 4) * 0.045), a0, a0 + 0.35 + (i % 3) * 0.25)
      ctx.stroke()
    }

    // Órbitas.
    for (let i = 0; i < 3; i++) {
      const inc = [0.32, 0.55, 0.18][i]
      const giro = this.rot * [1.3, -0.9, 0.6][i] + i
      for (const [ancho, alfa] of [[5, 0.08], [1.4, 0.55]]) {
        ctx.strokeStyle = `rgba(${rgb},${alfa * luz})`
        ctx.lineWidth = ancho * dpr
        ctx.beginPath()
        ctx.ellipse(cx, cy, R * 1.05, R * inc, giro, 0.2, 4.4)
        ctx.stroke()
      }
    }

    // Partículas (agrupadas por brillo para pintar rápido).
    const cs = Math.cos(this.rot)
    const sn = Math.sin(this.rot)
    const ct = Math.cos(0.38)
    const st = Math.sin(0.38)
    const cubetas = Array.from({ length: 8 }, () => [])
    const tt = t * 0.004
    for (const p of this.p) {
      const sacude = 1 + amp * 0.09 * Math.sin(tt + p[4])
      const x0 = p[0] * sacude
      const y0 = p[1] * sacude
      const z0 = p[2] * sacude
      const x = x0 * cs - z0 * sn
      const z1 = x0 * sn + z0 * cs
      const y = y0 * ct - z1 * st
      const z = y0 * st + z1 * ct
      const prof = (z + 1) / 2
      const k = Math.min(7, Math.floor(prof * prof * 8))
      const esc = 1 + z * 0.12
      cubetas[k].push(cx + x * R * esc, cy + y * R * esc, (0.5 + prof * 1.5) * p[5] * dpr)
    }
    cubetas.forEach((lista, k) => {
      ctx.fillStyle = `rgba(${rgb},${(0.12 + (k / 7) * 0.85) * luz})`
      for (let i = 0; i < lista.length; i += 3) ctx.fillRect(lista[i], lista[i + 1], lista[i + 2], lista[i + 2])
    })

    // Núcleo.
    const rn = R * (0.34 + amp * 0.16)
    const nucleo = ctx.createRadialGradient(cx, cy, 0, cx, cy, rn)
    nucleo.addColorStop(0, `rgba(255,248,230,${0.95 * luz})`)
    nucleo.addColorStop(0.25, `rgba(${rgb},${0.75 * luz})`)
    nucleo.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = nucleo
    ctx.beginPath()
    ctx.arc(cx, cy, rn, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2 * dpr
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,230,190,${(0.5 - i * 0.12) * luz})`
      ctx.beginPath()
      const a = -this.rot * (3 + i) + i * 2
      ctx.arc(cx, cy, R * (0.16 + i * 0.05), a, a + 2.2)
      ctx.stroke()
    }

    // Polvo de luz.
    ctx.fillStyle = `rgba(${rgb},${0.5 * luz})`
    for (const d of this.polvo) {
      d[1] -= 0.0006 * d[2]
      if (d[1] < 0) d[1] = 1
      ctx.fillRect(d[0] * w, d[1] * H, 1.6 * dpr * d[2], 1.6 * dpr * d[2])
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

/** Ondas de voz (escuchando o hablando). */
class Onda {
  constructor(canvas, fuente, { barras = 90, compacta = false } = {}) {
    Object.assign(this, { canvas, fuente, barras, compacta })
    this.ctx = canvas.getContext('2d')
    this.fase = Math.random() * 10
  }
  medir() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
  }
  pintar(t) {
    const { ctx, canvas } = this
    const w = canvas.width
    const H = canvas.height
    if (!w) return
    ctx.clearRect(0, 0, w, H)
    const amp = Math.max(0.05, this.fuente.amp)
    const n = this.barras
    const paso = w / n
    for (let i = 0; i < n; i++) {
      const x = i * paso + paso / 2
      const centro = 1 - Math.abs(i - n / 2) / (n / 2)
      const v = Math.abs(Math.sin(i * 0.45 + t * 0.008 + this.fase) * Math.sin(i * 0.13 - t * 0.003)) * (0.25 + centro * 0.75)
      const alto = Math.max(1.5, v * amp * H * (this.compacta ? 0.9 : 1.1) + (i % 7 === 0 ? amp * H * 0.25 : 0))
      ctx.fillStyle = `rgba(255,${150 + Math.round(v * 80)},${40 + Math.round(v * 60)},${0.35 + v * 0.6})`
      ctx.fillRect(x - Math.max(1, paso * 0.18), H / 2 - alto / 2, Math.max(1.2, paso * 0.36), alto)
    }
  }
}

const vivos = new Set()
function animar(t) {
  for (const v of vivos) if (v.canvas.isConnected && v.canvas.offsetParent !== null) v.pintar(t)
  requestAnimationFrame(animar)
}
addEventListener('resize', () => {
  for (const v of vivos) v.medir()
  dibujarLineas()
})

// -- los datos de la muestra ---------------------------------------------------

const YO = 'Senen'
const CABEZAS = ['Senen', 'Gerardo', 'Marisol', 'Miguel']
const IAS = [
  { nombre: 'Ana Sofi', empresa: 'Mi Semago', color: [79, 155, 255], css: '#6fb0ff', activa: true, corto: '14 conversaciones · 3 tandas de etiquetas · 1 duda de precios pasada a ventas.' },
  { nombre: 'Abuelito', empresa: 'Abuelito INC · Cheese · Meat · Corn', color: [255, 200, 70], css: '#ffd166', activa: false, corto: 'Todavía no nace. La construimos después.' },
  { nombre: 'Vivian', empresa: 'VAYRO', color: [192, 140, 255], css: '#c9a2ff', activa: false, corto: 'Todavía no nace. La construimos después.' },
]
const MODULOS = {
  izq: [
    { nombre: 'Comunicación', icono: 'chat', chips: [['Telegram', true], ['Llamadas', false], ['WhatsApp', false]] },
    { nombre: 'Clientes', icono: 'gente', chips: [['Centro de trabajo', true], ['Seguimiento', true]] },
    { nombre: 'Marketing', icono: 'barras', chips: [['Contenido', false], ['Anuncios', false]] },
  ],
  der: [
    { nombre: 'Operaciones', icono: 'engrane', chips: [['Tareas', true], ['Etiquetas', true], ['Rutas', false]] },
    { nombre: 'Memoria', icono: 'datos', chips: [['Documentos', true], ['Conocimiento', true]] },
    { nombre: 'Agenda', icono: 'calendario', chips: [['Citas', false], ['Recordatorios', false]] },
  ],
}
const ICONOS = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><circle cx="8.5" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="15.5" cy="12" r=".6" fill="currentColor"/></svg>',
  gente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/></svg>',
  barras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 20v-6M10 20V10M15 20V7M20 20V4"/></svg>',
  engrane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  datos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/></svg>',
  calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
}
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>'

const M = {
  instrucciones: [{ texto: 'Ana Sofi no da precios: los pasa a ventas.', cuando: 'Regla de siempre' }],
  hoy: [
    { quien: 'Ana Sofi', corto: '14 conversaciones · 3 tandas de etiquetas · 1 duda de precios pasada a ventas.', largo: '9:10 Carlos (bodega) pidió 40 etiquetas de quesillo 5 lb vacío: impresas. 11:32 Lupita preguntó la caducidad del queso duro blando: 54 días. 13:05 Un empleado preguntó el precio a mayoreo: no lo da, lo pasó a ventas. 15:40 Dos tandas más (cuajada y crema).' },
    { quien: 'Centro de trabajo', corto: '5 tareas abiertas · 1 esperando revisión · 1 urgente.', largo: '#4 Label chorizo salvadoreño 1 lb (urgente, en proceso). #3 Catálogo de quesos para distribuidores (corrección 2 en proceso). #5 Post de Instagram queso fresco (recibida). #7 Formato de inventario semanal (lista para revisar). #8 Letrero de bodega (en proceso).' },
  ],
  ultima: 'Sin acciones todavía hoy.',
}

function responder(texto) {
  const q = sinTilde(texto)
  if (/complet|explica|detalle/.test(q)) {
    const de = /centro|tarea/.test(q) ? M.hoy[1] : M.hoy[0]
    return { texto: `${de.quien}, completo:\n${de.largo}` }
  }
  const orden = q.match(/(?:dile|avisa|ordena|indica)(?:le)? a (ana sofi|vivian|abuelito)[,:]?\s*(?:que\s*)?(.*)$/)
  if (orden) {
    const ia = IAS.find((x) => sinTilde(x.nombre) === orden[1])
    if (!ia.activa) return { texto: `${ia.nombre} todavía no está activa. Cuando nazca, le paso la instrucción.` }
    const inst = texto.slice(texto.length - orden[2].length).trim() || texto
    M.instrucciones.unshift({ texto: `${ia.nombre}: ${inst}`, cuando: `Hoy, ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })} · ${YO}` })
    M.ultima = `Instrucción a ${ia.nombre}: “${inst}”`
    pintarLado()
    return { texto: `Hecho. **${ia.nombre}** ya tiene la instrucción: “${inst}”. Queda en mi memoria y la aplica desde ahora.` }
  }
  if (/ana sofi|empleado|que hizo|hicieron/.test(q)) return { texto: `Ana Sofi, hoy: **${M.hoy[0].corto}** Sin problemas.`, acciones: [{ etiqueta: 'Explicación completa', pregunta: 'Explícame completo lo de Ana Sofi' }] }
  if (/agente|ias|quien|equipo/.test(q)) return { texto: `Tengo **1 IA activa**: Ana Sofi (Mi Semago). Abuelito y Vivian (VAYRO) están por nacer. Arriba de mí no hay nada que debas atender.` }
  if (/atras|retras|tarde|venc/.test(q)) return { texto: 'Una sola: **#4 Label chorizo salvadoreño 1 lb**, urgente, compromiso vencido. Ya le pedí al equipo fecha nueva.' }
  if (/resumen|hoy|como va|que hay|estado/.test(q)) return { texto: `Todo en orden.\n• **Ana Sofi:** ${M.hoy[0].corto}\n• **Centro de trabajo:** ${M.hoy[1].corto}`, acciones: [{ etiqueta: 'Detalle de tareas', pregunta: 'Explícame completo el centro de trabajo' }] }
  if (/memoria|recuerda|instruccion/.test(q)) return { texto: `Instrucciones vigentes:\n${M.instrucciones.map((i) => `• ${i.texto}`).join('\n')}` }
  return { texto: 'Entendido. En el sistema real consulto a mis IAs y al Centro de trabajo para resolverlo. En la muestra prueba: “Resumen de hoy”, “¿Qué hizo Ana Sofi?” o “Dile a Ana Sofi que hoy no prometa entregas”.' }
}

// -- la página --------------------------------------------------------------------

let vista = 'consola'
let nucleo = null
let ultimo = { q: '', r: 'Sistema en línea. Todas las IAs a la escucha.', acciones: [] }
let pensando = false

function marco() {
  $('#consola').innerHTML = `
    <header class="u-top">
      <h1 class="u-marca">ULTRON</h1>
      <span class="u-linea"></span>
      <span class="u-muestra">Muestra</span>
      <span class="u-quien">${h(YO)} · Dirección</span>
      <span class="u-estado">Sistema activo <i></i></span>
    </header>
    <div class="u-cuerpo">
      <nav class="u-nav" aria-label="Vistas">
        ${['consola', 'ecosistema', 'memoria'].map((v) => `<button data-vista="${v}" class="${v === vista ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </nav>
      <main class="u-vista" id="vista"></main>
      <aside class="u-lado" id="lado"></aside>
    </div>`
  pintarVista()
  pintarLado()
}

function pintarLado() {
  const lado = $('#lado')
  if (!lado) return
  const activas = IAS.filter((i) => i.activa).length
  lado.innerHTML = `
    <section class="u-tarjeta"><h3>${pensando ? 'Procesando' : nucleo?.escuchando ? 'Escuchando' : 'En espera'}</h3><canvas class="u-onda" id="onda"></canvas></section>
    <section class="u-tarjeta"><h3>IAs conectadas</h3><div class="u-num">${activas}<small> / ${IAS.length}</small></div></section>
    <section class="u-tarjeta"><h3>Última acción</h3><div class="u-ultima">${h(M.ultima)}</div></section>`
  const c = $('#onda')
  for (const v of [...vivos]) if (v instanceof Onda && !v.canvas.isConnected) vivos.delete(v)
  if (nucleo) {
    const o = new Onda(c, nucleo)
    o.medir()
    vivos.add(o)
  }
}

function pintarVista() {
  for (const v of [...vivos]) vivos.delete(v)
  document.querySelectorAll('.u-nav button').forEach((b) => b.classList.toggle('on', b.dataset.vista === vista))
  const el = $('#vista')
  el.classList.toggle('libre', vista !== 'consola')
  if (vista === 'consola') {
    el.innerHTML = `
      <canvas class="u-nucleo" id="nucleo" aria-label="Núcleo de Ultron"></canvas>
      <div class="u-subtitulos" id="subs"></div>
      <div class="u-etiqueta-nucleo">Núcleo central</div>
      <form class="u-barra" id="barra">
        <canvas class="u-mini-onda" id="mini-onda"></canvas>
        <div class="u-campo">
          <button type="button" class="u-mic" id="mic" aria-label="Hablar">${MIC}</button>
          <input id="orden" autocomplete="off" maxlength="1000" placeholder="¿Qué ejecutamos, ${h(YO)}?" aria-label="Orden para Ultron">
          <button class="u-enviar">Ejecutar</button>
        </div>
      </form>`
    nucleo = new Nucleo($('#nucleo'))
    vivos.add(nucleo)
    const mini = new Onda($('#mini-onda'), nucleo, { barras: 160, compacta: true })
    mini.medir()
    vivos.add(mini)
    pintarSubs()
    $('#barra').addEventListener('submit', (e) => {
      e.preventDefault()
      const v = $('#orden').value
      $('#orden').value = ''
      ejecutar(v)
    })
    $('#mic').addEventListener('click', escuchar)
    setTimeout(() => $('#orden')?.focus({ preventScroll: true }), 50)
  } else if (vista === 'ecosistema') {
    const hub = (m) => {
      const on = m.chips.some(([, a]) => a)
      return `<div class="u-hub ${on ? '' : 'off'}" data-hub><div class="u-hub-circulo">${ICONOS[m.icono]}</div><div class="u-hub-texto"><b>${h(m.nombre)}</b><div class="u-chips">${m.chips.map(([n, a]) => `<span class="u-chip ${a ? '' : 'pronto'}"><i></i>${h(n)}</span>`).join('')}</div></div></div>`
    }
    el.innerHTML = `
      <div class="u-eco">
        <div class="u-eco-titulo"><h2>Ecosistema</h2><span>Todo conectado a Ultron</span></div>
        <div class="u-eco-mapa" id="mapa">
          <svg class="u-eco-lineas" id="lineas"></svg>
          <div class="u-eco-lado izq">${MODULOS.izq.map(hub).join('')}</div>
          <div class="u-eco-centro" id="centro"><canvas id="nucleo-eco"></canvas><div class="u-nombre">Ultron</div></div>
          <div class="u-eco-lado der">${MODULOS.der.map(hub).join('')}</div>
        </div>
        <div class="u-hijos">
          ${IAS.map((ia, i) => `<div class="u-hijo ${ia.activa ? '' : 'pronto'}" style="--c:${ia.css}"><canvas data-hijo="${i}"></canvas><b>${h(ia.nombre)}</b><span>${h(ia.empresa)}</span><em>${ia.activa ? '● Activa' : 'Próximamente'}</em><p>${h(ia.corto)}</p></div>`).join('')}
        </div>
      </div>`
    const centro = new Nucleo($('#nucleo-eco'), { puntos: 1600, piso: false, escala: 0.3 })
    vivos.add(centro)
    nucleo = centro
    document.querySelectorAll('[data-hijo]').forEach((cv) => {
      const ia = IAS[Number(cv.dataset.hijo)]
      vivos.add(new Nucleo(cv, { color: ia.color, puntos: 800, piso: false, escala: 0.28, apagado: !ia.activa }))
    })
    requestAnimationFrame(dibujarLineas)
  } else {
    el.innerHTML = `
      <div class="u-mem">
        <div class="u-mem-rejilla">
          <section class="u-tarjeta"><h3>Instrucciones vigentes</h3><div class="u-lista">${M.instrucciones.map((i) => `<div class="u-item">${h(i.texto)}<small>${h(i.cuando)}</small></div>`).join('')}</div></section>
          <section class="u-tarjeta"><h3>Hoy, en corto</h3><div class="u-lista">${M.hoy.map((x, i) => `<div class="u-item"><b>${h(x.quien)}</b> · ${h(x.corto)}<div><button class="u-boton" data-mas="${i}" style="margin-top:8px">Explicación completa</button></div><p class="u-largo" hidden>${h(x.largo)}</p></div>`).join('')}</div></section>
          <section class="u-tarjeta"><h3>Dirección con acceso</h3>${CABEZAS.map((n) => `<span class="u-persona"><i>${h(n[0])}</i>${h(n)}</span>`).join('')}<p class="u-largo">Ultron solo atiende a estas personas. Las demás IAs atienden a los empleados de su empresa.</p></section>
          <section class="u-tarjeta"><h3>Lo que Ultron puede hacer</h3><div class="u-lista">
            <div class="u-item">Aquí y en Telegram: todo — hablar con sus IAs, darles instrucciones, resúmenes, el Centro de trabajo.</div>
            <div class="u-item">Dentro del Centro de trabajo: solo lo del Centro de trabajo, sin borrar ni cambiar nada.</div>
            <div class="u-item">Enviar, publicar o gastar: siempre con la aprobación de una persona.</div>
          </div></section>
        </div>
      </div>`
    el.querySelectorAll('[data-mas]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = b.parentElement.nextElementSibling
        p.hidden = !p.hidden
        b.textContent = p.hidden ? 'Explicación completa' : 'Ocultar'
      }),
    )
    nucleo = null
  }
  for (const v of vivos) v.medir()
  pintarLado()
}

/** Las líneas de luz del núcleo a cada módulo. */
function dibujarLineas() {
  const svg = $('#lineas')
  const mapa = $('#mapa')
  if (!svg || !mapa || getComputedStyle(svg).display === 'none') return
  const base = mapa.getBoundingClientRect()
  const c = $('#centro').getBoundingClientRect()
  const cx = c.left + c.width / 2 - base.left
  const cy = c.top + c.height / 2 - base.top
  const r = c.width * 0.36
  let d = ''
  document.querySelectorAll('[data-hub]').forEach((hub) => {
    // Sale del borde de sus etiquetas (no las cruza) hacia el núcleo.
    const b = hub.querySelector('.u-hub-circulo').getBoundingClientRect()
    const todo = hub.getBoundingClientRect()
    const izq = b.left < c.left
    const x = (izq ? todo.right + 8 : todo.left - 8) - base.left
    const y = b.top + b.height / 2 - base.top
    const ex = cx + (izq ? -r : r)
    const ey = cy + (y - cy) * 0.35
    const on = !hub.classList.contains('off')
    d += `<path d="M${x},${y} C${(x + ex) / 2},${y} ${(x + ex) / 2},${ey} ${ex},${ey}" stroke="rgba(255,154,46,${on ? 0.9 : 0.25})" stroke-width="${on ? 2 : 1}" fill="none" ${on ? 'stroke-dasharray="6 10" class="fluye"' : ''} filter="url(#brillo)"/>`
  })
  svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`)
  svg.innerHTML = `<defs><filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${d}<style>.fluye{animation:fluye 1.4s linear infinite}@keyframes fluye{to{stroke-dashoffset:-32}}@media (prefers-reduced-motion: reduce){.fluye{animation:none}}</style>`
}

function pintarSubs(escribiendo = false) {
  const s = $('#subs')
  if (!s) return
  s.innerHTML = `${ultimo.q ? `<div class="q">› ${h(ultimo.q)}</div>` : ''}<div class="r" id="r"></div>${ultimo.acciones?.length ? `<div class="u-acciones">${ultimo.acciones.map((a, i) => `<button class="u-boton" data-accion="${i}">${h(a.etiqueta)}</button>`).join('')}</div>` : ''}`
  s.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener('click', () => ejecutar(ultimo.acciones[Number(b.dataset.accion)].pregunta)))
  const r = $('#r')
  const html = h(ultimo.r).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  if (!escribiendo || !MOVIMIENTO) {
    r.innerHTML = html
    return
  }
  // Máquina de escribir, al ritmo de la voz.
  const plano = ultimo.r.replace(/\*\*/g, '')
  let i = 0
  const paso = () => {
    if (!r.isConnected) return
    i += 2
    r.textContent = plano.slice(0, i)
    if (i < plano.length) setTimeout(paso, 16)
    else r.innerHTML = html
  }
  paso()
}

async function ejecutar(texto) {
  texto = String(texto || '').trim()
  if (!texto || pensando) return
  if (vista !== 'consola') {
    vista = 'consola'
    pintarVista()
  }
  pensando = true
  ultimo = { q: texto, r: '…', acciones: [] }
  pintarSubs()
  pintarLado()
  if (nucleo) nucleo.escuchando = true
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 600))
  const res = responder(texto)
  if (nucleo) {
    nucleo.escuchando = false
    nucleo.hablar(Math.min(9000, 900 + res.texto.length * 38))
  }
  pensando = false
  ultimo = { q: texto, r: res.texto, acciones: res.acciones ?? [] }
  pintarSubs(true)
  pintarLado()
}

/** Dictado con el micrófono (donde el navegador lo permite). */
function escuchar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return aviso('Este navegador no deja usar el micrófono aquí. Escribe tu orden.')
  const rec = new SR()
  rec.lang = 'es-MX'
  rec.interimResults = true
  const mic = $('#mic')
  mic.classList.add('oye')
  if (nucleo) nucleo.escuchando = true
  pintarLado()
  rec.onresult = (e) => {
    const t = [...e.results].map((r) => r[0].transcript).join('')
    $('#orden').value = t
    if (e.results[e.results.length - 1].isFinal) {
      $('#orden').value = ''
      ejecutar(t)
    }
  }
  rec.onerror = () => aviso('No pude usar el micrófono. Escribe tu orden.')
  rec.onend = () => {
    mic?.classList.remove('oye')
    if (nucleo && !pensando) nucleo.escuchando = false
    pintarLado()
  }
  try {
    rec.start()
  } catch {
    rec.onend()
  }
}

function aviso(texto) {
  const a = document.createElement('div')
  a.className = 'u-aviso'
  a.textContent = texto
  document.body.append(a)
  setTimeout(() => a.remove(), 3500)
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-vista]')
  if (!b) return
  vista = b.dataset.vista
  pintarVista()
})

// En el sitio real, mientras Ultron no esté conectado, no se enseña la muestra
// (tiene nombres de la dirección); solo un aviso. La muestra sale aparte.
async function arrancar() {
  let real = false
  if (location.pathname.startsWith('/ultron')) try {
    const r = await fetch('/.netlify/functions/config')
    real = r.ok && Boolean((await r.json()).url)
  } catch {
    real = false
  }
  if (real) {
    $('#consola').innerHTML = `<header class="u-top"><h1 class="u-marca">ULTRON</h1><span class="u-linea"></span><span class="u-estado">Conectando <i></i></span></header><div class="u-vista" style="height:70vh"><canvas class="u-nucleo" id="nucleo"></canvas><div class="u-etiqueta-nucleo">Muy pronto</div></div>`
    const n = new Nucleo($('#nucleo'))
    vivos.add(n)
    requestAnimationFrame(animar)
    return
  }
  marco()
  requestAnimationFrame(animar)
}
arrancar()
