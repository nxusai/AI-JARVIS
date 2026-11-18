// Panel "Anuncios" de Mi Semago: todo el camino del lead en una pantalla, por anuncio.
// Meta (lo gastado, quién lo vio, quién abrió el chat) + el Centro de trabajo (quién
// entró, quién dio permiso, con quién habló Ana Sofi, quién agendó Meet y quién
// cerró). SOLO lo ve el creador del sistema. Solo lee: no cambia nada en Meta ni en
// los leads.
import { claveDeFuente, claveDeAnuncio, campDe, esDeMiSemago, nombreCorto, llaveDe, descripcion, deCodigo, pasoDe } from './anuncios-claves.js'

const ETAPAS = { nuevo: 'Nuevo (por llamar)', programada: 'Llamada programada', no_contesto: 'No contestó', hablo: 'Ya habló, sin Meet', meet: 'Meet agendado', cerrado: 'Cerrado (cliente)', no_califica: 'No califica', no_llamar: 'No dio permiso de llamada' }
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const num = (n) => Number(n || 0).toLocaleString('es-MX')
const mercado = (c) => (c === 'ANTES' ? 'Anteriores' : c ? c[0] + c.slice(1).toLowerCase() : '')
export const leerObjetivo = () => { try { return Number(localStorage.getItem('ms-objetivo-meet')) || 100 } catch { return 100 } }
export const guardarObjetivo = (n) => { try { localStorage.setItem('ms-objetivo-meet', String(n)) } catch {} }

/**
 * @param leads los leads del Centro de trabajo (S.leads)
 * @param datos lo que contesta la función "anuncios" (Meta + semanas + aprendizajes), o null mientras carga
 * @param estado { camp, periodo, vista }
 */
export function vistaAnuncios({ leads = [], datos, estado, h, error = '' }) {
  if (error) return `<div class="vacio-msg"><b>No se pudo abrir Anuncios</b>${h(error)}</div>`
  if (!datos) return '<div class="vacio-msg">Cargando los anuncios…</div>'
  const meta = datos
  const semanas = datos.semanas || []
  const aprendizajes = datos.aprendizajes || []
  const moneda = meta.moneda || 'USD'
  const $$ = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: moneda === 'MXN' ? 'MXN' : 'USD' })
  const objetivo = leerObjetivo()
  const desde7 = Date.now() - 7 * 864e5
  const enPeriodo = (iso) => estado.periodo === 'todo' || new Date(iso).getTime() >= desde7
  const enCamp = (k) => estado.camp === 'todo' || k?.camp === estado.camp

  // ---- Cada anuncio: lo de Meta + sus leads (se unen por la fuente que marca ManyChat)
  const pasos = (ls) => {
    const a = { leads: ls.length, calif: 0, hablo: 0, buenos: 0, agendo: 0, cliente: 0 }
    for (const l of ls) {
      const p = pasoDe(l)
      if (p.real) a.calif++
      if (p.hablo) a.hablo++
      if (p.bueno) a.buenos++
      if (p.agendo) a.agendo++
      if (p.cliente) a.cliente++
    }
    return a
  }
  const VIVOS = ['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES', 'PREAPPROVED']
  // Varios anuncios pueden caer en la misma letra (copias): manda el que sigue vivo; si ninguno, el más reciente.
  const estados = {}
  for (const e of meta.estados || []) {
    const k = claveDeAnuncio(e.anuncio, e.campana)
    if (!k) continue
    const a = estados[llaveDe(k)]
    const vivoE = VIVOS.includes(e.estado), vivoA = a && VIVOS.includes(a.estado)
    if (!a || (vivoE && !vivoA) || (vivoE === vivoA && (e.actualizado || '') > (a.actualizado || ''))) estados[llaveDe(k)] = e
  }
  // Activo = así lo dice Meta. Sin Meta (o sin anuncio todavía en Meta), cuenta como activo si le llegó un lead en los últimos 14 días.
  const reciente = (x) => x.leads.some((l) => Date.now() - new Date(l.creado).getTime() < 14 * 864e5)
  const esActivo = (x) => (meta.conectado && estados[llaveDe(x)] ? VIVOS.includes(estados[llaveDe(x)].estado) : reciente(x))
  function construir(filas, listaLeads) {
    const porAnuncio = {}
    for (const f of filas || []) {
      const k = claveDeAnuncio(f.anuncio, f.campana)
      if (!k || !enCamp(k)) continue
      const x = (porAnuncio[llaveDe(k)] ??= { ...k, meta: { gasto: 0, impresiones: 0, alcance: 0, conversaciones: 0, vistas3s: 0, thruplays: 0, clics: 0, frec: [] }, leads: [] })
      for (const c of ['gasto', 'impresiones', 'alcance', 'conversaciones', 'vistas3s', 'thruplays', 'clics']) x.meta[c] += f[c]
      x.meta.frec.push(f.frecuencia)
      x.anuncio = f.anuncio
      x.campana = f.campana
    }
    for (const l of listaLeads) {
      const k = claveDeFuente(l.fuente)
      if (!k || !enCamp(k)) continue
      ;(porAnuncio[llaveDe(k)] ??= { ...k, meta: null, leads: [] }).leads.push(l)
    }
    return Object.values(porAnuncio).map((x) => {
      const p = pasos(x.leads)
      const m = x.meta
      const est = estados[llaveDe(x)]
      if (est && !x.anuncio) { x.anuncio = est.anuncio; x.campana = est.campana }
      const dias = est?.creado ? Math.floor((Date.now() - new Date(est.creado).getTime()) / 864e5) : null
      const creados = x.leads.map((l) => l.creado).sort()
      const desde = est?.creado || creados[0] || null
      const ultimo = est?.actualizado || creados.at(-1) || est?.creado || new Date().toISOString()
      return {
        ...x, p, est, dias, desde, ultimo, activo: esActivo(x),
        gancho: m && m.impresiones && m.vistas3s ? pct(m.vistas3s, m.impresiones) : null, // solo los videos
        abren: m && m.impresiones ? pct(m.conversaciones, m.impresiones) : null,
        frecuencia: m?.frec.length ? Math.max(...m.frec) : null,
        costoCita: m && p.agendo ? m.gasto / p.agendo : null,
        costoBueno: m && p.buenos ? m.gasto / p.buenos : null,
      }
    })
  }
  const leadsPeriodo = leads.filter((l) => enPeriodo(l.creado))
  const filasMeta = meta.conectado ? meta.total || [] : []
  const anuncios = construir(meta.conectado ? (estado.periodo === 'todo' ? meta.total : meta.semana) : [], leadsPeriodo).filter((x) => x.activo)
  const todos = construir(filasMeta, leads)
  const historia = todos.filter((x) => !x.activo)
  const activas = new Set(todos.filter((x) => x.activo).map(llaveDe))
  const deAnuncio = leadsPeriodo.filter((l) => { const k = claveDeFuente(l.fuente); return k && enCamp(k) && activas.has(llaveDe(k)) })
  const organicos = leadsPeriodo.filter((l) => !claveDeFuente(l.fuente))
  // Mercados que existen (para los botones de arriba).
  const mercados = [...new Set([...construir(filasMeta, leads).map((x) => x.camp), ...semanas.map((r) => r.camp), ...(estado.camp !== 'todo' ? [estado.camp] : [])])].sort()

  // Quién va ganando: el menor costo por Meet (si ya hay Meets).
  const conCitas = anuncios.filter((x) => x.costoCita != null)
  const ganador = conCitas.length ? conCitas.reduce((a, b) => (a.costoCita <= b.costoCita ? a : b)) : null
  const consejo = (x) => {
    if (x.est && !['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES'].includes(x.est.estado)) return ['gris', '⏸ Pausado o terminado']
    if (x.dias != null && x.dias < 7) return ['azul', `⏳ Aprendiendo (día ${x.dias + 1} de 7): no tocar`]
    if (x.meta && x.meta.gasto >= 3 * objetivo && !x.p.agendo) return ['rojo', '⚠️ Gasta sin Meets: considera apagarlo']
    if (x.frecuencia && x.frecuencia >= 3) return ['ambar', '🔁 La gente ya lo vio mucho: cambia el creativo']
    if (x.gancho != null && x.gancho < 15 && x.meta?.impresiones > 1500) return ['ambar', '🎣 El inicio no detiene: prueba otro gancho']
    if (ganador && x === ganador) return ['verde', '🏆 Va ganando: súbele 20% cada 3-4 días']
    if (x.costoCita != null && x.costoCita <= objetivo) return ['verde', '✅ Dentro del objetivo']
    return ['gris', '👀 Juntando datos']
  }

  // ---- Totales
  const T = anuncios.reduce((a, x) => {
    if (x.meta) for (const c of ['gasto', 'impresiones', 'conversaciones', 'vistas3s']) a[c] += x.meta[c]
    return a
  }, { gasto: 0, impresiones: 0, conversaciones: 0, vistas3s: 0 })
  const P = pasos(deAnuncio)
  const cu = (n) => (T.gasto && n ? $$(T.gasto / n) : '—')

  // ---- Embudo grande
  const barrasEmbudo = (lista, peor = -1, tips = []) => {
    const maxLog = Math.log10(Math.max(10, ...lista.map(([, n]) => n + 1)))
    return lista.map(([t, n, de], i) => {
      const ancho = Math.max(6, (Math.log10(n + 1) / maxLog) * 100)
      const prev = i ? lista[i - 1][1] : null
      return `<div class="an-paso" style="--w:${ancho}%"><div class="an-barra"><b>${num(n)}</b><span>${h(t)}</span></div><small>${i && prev ? `${pct(n, prev)}% del paso anterior` : h(de)}</small>${i === peor ? `<p class="an-consejo rojo">👉 Aquí se pierde más. ${h(tips[i] || '')}</p>` : ''}</div>`
    }).join('')
  }
  const etapas = [
    ['Vieron el anuncio', T.impresiones, 'Meta'],
    ...(T.vistas3s ? [['Se detuvieron 3 s (videos)', T.vistas3s, 'Meta']] : []),
    ['Abrieron el chat de WhatsApp', T.conversaciones, 'Meta'],
    ['Entraron al Centro de trabajo', P.leads, 'ManyChat'],
    ['Dieron permiso de llamada', P.calif, 'ManyChat'],
    ['Ana Sofi habló con ellos', P.hablo, 'Ana Sofi'],
    ['Leads buenos (caliente o medio)', P.buenos, 'Ana Sofi'],
    ['Agendaron Meet', P.agendo, 'Ana Sofi'],
    ['Clientes', P.cliente, 'Tú'],
  ].filter(([, , de]) => meta.conectado || de !== 'Meta')

  // ---- Gráfica de 30 días: gasto (barras) y leads con permiso (línea)
  const dias30 = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10))
  const gastoDia = Object.fromEntries(dias30.map((d) => [d, 0]))
  for (const f of meta.dias || []) {
    if (gastoDia[f.dia] != null && esDeMiSemago(f.campana) && (estado.camp === 'todo' || campDe(f.campana) === estado.camp)) gastoDia[f.dia] += f.gasto
  }
  const leadsDia = Object.fromEntries(dias30.map((d) => [d, 0]))
  for (const l of leads) {
    const k = claveDeFuente(l.fuente)
    const d = new Date(l.creado).toISOString().slice(0, 10)
    if (k && enCamp(k) && leadsDia[d] != null && l.permiso_llamada) leadsDia[d]++
  }
  const mg = Math.max(1, ...Object.values(gastoDia)), ml = Math.max(1, ...Object.values(leadsDia))
  const W = 900, H = 200, bw = W / 30
  const barras = dias30.map((d, i) => `<rect x="${i * bw + 3}" y="${H - (gastoDia[d] / mg) * (H - 20)}" width="${bw - 6}" height="${(gastoDia[d] / mg) * (H - 20)}" rx="4" class="an-g-barra"><title>${d}: ${$$(gastoDia[d])}</title></rect>`).join('')
  const linea = dias30.map((d, i) => `${i * bw + bw / 2},${H - (leadsDia[d] / ml) * (H - 30) - 6}`).join(' ')
  const puntos = dias30.map((d, i) => (leadsDia[d] ? `<circle cx="${i * bw + bw / 2}" cy="${H - (leadsDia[d] / ml) * (H - 30) - 6}" r="4.5" class="an-g-punto"><title>${d}: ${leadsDia[d]} leads con permiso</title></circle>` : '')).join('')

  // ---- Tarjetas por anuncio
  const orden = (a, b) => b.ronda - a.ronda || (a.camp + a.video).localeCompare(b.camp + b.video)
  const fCorta = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const queEs = (x) => (x.ronda === 0 ? 'campaña anterior a las rondas' : descripcion(x.anuncio, x) || '')
  const fechas = (x, pasado) => (x.desde ? `${fCorta(x.desde)} → ${pasado ? fCorta(x.ultimo) : 'hoy'}` : '')
  const titulo = (x) => (x.ronda === 0 ? `Anterior · ${h(x.anuncio || x.video)}` : `Ronda ${x.ronda} · ${h(mercado(x.camp))} · ${h(nombreCorto(x.video))}`)
  const tarjeta = (x, pasado = false) => {
    const [tono, txt] = pasado ? ['gris', `⏹ Apagado${x.est?.actualizado ? ' el ' + new Date(x.est.actualizado).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : ''}${x.costoCita != null ? ` · ${$$(x.costoCita)} por Meet` : ''}`] : consejo(x)
    const m = x.meta
    const mini = [['Chats', m?.conversaciones], ['Permiso', x.p.calif], ['Buenos', x.p.buenos], ['Meets', x.p.agendo], ['Clientes', x.p.cliente]]
    const mmax = Math.max(1, ...mini.map(([, n]) => n || 0))
    return `<article class="an-video ${!pasado && ganador === x ? 'gana' : ''} ${pasado ? 'pasado' : ''}">
      <header><span class="an-letra">${h(x.video.length === 1 ? x.video : x.video.slice(0, 2))}</span><div><b>${titulo(x)}</b><small>${h(queEs(x))}${fechas(x, pasado) ? ` · ${fechas(x, pasado)}` : ''}</small>${x.campana ? `<small title="Campaña en Meta">${h(x.campana)}</small>` : ''}</div>${x.est ? `<span class="chip ${x.est.estado === 'ACTIVE' ? 'an-vivo-chip' : ''}">${x.est.estado === 'ACTIVE' ? '● Activo' : h(x.est.estado.toLowerCase().replace(/_/g, ' '))}</span>` : ''}</header>
      <div class="an-cifras">
        <div><span>Gastado</span><b>${m ? $$(m.gasto) : '—'}</b></div>
        <div><span>Costo por Meet</span><b class="${x.costoCita != null && x.costoCita <= objetivo ? 'ok' : ''}">${x.costoCita != null ? $$(x.costoCita) : '—'}</b></div>
        <div><span>Por lead bueno</span><b>${x.costoBueno != null ? $$(x.costoBueno) : '—'}</b></div>
        <div><span>${x.gancho != null ? 'Gancho (3 s)' : 'Abren el chat'}</span><b>${x.gancho != null ? x.gancho + '%' : x.abren != null ? x.abren + '%' : '—'}</b></div>
      </div>
      <div class="an-mini">${mini.map(([t, n]) => `<div><i style="--h:${((n || 0) / mmax) * 100}%"></i><b>${n == null ? '—' : num(n)}</b><span>${t}</span></div>`).join('')}</div>
      <p class="an-consejo ${tono}">${txt}</p>
    </article>`
  }

  // ---- En qué van los leads de los anuncios
  const porEtapa = Object.entries(deAnuncio.reduce((a, l) => ((a[l.etapa] = (a[l.etapa] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])
  const mEt = Math.max(1, ...porEtapa.map(([, n]) => n))
  const barraLista = (lista, max, nombres = {}) => lista.map(([k, n]) => `<div class="an-motivo"><span>${h(nombres[k] || k || 'Sin dato')}</span><div><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`).join('')

  // ---- Historial por mes (lo que se apagó) y lo mejor de todos los anuncios
  const MES = (ym) => { const t = new Date(ym + '-15T12:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1) }
  const meses = {}
  for (const x of historia) (meses[new Date(x.ultimo).toISOString().slice(0, 7)] ??= []).push(x)
  const historialHtml = Object.keys(meses).sort().reverse().map((ym) => {
    const xs = meses[ym].sort(orden)
    const g = xs.reduce((a, x) => a + (x.meta?.gasto || 0), 0)
    const c = xs.reduce((a, x) => a + x.p.agendo, 0)
    const cl = xs.reduce((a, x) => a + x.p.cliente, 0)
    return `<section class="an-mes"><header><h3>${h(MES(ym))}</h3><span>${xs.length} anuncio${xs.length === 1 ? '' : 's'}${meta.conectado ? ` · ${$$(g)} gastado` : ''} · ${c} Meets · ${cl} clientes${c && g ? ` · ${$$(g / c)} por Meet` : ''}</span></header>
      <div class="an-videos">${xs.map((x) => tarjeta(x, true)).join('')}</div></section>`
  }).join('')
  const mejor = (lista, f, menor = false) => lista.filter((x) => f(x) != null).sort((a, b) => (menor ? f(a) - f(b) : f(b) - f(a)))[0]
  const nombreV = (x) => `${titulo(x)}${queEs(x) ? ` <small>(${h(queEs(x))}${x.desde ? ', ' + fechas(x, !x.activo) : ''})</small>` : ''}`
  const lecciones = [
    ['💸 Meet más barato', mejor(todos, (x) => x.costoCita, true), (x) => `${$$(x.costoCita)} por Meet`],
    ['🔥 Más leads buenos', mejor(todos, (x) => (x.p.buenos ? x.p.buenos : null)), (x) => `${x.p.buenos} caliente${x.p.buenos === 1 ? '' : 's'} o medio${x.p.buenos === 1 ? '' : 's'}`],
    ['🤝 Más clientes', mejor(todos, (x) => (x.p.cliente ? x.p.cliente : null)), (x) => `${x.p.cliente} cliente${x.p.cliente === 1 ? '' : 's'}`],
    ['💬 Más abren el chat', mejor(todos, (x) => (x.meta?.impresiones > 500 ? x.abren : null)), (x) => `${x.abren}% de quienes lo ven`],
    ['🎣 Mejor gancho (videos)', mejor(todos, (x) => (x.meta?.impresiones > 500 ? x.gancho : null)), (x) => `${x.gancho}% se detiene a verlo`],
  ].filter(([, x]) => x)
  const leccionesHtml = `<section class="an-caja an-lecciones"><h3>Lo mejor hasta hoy <small>de todos los anuncios, activos y apagados</small></h3>
    ${lecciones.length ? `<div class="an-lec">${lecciones.map(([t, x, f]) => `<div><span>${t}</span><b>${nombreV(x)}</b><small>${f(x)}</small></div>`).join('')}</div>` : '<p class="an-vacio">Con más datos aquí aparece qué funciona mejor.</p>'}</section>`

  // ---- Semana por semana (foto que se guarda cada lunes; no depende de Meta)
  const porSemana = {}
  for (const r of semanas) if (estado.camp === 'todo' || r.camp === estado.camp) (porSemana[r.semana] ??= []).push(r)
  const fSem = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const filaSemana = (k) => {
    const xs = porSemana[k]
    const t = (c) => xs.reduce((a, r) => a + Number(r[c] || 0), 0)
    const g = t('gasto'), ci = t('agendo')
    const top = xs.filter((r) => r.agendo).sort((a, b) => a.gasto / a.agendo - b.gasto / b.agendo)[0] || [...xs].sort((a, b) => b.buenos - a.buenos || b.reales - a.reales || b.conversaciones - a.conversaciones)[0]
    const c = top && deCodigo(top.anuncio)
    return `<tr><td>${fSem(k)} – ${fSem(xs[0].hasta)}</td><td>${$$(g)}</td><td>${t('impresiones') ? num(t('impresiones')) : '—'}</td><td>${num(t('conversaciones'))}</td><td>${num(t('leads'))}</td><td>${num(t('reales'))}</td><td>${num(t('buenos'))}</td><td>${num(ci)}</td><td>${num(t('cliente'))}</td><td>${ci && g ? $$(g / ci) : '—'}</td><td>${top ? (top.estado === 'MANUAL' ? `${h(xs.map((r) => r.nombre).join(' + '))} <small>(registro manual)</small>` : `${c.ronda === 0 ? 'Anterior' : 'Ronda ' + c.ronda + ' · ' + h(mercado(top.camp))} · ${h(nombreCorto(c.video))}${top.nombre ? ` <small>(${h(descripcion(top.nombre, { ...c, camp: top.camp }))})</small>` : ''}`) : '—'}</td></tr>`
  }
  const semanasHtml = Object.keys(porSemana).length ? `<section class="an-caja"><h3>Semana por semana <small>foto que se guarda cada lunes</small></h3>
    <div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Semana</th><th>Gastado</th><th>Vistas</th><th>Chats</th><th>Leads</th><th>Permiso</th><th>Buenos</th><th>Meets</th><th>Clientes</th><th>Por Meet</th><th>Mejor anuncio</th></tr></thead><tbody>
    ${Object.keys(porSemana).sort().reverse().map(filaSemana).join('')}</tbody></table></div></section>` : ''
  const historialBloque = `${leccionesHtml}${semanasHtml}${historialHtml || '<div class="an-caja"><p class="an-vacio">Todavía no hay anuncios apagados. Cuando apagues uno en Meta, aquí queda guardado en su mes, con su nombre y sus números.</p></div>'}`

  // ---- 📚 Aprendizajes: dónde se pierden las ventas (desde el inicio) + ficha + lo aprendido por escrito
  const vida = todos.reduce((a, x) => {
    a.chats += x.meta?.conversaciones || 0
    for (const c of ['leads', 'calif', 'hablo', 'buenos', 'agendo', 'cliente']) a[c] += x.p[c]
    return a
  }, { chats: 0, leads: 0, calif: 0, hablo: 0, buenos: 0, agendo: 0, cliente: 0 })
  const fugas = [
    ['Abrieron el chat de WhatsApp', vida.chats, 'Meta', ''],
    ['Entraron al Centro de trabajo', vida.leads, 'ManyChat', 'El chat se abre pero no llega al Centro de trabajo: robots, o personas que no mandan el mensaje prellenado tal cual (ManyChat solo arranca con la frase exacta). Revisar las variantes de la frase y el primer mensaje.'],
    ['Dieron permiso de llamada', vida.calif, 'ManyChat', 'El chat es largo o la pregunta de la llamada no convence. Menos preguntas y explicar para qué es la llamada (precios).'],
    ['Ana Sofi habló con ellos', vida.hablo, 'Ana Sofi', 'No contestan: revisar la hora de la llamada, que el lead reconozca el número y que el aviso de "te llama Ana Sofi" sea claro.'],
    ['Leads buenos (caliente o medio)', vida.buenos, 'Ana Sofi', 'Llega gente que no es el cliente ideal (compra poco, no es distribuidor): el anuncio o el público atraen al que no es. Revisar el texto (pedido mínimo) y las zonas.'],
    ['Agendaron Meet', vida.agendo, 'Ana Sofi', 'El lead es bueno pero no agenda: revisar cómo ofrece Ana Sofi la videollamada y los horarios.'],
    ['Clientes', vida.cliente, 'Tú', 'Propuesta, precio o seguimiento: anotar en la ficha del lead por qué no cerró.'],
  ].filter(([, , de]) => meta.conectado || de !== 'Meta')
  let peor = -1, peorPct = 101
  fugas.forEach(([, n], i) => { if (i && fugas[i - 1][1] >= 5) { const p = pct(n, fugas[i - 1][1]); if (p < peorPct) { peorPct = p; peor = i } } })
  const fugasHtml = `<section class="an-caja"><h3>Dónde se pierden las ventas <small>desde el inicio, de los anuncios</small></h3>
    <div class="an-embudo">${vida.leads || vida.chats ? barrasEmbudo(fugas, peor, fugas.map((f) => f[3])) : '<p class="an-vacio">Todavía no hay leads de anuncios.</p>'}</div></section>`
  const GRUPOS = [['regla', '✅ Reglas confirmadas'], ['ronda', '🏁 Rondas y cierres'], ['semana', '📅 Semana por semana'], ['hipotesis', '🧪 Hipótesis por probar'], ['competencia', '🔎 Competencia y Meta']]
  const ESTADOS = { confirmado: ['an-ok', 'Confirmado'], pendiente: ['an-info', 'Por probar'], descartado: ['', 'Descartado'], recomendacion: ['an-aviso-chip', 'Recomendación'] }
  const fApr = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  const aprHtml = GRUPOS.map(([g, t]) => {
    const xs = aprendizajes.filter((a) => a.tipo === g)
    if (!xs.length) return ''
    return `<section class="an-caja an-apr"><h3>${t} <small>${xs.length}</small></h3>${xs.map((a) => `<details ${g === 'regla' ? '' : 'open'}><summary><span class="chip ${ESTADOS[a.estado]?.[0] || ''}">${ESTADOS[a.estado]?.[1] || h(a.estado)}</span> <b>${h(a.titulo)}</b> <small>${fApr(a.fecha)}${a.fuente ? ' · ' + h(a.fuente) : ''}</small></summary><p>${h(a.texto)}</p></details>`).join('')}</section>`
  }).join('')
  const viejos = semanas.filter((r) => r.estado === 'MANUAL' && (estado.camp === 'todo' || r.camp === estado.camp))
  const filasFicha = [...todos].sort(orden).map((x) => `<tr>
      <td style="white-space:nowrap"><b>${x.ronda === 0 ? 'Anteriores' : 'Ronda ' + x.ronda}</b></td><td>${x.ronda === 0 ? '—' : h(mercado(x.camp))}</td><td><b>${h(x.ronda === 0 ? x.anuncio || x.video : nombreCorto(x.video))}</b><br><small>${h(queEs(x))}</small></td>
      <td><small>${h(x.campana || '—')}</small></td><td style="white-space:nowrap">${x.desde ? fechas(x, !x.activo) : '—'}</td><td>${x.activo ? '<span class="chip an-vivo-chip">● Activo</span>' : '<span class="chip">Apagado</span>'}</td>
      <td>${x.meta ? $$(x.meta.gasto) : '—'}</td><td>${x.meta ? num(x.meta.conversaciones) : '—'}</td><td>${num(x.p.leads)}</td><td>${num(x.p.calif)}</td><td>${num(x.p.buenos)}</td><td>${num(x.p.agendo)}</td><td>${num(x.p.cliente)}</td><td>${x.costoCita != null ? $$(x.costoCita) : '—'}</td></tr>`)
  const filasViejos = viejos.map((r) => `<tr><td><b>Viejos</b></td><td>${h(mercado(r.camp))}</td><td><b>${h(r.nombre)}</b><br><small>registro manual</small></td><td><small>${h(r.campana || '—')}</small></td>
      <td>${fSem(r.semana)} → ${fSem(r.hasta)}</td><td><span class="chip">Apagado</span></td><td>${$$(r.gasto)}</td><td>${num(r.conversaciones)}</td><td>${num(r.leads)}</td><td>${num(r.reales)}</td><td>${num(r.buenos)}</td><td>${num(r.agendo)}</td><td>${num(r.cliente)}</td><td>${r.agendo ? $$(r.gasto / r.agendo) : '—'}</td></tr>`)
  const fichaHtml = `<section class="an-caja"><h3>📋 Ficha de cada anuncio <small>cada ronda vuelve a usar A, B, C: aquí se distinguen por ronda, campaña y fechas</small></h3>
    <div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Ronda</th><th>Mercado</th><th>Anuncio</th><th>Campaña en Meta</th><th>Fechas</th><th>Estado</th><th>Gastado</th><th>Chats</th><th>Leads</th><th>Permiso</th><th>Buenos</th><th>Meets</th><th>Clientes</th><th>Por Meet</th></tr></thead>
    <tbody>${[...filasFicha, ...filasViejos].join('') || '<tr><td colspan="14" class="an-vacio">Sin anuncios todavía.</td></tr>'}</tbody></table></div></section>`
  const aprendizajesBloque = `${fugasHtml}${fichaHtml}${aprHtml || '<div class="an-caja"><p class="an-vacio">Todavía no hay aprendizajes guardados. Cada lunes el reporte automático escribe aquí lo de la semana.</p></div>'}
    <p class="an-nota">Esto lo leen el asesor de anuncios y el reporte de cada lunes antes de proponer anuncios nuevos. También está por escrito en el repo: docs/aprendizajes-anuncios-mi-semago.md.</p>`

  const avisos = `${datos.faltanTablas ? '<div class="an-caja an-aviso"><b>🗄️ Falta un paso en Supabase</b><p>Para guardar la foto de cada semana y lo aprendido, corre el bloque "Anuncios de Mi Semago" de <code>crm/supabase/esquema.sql</code> en Supabase → SQL Editor → New query → Run.</p></div>' : ''}${!meta.conectado
    ? `<div class="an-caja an-aviso"><b>📡 Falta conectar Meta</b><p>El camino del lead en el Centro de trabajo ya se ve. Para ver lo gastado, cuántos vieron cada anuncio y el costo por Meet, falta la llave de Meta de solo lectura. ${h(meta.motivo || '')}</p>
       <ol><li>En <b>Meta Business Settings → Users → System users</b>, un usuario de sistema "Mi Semago lectura" con la cuenta de anuncios en <b>View performance</b>, y un token con el permiso <b>ads_read</b>.</li>
       <li>En Netlify (proyecto <b>centro-misemago-abuelito</b>) → <b>Project configuration → Environment variables</b>: <code>META_TOKEN</code> = ese token y <code>META_AD_ACCOUNT_ID</code> = el número de la cuenta de anuncios.</li>
       <li><b>Deploys → Trigger deploy</b>. Al volver aquí, ya salen los números de Meta.</li></ol></div>`
    : ''}`

  const principalBloque = `
      <div class="an-kpis">
        <div class="an-kpi"><span>Gastado</span><b>${meta.conectado ? $$(T.gasto) : '—'}</b><small>${meta.conectado ? `${num(T.impresiones)} vistas` : 'conecta Meta'}</small></div>
        <div class="an-kpi"><span>Chats abiertos</span><b>${meta.conectado ? num(T.conversaciones) : '—'}</b><small>${cu(T.conversaciones)} c/u</small></div>
        <div class="an-kpi"><span>Con permiso de llamada</span><b>${num(P.calif)}</b><small>${cu(P.calif)} c/u · ${P.leads - P.calif} sin permiso</small></div>
        <div class="an-kpi"><span>Ana Sofi habló con</span><b>${num(P.hablo)}</b><small>${pct(P.hablo, P.calif)}% de los que dieron permiso</small></div>
        <div class="an-kpi"><span>Leads buenos</span><b>${num(P.buenos)}</b><small>${cu(P.buenos)} c/u · caliente o medio</small></div>
        <div class="an-kpi brilla"><span>Meets agendados</span><b>${num(P.agendo)}</b><small>${cu(P.agendo)} por Meet</small></div>
        <div class="an-kpi oro"><span>Clientes</span><b>${num(P.cliente)}</b><small>${cu(P.cliente)} por cliente</small></div>
      </div>
      <div class="an-dos">
        <section class="an-caja"><h3>El camino del lead <small>de la vista al cliente</small></h3><div class="an-embudo">${barrasEmbudo(etapas)}</div></section>
        <section class="an-caja"><h3>Últimos 30 días <small><span class="an-ley g"></span>gastado · <span class="an-ley l"></span>leads con permiso</small></h3>
          <svg class="an-graf" viewBox="0 0 ${W} ${H + 4}" preserveAspectRatio="none">${barras}<polyline points="${linea}" fill="none" class="an-g-linea"/>${puntos}</svg>
          <div class="an-ejes"><span>${dias30[0].slice(5)}</span><span>hoy</span></div>
          <div class="an-objetivo">🎯 Lo máximo que quiero pagar por un Meet: <input type="number" min="1" id="an-obj" value="${objetivo}"> ${moneda}<small>Con esto se calculan los consejos de cada anuncio.</small></div>
        </section>
      </div>
      <h2 class="an-tit">Cada anuncio, cara a cara</h2>
      <div class="an-videos">${anuncios.length ? anuncios.sort(orden).map((x) => tarjeta(x)).join('') : '<p class="an-vacio">No hay anuncios activos en este periodo. Los apagados están en 🗂 Historial.</p>'}</div>
      <div class="an-dos">
        <section class="an-caja"><h3>En qué van <small>los leads de los anuncios activos</small></h3>
          ${porEtapa.length ? barraLista(porEtapa, mEt, ETAPAS) : '<p class="an-vacio">Sin leads de anuncios en este periodo.</p>'}
          <p class="an-nota">Leads que no vienen de un anuncio (INFO, misemago.com, directos): <b>${organicos.length}</b></p>
        </section>
        <section class="an-caja"><h3>Los más recientes</h3>
          <div class="an-lista">${deAnuncio.slice(0, 8).map((l) => `<button data-lead="${l.id}"><b>${h(l.negocio || l.nombre || 'Sin nombre')}</b><small>${h(String(l.fuente || '').replace(/^Anuncio\s*·?\s*/i, ''))} · ${h(new Date(l.creado).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} · ${h(ETAPAS[l.etapa] || l.etapa)}</small></button>`).join('') || '<p class="an-vacio">Sin leads todavía.</p>'}</div>
        </section>
      </div>`

  const nAct = todos.filter((x) => x.activo).length
  return `
    <div class="an">
      <div class="an-barra-sup">
        ${mercados.length > 1 ? `<div class="an-tabs">${[['todo', 'Todo'], ...mercados.map((m) => [m, mercado(m)])].map(([k, t]) => `<button data-an-camp="${h(k)}" class="${estado.camp === k ? 'on' : ''}">${h(t)}</button>`).join('')}</div>` : ''}
        <div class="an-tabs">${[['activos', `● Activos (${nAct})`], ['historial', `🗂 Historial (${historia.length})`], ['aprendizajes', `📚 Aprendizajes (${aprendizajes.length})`]].map(([k, t]) => `<button data-an-vista="${k}" class="${estado.vista === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${estado.vista === 'activos' ? `<div class="an-tabs">${[['todo', 'Desde el inicio'], ['7', 'Últimos 7 días']].map(([k, t]) => `<button data-an-per="${k}" class="${estado.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
        <div class="an-vivo"><span class="an-privado">🔒 Solo tú lo ves</span><button class="btn chico" data-accion="an-recargar">↻ Actualizar</button></div>
      </div>
      ${avisos}
      ${estado.vista === 'historial' ? historialBloque : estado.vista === 'aprendizajes' ? aprendizajesBloque : principalBloque}
      <p class="an-nota an-pie">Meta ${meta.conectado ? `actualizado ${new Date(meta.al).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` : 'sin conectar'} · Solo lectura: aquí no se cambia nada en Meta. "Con permiso" = aceptó por escrito que le llamen. "Leads buenos" = Ana Sofi los calificó caliente o medio.</p>
    </div>`
}
