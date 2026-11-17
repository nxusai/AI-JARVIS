// Panel "Anuncios": todo el camino del lead en una pantalla, por video.
// Meta (lo gastado, quién lo vio, quién abrió el chat) + HQ (quién terminó el
// filtro, a quién llamó NEX, quién agendó, quién llegó al Meet y quién firmó).
// Se actualiza solo cada minuto mientras está abierto. Solo lee: no cambia nada
// en Meta ni en los leads.

const LETRAS = { A: '11:48 · celular de noche', B: 'Empleado que nunca duerme', C: 'Varias sucursales' }
const CAMP = { MX: 'México', NY: 'Nueva York' }
const ASISTIO = ['reunion', 'propuesta', 'cliente']
const MOTIVOS = { no_contesto: 'No contestó', no_interesa: 'No le interesa', colgo: 'Colgó', ahora_no: 'Ahora no', numero_malo: 'Número equivocado', sin_permiso: 'Sin permiso de llamada' }
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const num = (n) => Number(n || 0).toLocaleString('es-MX')
const leerObjetivo = () => { try { return Number(localStorage.getItem('nx-objetivo-cita')) || 40 } catch { return 40 } }
const guardarObjetivo = (n) => { try { localStorage.setItem('nx-objetivo-cita', String(n)) } catch {} }

import { claveDeFuente, claveDeAnuncio, nombreCorto, llaveDe, descripcion, deCodigo } from './anuncios-claves.js'
export { claveDeFuente, claveDeAnuncio }

export async function vistaAnuncios(v, { D, h, titulo, dinero }) {
  titulo('Anuncios · de la vista al cliente')
  const estado = v._an || (v._an = { camp: 'todo', periodo: 'todo', vista: 'activos' })
  const [leads, prospectos, meta, semanas, aprendizajes] = await Promise.all([
    D.leads().catch(() => []),
    D.prospectos().catch(() => []),
    D.metaAnuncios ? D.metaAnuncios().catch((e) => ({ conectado: false, motivo: e.message })) : Promise.resolve({ conectado: false }),
    D.anunciosSemanas ? D.anunciosSemanas().catch(() => []) : Promise.resolve([]),
    D.anunciosAprendizajes ? D.anunciosAprendizajes().catch(() => []) : Promise.resolve([]),
  ])
  const moneda = meta.moneda || 'USD'
  const $$ = (n) => dinero(n, moneda === 'MXN' ? 'MXN' : 'USD')
  const objetivo = leerObjetivo()
  const desde7 = Date.now() - 7 * 864e5
  const enPeriodo = (iso) => estado.periodo === 'todo' || new Date(iso).getTime() >= desde7
  const enCamp = (k) => estado.camp === 'todo' || k?.camp === estado.camp
  const pros = Object.fromEntries(prospectos.map((p) => [p.id, p]))

  // ---- Cada video: lo de Meta + sus leads (los de HQ se unen por "Anuncio MX · Video A")
  const pasos = (ls) => {
    const calif = ls.filter((l) => l.estado !== 'incompleto')
    const hablo = ls.filter((l) => (l.llamada_seg ?? 0) >= 20)
    const agendo = ls.filter((l) => l.estado === 'agendado' || l.prospecto_id)
    const asistio = agendo.filter((l) => ASISTIO.includes(pros[l.prospecto_id]?.etapa))
    const cliente = agendo.filter((l) => pros[l.prospecto_id]?.etapa === 'cliente')
    return { leads: ls.length, calif: calif.length, hablo: hablo.length, agendo: agendo.length, asistio: asistio.length, cliente: cliente.length }
  }
  const llave = llaveDe
  const VIVOS = ['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES', 'PREAPPROVED']
  // Varios anuncios pueden caer en el mismo video (copias, campaña vieja y nueva): manda el que sigue vivo; si ninguno, el más reciente.
  const estados = {}
  for (const e of meta.estados || []) {
    const k = llave(claveDeAnuncio(e.anuncio, e.campana) || { ronda: 0, camp: '?', video: e.anuncio })
    const a = estados[k]
    const vivoE = VIVOS.includes(e.estado), vivoA = a && VIVOS.includes(a.estado)
    if (!a || (vivoE && !vivoA) || (vivoE === vivoA && (e.actualizado || '') > (a.actualizado || ''))) estados[k] = e
  }
  // Activo = así lo dice Meta. Sin Meta (o sin anuncio todavía en Meta), se toma como activo.
  const esActivo = (k) => !meta.conectado || !estados[llave(k)] || VIVOS.includes(estados[llave(k)].estado)
  function construir(filas, listaLeads) {
    const porVideo = {}
    for (const f of filas || []) {
      const k = claveDeAnuncio(f.anuncio, f.campana)
      if (!k || !enCamp(k)) continue
      const x = (porVideo[llave(k)] ??= { ...k, meta: { gasto: 0, impresiones: 0, alcance: 0, conversaciones: 0, vistas3s: 0, thruplays: 0, clics: 0, frec: [] }, leads: [] })
      for (const c of ['gasto', 'impresiones', 'alcance', 'conversaciones', 'vistas3s', 'thruplays', 'clics']) x.meta[c] += f[c]
      x.meta.frec.push(f.frecuencia)
      x.anuncio = f.anuncio
      x.campana = f.campana
    }
    for (const l of listaLeads) {
      const k = claveDeFuente(l.fuente)
      if (!k || !enCamp(k)) continue
      ;(porVideo[llave(k)] ??= { ...k, meta: null, leads: [] }).leads.push(l)
    }
    return Object.values(porVideo).map((x) => {
      const p = pasos(x.leads)
      const m = x.meta
      const est = estados[llave(x)]
      const dias = est?.creado ? Math.floor((Date.now() - new Date(est.creado).getTime()) / 864e5) : null
      const desde = est?.creado || x.leads.map((l) => l.creado).sort()[0] || null
      const ultimo = est?.actualizado || x.leads.map((l) => l.creado).sort().at(-1) || est?.creado || new Date().toISOString()
      return {
        ...x, p, est, dias, desde, ultimo, activo: esActivo(x),
        gancho: m && m.impresiones ? pct(m.vistas3s, m.impresiones) : null,
        retencion: m && m.vistas3s ? pct(m.thruplays, m.vistas3s) : null,
        frecuencia: m?.frec.length ? Math.max(...m.frec) : null,
        costoCita: m && p.agendo ? m.gasto / p.agendo : null,
        costoLead: m && p.calif ? m.gasto / p.calif : null,
      }
    })
  }
  const leadsPeriodo = leads.filter((l) => enPeriodo(l.creado))
  const videos = construir(meta.conectado ? (estado.periodo === 'todo' ? meta.total : meta.semana) : [], leadsPeriodo).filter((x) => x.activo)
  const historia = construir(meta.conectado ? meta.total : [], leads).filter((x) => !x.activo)
  const todos = construir(meta.conectado ? meta.total : [], leads)
  const activas = new Set(videos.map(llave))
  const deAnuncio = leadsPeriodo.filter((l) => { const k = claveDeFuente(l.fuente); return k && enCamp(k) && activas.has(llave(k)) })
  const organicos = leadsPeriodo.filter((l) => !claveDeFuente(l.fuente))
  // Quién va ganando: el menor costo por cita (si ya hay citas).
  const conCitas = videos.filter((x) => x.costoCita != null)
  const ganador = conCitas.length ? conCitas.reduce((a, b) => (a.costoCita <= b.costoCita ? a : b)) : null
  const consejo = (x) => {
    if (x.est && !['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES'].includes(x.est.estado)) return ['gris', '⏸ Pausado o terminado']
    if (x.dias != null && x.dias < 7) return ['azul', `⏳ Aprendiendo (día ${x.dias + 1} de 7): no tocar`]
    if (x.meta && x.meta.gasto >= 3 * objetivo && !x.p.agendo) return ['rojo', '⚠️ Gasta sin citas: considera apagarlo']
    if (x.frecuencia && x.frecuencia >= 3) return ['ambar', '🔁 La gente ya lo vio mucho: cambia el video']
    if (x.gancho != null && x.gancho < 15 && x.meta?.impresiones > 1500) return ['ambar', '🎣 El inicio no detiene: prueba otro gancho']
    if (ganador && x === ganador) return ['verde', '🏆 Va ganando: súbele 20% cada 3-4 días']
    if (x.costoCita != null && x.costoCita <= objetivo) return ['verde', '✅ Dentro del objetivo']
    return ['gris', '👀 Juntando datos']
  }

  // ---- Totales
  const T = videos.reduce((a, x) => {
    if (x.meta) for (const c of ['gasto', 'impresiones', 'conversaciones', 'vistas3s']) a[c] += x.meta[c]
    return a
  }, { gasto: 0, impresiones: 0, conversaciones: 0, vistas3s: 0 })
  const P = pasos(deAnuncio)
  const cu = (n) => (T.gasto && n ? $$(T.gasto / n) : '—')

  // ---- Embudo grande
  const etapas = [
    ['Vieron el anuncio', T.impresiones, 'Meta'],
    ['Se detuvieron 3 s', T.vistas3s, 'Meta'],
    ['Abrieron el chat', T.conversaciones, 'Meta'],
    ['Entraron a HQ', P.leads, 'ManyChat'],
    ['Personas reales (filtro completo)', P.calif, 'ManyChat'],
    ['NEX habló con ellos', P.hablo, 'NEX'],
    ['Agendaron cita', P.agendo, 'NEX'],
    ['Llegaron al Meet', P.asistio, 'Tú'],
    ['Clientes', P.cliente, 'Tú'],
  ].filter(([, n, de]) => meta.conectado || de !== 'Meta')
  const maxLog = Math.log10(Math.max(10, ...etapas.map(([, n]) => n + 1)))
  const embudo = etapas.map(([t, n, de], i) => {
    const ancho = Math.max(6, (Math.log10(n + 1) / maxLog) * 100)
    const prev = i ? etapas[i - 1][1] : null
    return `<div class="an-paso" style="--w:${ancho}%;--d:${i * 70}ms"><div class="an-barra"><b>${num(n)}</b><span>${h(t)}</span></div><small>${i && prev ? `${pct(n, prev)}% del paso anterior` : de}</small></div>`
  }).join('')

  // ---- Gráfica de 30 días: gasto (barras) y leads (línea)
  const dias30 = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10))
  const gastoDia = Object.fromEntries(dias30.map((d) => [d, 0]))
  for (const f of meta.dias || []) {
    const k = /\|\s*NY\s*\|/i.test(f.campana) ? 'NY' : /\|\s*MX\s*\|/i.test(f.campana) ? 'MX' : ''
    if (gastoDia[f.dia] != null && (estado.camp === 'todo' || k === estado.camp)) gastoDia[f.dia] += f.gasto
  }
  const leadsDia = Object.fromEntries(dias30.map((d) => [d, 0]))
  for (const l of leads) {
    const k = claveDeFuente(l.fuente)
    const d = new Date(l.creado).toISOString().slice(0, 10)
    if (k && enCamp(k) && leadsDia[d] != null && l.estado !== 'incompleto') leadsDia[d]++
  }
  const mg = Math.max(1, ...Object.values(gastoDia)), ml = Math.max(1, ...Object.values(leadsDia))
  const W = 900, H = 200
  const bw = W / 30
  const barras = dias30.map((d, i) => `<rect x="${i * bw + 3}" y="${H - (gastoDia[d] / mg) * (H - 20)}" width="${bw - 6}" height="${(gastoDia[d] / mg) * (H - 20)}" rx="4" fill="url(#an-g)"><title>${d}: ${$$(gastoDia[d])}</title></rect>`).join('')
  const linea = dias30.map((d, i) => `${i * bw + bw / 2},${H - (leadsDia[d] / ml) * (H - 30) - 6}`).join(' ')
  const puntos = dias30.map((d, i) => (leadsDia[d] ? `<circle cx="${i * bw + bw / 2}" cy="${H - (leadsDia[d] / ml) * (H - 30) - 6}" r="4.5" fill="#2fd38a"><title>${d}: ${leadsDia[d]} leads reales</title></circle>` : '')).join('')

  // ---- Tarjetas por video
  const ordenados = videos.sort((a, b) => b.ronda - a.ronda || (a.camp + a.video).localeCompare(b.camp + b.video))
  const fCorta = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const queEs = (x) => (x.ronda === 1 && LETRAS[x.video]) || descripcion(x.anuncio) || ''
  const fechas = (x, pasado) => (x.desde ? `${fCorta(x.desde)} → ${pasado ? fCorta(x.ultimo) : 'hoy'}` : '')
  const tarjeta = (x, pasado = false) => {
    const [tono, txt] = pasado ? ['gris', `⏹ Apagado${x.est?.actualizado ? ' el ' + new Date(x.est.actualizado).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : ''}${x.costoCita != null ? ` · ${$$(x.costoCita)} por cita` : ''}`] : consejo(x)
    const m = x.meta
    const mini = [['Chats', m?.conversaciones], ['Reales', x.p.calif], ['Citas', x.p.agendo], ['Clientes', x.p.cliente]]
    const mmax = Math.max(1, ...mini.map(([, n]) => n || 0))
    return `<article class="an-video ${!pasado && ganador === x ? 'gana' : ''} ${pasado ? 'pasado' : ''}">
      <header><span class="an-letra">${x.video}</span><div><b>Ronda ${x.ronda} · ${CAMP[x.camp]} · ${nombreCorto(x.video)}</b><small>${h(queEs(x))}${fechas(x, pasado) ? ` · ${fechas(x, pasado)}` : ''}</small>${x.campana ? `<small title="Campaña en Meta">${h(x.campana)}</small>` : ''}</div>${x.est ? `<span class="chip ${x.est.estado === 'ACTIVE' ? 'verde' : ''}">${x.est.estado === 'ACTIVE' ? '● Activo' : h(x.est.estado.toLowerCase())}</span>` : ''}</header>
      <div class="an-cifras">
        <div><span>Gastado</span><b>${m ? $$(m.gasto) : '—'}</b></div>
        <div><span>Costo por cita</span><b class="${x.costoCita != null && x.costoCita <= objetivo ? 'ok' : ''}">${x.costoCita != null ? $$(x.costoCita) : '—'}</b></div>
        <div><span>Gancho (3 s)</span><b>${x.gancho != null ? x.gancho + '%' : '—'}</b></div>
        <div><span>Ven completo</span><b>${x.retencion != null ? x.retencion + '%' : '—'}</b></div>
      </div>
      <div class="an-mini">${mini.map(([t, n]) => `<div><i style="--h:${((n || 0) / mmax) * 100}%"></i><b>${n == null ? '—' : num(n)}</b><span>${t}</span></div>`).join('')}</div>
      <p class="an-consejo ${tono}">${txt}</p>
    </article>`
  }

  // ---- Por qué no agendan
  const cartera = deAnuncio.filter((l) => l.estado === 'cartera')
  const motivos = Object.entries(cartera.reduce((a, l) => ((a[l.motivo] = (a[l.motivo] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])
  const robots = deAnuncio.filter((l) => l.estado === 'incompleto').length
  const mmot = Math.max(1, ...motivos.map(([, n]) => n))

  // ---- Historial por mes (lo que se apagó) y lo aprendido de todos los videos
  const MES = (iso) => { const t = new Date(iso).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1) }
  const meses = {}
  for (const x of historia) (meses[new Date(x.ultimo).toISOString().slice(0, 7)] ??= []).push(x)
  const historialHtml = Object.keys(meses).sort().reverse().map((ym) => {
    const xs = meses[ym]
    const g = xs.reduce((a, x) => a + (x.meta?.gasto || 0), 0)
    const c = xs.reduce((a, x) => a + x.p.agendo, 0)
    const cl = xs.reduce((a, x) => a + x.p.cliente, 0)
    return `<section class="an-mes"><header><h3>${h(MES(ym + '-15T12:00'))}</h3><span>${xs.length} video${xs.length === 1 ? '' : 's'} · ${$$(g)} gastado · ${c} citas · ${cl} clientes${c ? ` · ${$$(g / c)} por cita` : ''}</span></header>
      <div class="an-videos">${xs.map((x) => tarjeta(x, true)).join('')}</div></section>`
  }).join('')
  const mejor = (lista, f, menor = false) => lista.filter((x) => f(x) != null).sort((a, b) => (menor ? f(a) - f(b) : f(b) - f(a)))[0]
  const nombreV = (x) => `Ronda ${x.ronda} · ${CAMP[x.camp]} · ${nombreCorto(x.video)}${queEs(x) ? ` <small>(${h(queEs(x))}${x.desde ? ', ' + fechas(x, !x.activo) : ''})</small>` : ''}`
  const lecciones = [
    ['🎣 Mejor gancho', mejor(todos, (x) => (x.meta?.impresiones > 500 ? x.gancho : null)), (x) => `${x.gancho}% se detiene a verlo`],
    ['💸 Cita más barata', mejor(todos, (x) => x.costoCita, true), (x) => `${$$(x.costoCita)} por cita`],
    ['🤝 Más clientes', mejor(todos, (x) => (x.p.cliente ? x.p.cliente : null)), (x) => `${x.p.cliente} cliente${x.p.cliente === 1 ? '' : 's'}`],
    ['👀 Lo ven completo', mejor(todos, (x) => (x.meta?.vistas3s > 200 ? x.retencion : null)), (x) => `${x.retencion}% lo termina`],
  ].filter(([, x]) => x)
  const leccionesHtml = `<section class="tarjeta an-lecciones"><h3>Lo aprendido <small>de todos los videos, activos y apagados</small></h3>
    ${lecciones.length ? `<div class="an-lec">${lecciones.map(([t, x, f]) => `<div><span>${t}</span><b>${nombreV(x)}</b><small>${f(x)}</small></div>`).join('')}</div>` : '<p class="vacio">Con más datos aquí aparece qué funciona mejor.</p>'}</section>`
  // ---- Semana por semana (foto que HQ guarda cada lunes; no depende de Meta)
  const porSemana = {}
  for (const r of semanas || []) if (estado.camp === 'todo' || r.camp === estado.camp) (porSemana[r.semana] ??= []).push(r)
  const fSem = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const filaSemana = (k) => {
    const xs = porSemana[k]
    const t = (c) => xs.reduce((a, r) => a + Number(r[c] || 0), 0)
    const g = t('gasto'), ci = t('agendo')
    const mejor = xs.filter((r) => r.agendo).sort((a, b) => a.gasto / a.agendo - b.gasto / b.agendo)[0] || [...xs].sort((a, b) => b.reales - a.reales || b.conversaciones - a.conversaciones)[0]
    return `<tr><td>${fSem(k)} – ${fSem(xs[0].hasta)}</td><td>${$$(g)}</td><td>${t('impresiones') ? num(t('impresiones')) : '—'}</td><td>${t('impresiones') ? pct(t('vistas3s'), t('impresiones')) + '%' : '—'}</td><td>${num(t('conversaciones'))}</td><td>${num(t('reales'))}</td><td>${num(ci)}</td><td>${num(t('cliente'))}</td><td>${ci ? $$(g / ci) : '—'}</td><td>${mejor ? (mejor.estado === 'MANUAL' ? `${h(xs.map((r) => r.nombre).join(' + '))} <small>(registro manual)</small>` : `Ronda ${deCodigo(mejor.anuncio).ronda} · ${CAMP[mejor.camp]} · ${h(nombreCorto(deCodigo(mejor.anuncio).video))}${mejor.nombre ? ` <small>(${h(descripcion(mejor.nombre))})</small>` : ''}`) : '—'}</td></tr>`
  }
  const semanasHtml = Object.keys(porSemana).length ? `<section class="tarjeta an-semanas"><h3>Semana por semana <small>foto que HQ guarda cada lunes</small></h3>
    <div style="overflow-x:auto"><table><thead><tr><th>Semana</th><th>Gastado</th><th>Vistas</th><th>Gancho</th><th>Chats</th><th>Reales</th><th>Citas</th><th>Clientes</th><th>Por cita</th><th>Mejor anuncio</th></tr></thead><tbody>
    ${Object.keys(porSemana).sort().reverse().map(filaSemana).join('')}</tbody></table></div></section>` : ''

  const historialBloque = `${leccionesHtml}${semanasHtml}${historialHtml || '<div class="tarjeta"><p class="vacio">Todavía no se ha apagado ningún video. Cuando apagues uno en Meta, aquí queda guardado en su mes, con su nombre y sus números.</p></div>'}`

  // ---- 📚 Aprendizajes: dónde se pierden las ventas (desde el inicio) + lo aprendido por escrito
  const vida = todos.reduce((a, x) => {
    a.chats += x.meta?.conversaciones || 0
    for (const c of ['leads', 'calif', 'hablo', 'agendo', 'asistio', 'cliente']) a[c] += x.p[c]
    return a
  }, { chats: 0, leads: 0, calif: 0, hablo: 0, agendo: 0, asistio: 0, cliente: 0 })
  const fugas = [
    ['Abrieron el chat', vida.chats, 'Meta', 'El anuncio funciona: la gente escribe.'],
    ['Entraron a HQ (tocaron el primer botón)', vida.leads, 'ManyChat', 'Si aquí se pierde mucho: robots o un primer mensaje que no invita a seguir. Revisar el saludo y la etiqueta robot-autorespuesta.'],
    ['Personas reales (terminaron el filtro)', vida.calif, 'ManyChat', 'Si aquí se pierde: el filtro es largo o confuso. Menos preguntas, botones claros.'],
    ['NEX habló con ellos', vida.hablo, 'NEX', 'Si aquí se pierde: no contestan. Revisar hora de la llamada, número y que el aviso de "una IA le llamará" sea claro.'],
    ['Agendaron cita', vida.agendo, 'NEX', 'Si aquí se pierde: la llamada no convence. Revisar el guion de NEX y los motivos de la Cartera.'],
    ['Llegaron al Meet', vida.asistio, 'Tú', 'Si aquí se pierde: recordatorios, cita muy lejana o poco interés. Confirmar el día anterior.'],
    ['Clientes', vida.cliente, 'Tú', 'Si aquí se pierde: propuesta, precio o seguimiento. Anotar en Prospectos por qué no firmó.'],
  ]
  let peor = -1, peorPct = 101
  fugas.forEach(([, n], i) => { if (i && fugas[i - 1][1] > 0) { const p = pct(n, fugas[i - 1][1]); if (p < peorPct) { peorPct = p; peor = i } } })
  const fugasHtml = `<section class="tarjeta"><h3>Dónde se pierden las ventas <small>desde el inicio, de los anuncios</small></h3>
    <div class="an-embudo">${fugas.map(([t, n, de, tip], i) => {
      const prev = i ? fugas[i - 1][1] : null
      return `<div class="an-paso" style="--w:${Math.max(6, (Math.log10(n + 1) / Math.log10(Math.max(10, fugas[0][1] + 1))) * 100)}%"><div class="an-barra"><b>${num(n)}</b><span>${h(t)}</span></div><small>${i && prev ? `${pct(n, prev)}% del paso anterior` : de}</small>${i === peor ? `<p class="an-consejo rojo">👉 Aquí se pierde más. ${h(tip)}</p>` : ''}</div>`
    }).join('')}</div>
    ${motivos.length ? `<h4>Por qué no agendaron (Cartera)</h4>${motivos.map(([k, n]) => `<div class="an-motivo"><span>${h(MOTIVOS[k] || k || 'Sin motivo')}</span><div><i style="width:${(n / mmot) * 100}%"></i></div><b>${n}</b></div>`).join('')}` : ''}</section>`
  const GRUPOS = [['regla', '✅ Reglas confirmadas'], ['ronda', '🏁 Rondas y cierres'], ['semana', '📅 Semana por semana'], ['hipotesis', '🧪 Hipótesis por probar'], ['competencia', '🔎 Competencia y Meta']]
  const ESTADOS = { confirmado: ['verde', 'Confirmado'], pendiente: ['azul', 'Por probar'], descartado: ['gris', 'Descartado'], recomendacion: ['ambar', 'Recomendación'] }
  const fApr = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  const aprHtml = GRUPOS.map(([g, t]) => {
    const xs = (aprendizajes || []).filter((a) => a.tipo === g)
    if (!xs.length) return ''
    return `<section class="tarjeta an-apr"><h3>${t} <small>${xs.length}</small></h3>${xs.map((a) => `<details ${g === 'regla' ? '' : 'open'}><summary><span class="chip ${ESTADOS[a.estado]?.[0] || ''}">${ESTADOS[a.estado]?.[1] || h(a.estado)}</span> <b>${h(a.titulo)}</b> <small>${fApr(a.fecha)}${a.fuente ? ' · ' + h(a.fuente) : ''}</small></summary><p style="white-space:pre-line">${h(a.texto)}</p></details>`).join('')}</section>`
  }).join('')
  // ---- 📋 Ficha de cada video: ronda, mercado, letra, de qué trata, campaña, fechas y resultados (también los viejos de octubre)
  const viejos = (semanas || []).filter((r) => r.estado === 'MANUAL' && (estado.camp === 'todo' || r.camp === estado.camp))
  const filasFicha = [...todos].sort((a, b) => b.ronda - a.ronda || (a.camp + a.video).localeCompare(b.camp + b.video)).map((x) => `<tr>
      <td style="white-space:nowrap"><b>Ronda ${x.ronda}</b></td><td>${CAMP[x.camp]}</td><td><b>${h(nombreCorto(x.video))}</b><br><small>${h(queEs(x))}</small></td>
      <td><small>${h(x.campana || '—')}</small></td><td style="white-space:nowrap">${x.desde ? fechas(x, !x.activo) : '—'}</td><td>${x.activo ? '<span class="chip verde">● Activo</span>' : '<span class="chip">Apagado</span>'}</td>
      <td>${x.meta ? $$(x.meta.gasto) : '—'}</td><td>${x.gancho != null ? x.gancho + '%' : '—'}</td><td>${x.meta ? num(x.meta.conversaciones) : '—'}</td><td>${num(x.p.calif)}</td><td>${num(x.p.agendo)}</td><td>${num(x.p.cliente)}</td><td>${x.costoCita != null ? $$(x.costoCita) : '—'}</td></tr>`)
  const filasViejos = viejos.map((r) => `<tr><td><b>Viejos</b></td><td>${CAMP[r.camp]}</td><td><b>${h(r.nombre)}</b><br><small>registro manual</small></td><td><small>${h(r.campana || '—')}</small></td>
      <td>${fCorta(r.semana + 'T12:00')} → ${fCorta(r.hasta + 'T12:00')}</td><td><span class="chip">Apagado</span></td><td>${$$(r.gasto)}</td><td>—</td><td>${num(r.conversaciones)}</td><td>${num(r.reales)}</td><td>${num(r.agendo)}</td><td>${num(r.cliente)}</td><td>${r.agendo ? $$(r.gasto / r.agendo) : '—'}</td></tr>`)
  const fichaHtml = `<section class="tarjeta"><h3>📋 Ficha de cada video <small>cada ronda vuelve a usar Video A, B, C: aquí se distinguen por ronda, campaña y fechas</small></h3>
    <div style="overflow-x:auto"><table><thead><tr><th>Ronda</th><th>Mercado</th><th>Video</th><th>Campaña en Meta</th><th>Fechas</th><th>Estado</th><th>Gastado</th><th>Gancho</th><th>Chats</th><th>Reales</th><th>Citas</th><th>Clientes</th><th>Por cita</th></tr></thead>
    <tbody>${[...filasFicha, ...filasViejos].join('') || '<tr><td colspan="13" class="vacio">Sin videos todavía.</td></tr>'}</tbody></table></div></section>`
  const aprendizajesBloque = `${fugasHtml}${fichaHtml}${aprHtml || '<div class="tarjeta"><p class="vacio">Todavía no hay aprendizajes guardados. Cada lunes el reporte automático escribe aquí lo de la semana.</p></div>'}
    <p class="nota">Esto lo leen el asesor de anuncios y el reporte de cada lunes antes de proponer anuncios nuevos. También está por escrito en el repo: docs/aprendizajes-anuncios.md.</p>`

  const sinMeta = !meta.conectado
    ? `<div class="tarjeta an-aviso"><b>📡 Falta conectar Meta</b><p>El embudo de HQ ya funciona. Para ver lo gastado, cuántos vieron cada video y el costo por cita, falta la llave de Meta (solo lectura). ${h(meta.motivo || '')}</p>
       <ol><li>En <b>Meta Business Settings → Users → System users</b>, crea (o usa) un usuario de sistema con acceso a la cuenta de anuncios "Eduardo's" y genera un token con el permiso <b>ads_read</b>.</li>
       <li>En Netlify (sitio <b>nxus-hq</b>) → <b>Site configuration → Environment variables</b>: <code>META_TOKEN</code> = ese token y <code>META_AD_ACCOUNT_ID</code> = <code>act_736971049130563</code>.</li>
       <li><b>Deploys → Trigger deploy</b>. Al volver aquí, ya salen los números de Meta.</li></ol></div>`
    : ''

  const principalBloque = `
      <div class="an-kpis">
        <div class="an-kpi"><span>Gastado</span><b>${meta.conectado ? $$(T.gasto) : '—'}</b><small>${meta.conectado ? `${num(T.impresiones)} vistas` : 'conecta Meta'}</small></div>
        <div class="an-kpi"><span>Chats abiertos</span><b>${meta.conectado ? num(T.conversaciones) : '—'}</b><small>${cu(T.conversaciones)} c/u</small></div>
        <div class="an-kpi"><span>Personas reales</span><b>${num(P.calif)}</b><small>${cu(P.calif)} c/u · ${robots} sin terminar</small></div>
        <div class="an-kpi"><span>NEX habló con</span><b>${num(P.hablo)}</b><small>${pct(P.hablo, P.calif)}% de los reales</small></div>
        <div class="an-kpi brilla"><span>Citas agendadas</span><b>${num(P.agendo)}</b><small>${cu(P.agendo)} por cita</small></div>
        <div class="an-kpi oro"><span>Clientes</span><b>${num(P.cliente)}</b><small>${cu(P.cliente)} por cliente</small></div>
      </div>
      <div class="an-dos">
        <section class="tarjeta"><h3>El camino del lead <small>de la vista al cliente</small></h3><div class="an-embudo">${embudo}</div></section>
        <section class="tarjeta"><h3>Últimos 30 días <small><span class="an-ley g"></span>gastado · <span class="an-ley l"></span>personas reales</small></h3>
          <svg class="an-graf" viewBox="0 0 ${W} ${H + 4}" preserveAspectRatio="none"><defs><linearGradient id="an-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e5ff" stop-opacity=".9"/><stop offset="1" stop-color="#a01cff" stop-opacity=".35"/></linearGradient></defs>${barras}<polyline points="${linea}" fill="none" stroke="#2fd38a" stroke-width="3" stroke-linejoin="round"/>${puntos}</svg>
          <div class="an-ejes"><span>${dias30[0].slice(5)}</span><span>hoy</span></div>
          <div class="an-objetivo">🎯 Lo máximo que quiero pagar por una cita: <input type="number" min="1" id="an-obj" value="${objetivo}"> ${moneda}<small>Con esto se calculan los consejos.</small></div>
        </section>
      </div>
      <h2 class="an-tit">Cada video, cara a cara</h2>
      <div class="an-videos">${ordenados.length ? ordenados.map(tarjeta).join('') : '<p class="vacio">Todavía no hay leads ni números de los anuncios.</p>'}</div>
      <div class="an-dos">
        <section class="tarjeta"><h3>Por qué no agendan <small>leads de anuncios en la Cartera</small></h3>
          ${motivos.length ? motivos.map(([k, n]) => `<div class="an-motivo"><span>${h(MOTIVOS[k] || k || 'Sin motivo')}</span><div><i style="width:${(n / mmot) * 100}%"></i></div><b>${n}</b></div>`).join('') : '<p class="vacio">Nadie en la Cartera todavía.</p>'}
          <p class="nota">No terminaron el filtro (o robots): <b>${robots}</b> · Leads orgánicos (INFO, comentarios, DM): <b>${organicos.length}</b></p>
        </section>
        <section class="tarjeta"><h3>Los más recientes</h3>
          <ul class="lista">${deAnuncio.slice(0, 8).map((l) => `<li><a href="#lead/${l.id}"><b>${h(l.empresa || l.nombre || 'Sin nombre')}</b></a><small>${h(l.fuente.replace('Anuncio ', ''))} · ${h(new Date(l.creado).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} · ${h({ incompleto: 'No terminó', nuevo: 'Por llamar', llamando: 'NEX llamando', agendado: '✅ Agendó', cartera: 'Cartera', no_llamar: 'No llamar' }[l.estado] || l.estado)}</small></li>`).join('') || '<li class="vacio">Sin leads todavía.</li>'}</ul>
        </section>
      </div>
`
  v.innerHTML = `
    <div class="an">
      <div class="an-barra-sup">
        <div class="an-tabs">${[['todo', 'Todo'], ['MX', '🇲🇽 México'], ['NY', '🗽 Nueva York']].map(([k, t]) => `<button data-camp="${k}" class="${estado.camp === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="an-tabs">${[['activos', `● Activos (${videos.length})`], ['historial', `🗂 Historial (${historia.length})`], ['aprendizajes', `📚 Aprendizajes (${(aprendizajes || []).length})`]].map(([k, t]) => `<button data-vista="${k}" class="${estado.vista === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        ${estado.vista === 'activos' ? `<div class="an-tabs">${[['todo', 'Desde el inicio'], ['7', 'Últimos 7 días']].map(([k, t]) => `<button data-per="${k}" class="${estado.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
        <div class="an-vivo"><i></i>En vivo · ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</div>
      </div>
      ${sinMeta}
      ${estado.vista === 'historial' ? historialBloque : estado.vista === 'aprendizajes' ? aprendizajesBloque : principalBloque}
      <p class="nota an-pie">Meta ${meta.conectado ? `actualizado ${new Date(meta.al).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` : 'sin conectar'} · HQ en vivo · Esta pantalla se actualiza sola cada minuto. "Personas reales" = terminaron el filtro de ManyChat. "NEX habló" = llamada de 20 s o más.</p>
    </div>`

  v.querySelectorAll('[data-camp]').forEach((b) => (b.onclick = () => { estado.camp = b.dataset.camp; vistaAnuncios(v, { D, h, titulo, dinero }) }))
  v.querySelectorAll('[data-vista]').forEach((b) => (b.onclick = () => { estado.vista = b.dataset.vista; vistaAnuncios(v, { D, h, titulo, dinero }) }))
  v.querySelectorAll('[data-per]').forEach((b) => (b.onclick = () => { estado.periodo = b.dataset.per; vistaAnuncios(v, { D, h, titulo, dinero }) }))
  const obj = v.querySelector('#an-obj')
  if (obj) obj.onchange = () => { guardarObjetivo(Math.max(1, Number(obj.value) || 40)); vistaAnuncios(v, { D, h, titulo, dinero }) }
  // Siempre al día: se vuelve a pedir cada minuto mientras la pantalla está abierta.
  clearInterval(v._anReloj)
  v._anReloj = setInterval(() => {
    if (location.hash !== '#anuncios' || !document.body.contains(v)) return clearInterval(v._anReloj)
    if (document.activeElement?.id === 'an-obj') return
    vistaAnuncios(v, { D, h, titulo, dinero }).catch(() => {})
  }, 60_000)
}
