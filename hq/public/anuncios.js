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

/** "Anuncio MX · Video C" → { camp: 'MX', video: 'C' }; lo que no viene de un anuncio es orgánico. */
export function claveDeFuente(fuente) {
  const m = /Anuncio\s+(MX|NY)\s*·\s*Video\s+([A-Z])/i.exec(fuente || '')
  return m ? { camp: m[1].toUpperCase(), video: m[2].toUpperCase() } : null
}
/** Anuncio de Meta "NY | B | Empleado" en la campaña "NXUS | NY | …" → { camp: 'NY', video: 'B' }. */
export function claveDeAnuncio(nombre, campana) {
  const camp = /\|\s*NY\s*\|/i.test(campana) || /^NY\b/i.test(nombre) ? 'NY' : /\|\s*MX\s*\|/i.test(campana) || /^MX\b/i.test(nombre) ? 'MX' : ''
  const video = /^\s*(?:MX|NY)\s*\|\s*([A-Z])\s*\|/i.exec(nombre || '')?.[1]?.toUpperCase() || ''
  return camp && video ? { camp, video } : null
}

export async function vistaAnuncios(v, { D, h, titulo, dinero }) {
  titulo('Anuncios · de la vista al cliente')
  const estado = v._an || (v._an = { camp: 'todo', periodo: 'todo' })
  const [leads, prospectos, meta] = await Promise.all([
    D.leads().catch(() => []),
    D.prospectos().catch(() => []),
    D.metaAnuncios ? D.metaAnuncios().catch((e) => ({ conectado: false, motivo: e.message })) : Promise.resolve({ conectado: false }),
  ])
  const moneda = meta.moneda || 'USD'
  const $$ = (n) => dinero(n, moneda === 'MXN' ? 'MXN' : 'USD')
  const objetivo = leerObjetivo()
  const desde7 = Date.now() - 7 * 864e5
  const enPeriodo = (iso) => estado.periodo === 'todo' || new Date(iso).getTime() >= desde7
  const enCamp = (k) => estado.camp === 'todo' || k?.camp === estado.camp
  const pros = Object.fromEntries(prospectos.map((p) => [p.id, p]))

  // ---- HQ: cada lead, con su anuncio
  const deAnuncio = leads.filter((l) => claveDeFuente(l.fuente) && enCamp(claveDeFuente(l.fuente)) && enPeriodo(l.creado))
  const organicos = leads.filter((l) => !claveDeFuente(l.fuente) && enPeriodo(l.creado))
  const pasos = (ls) => {
    const calif = ls.filter((l) => l.estado !== 'incompleto')
    const hablo = ls.filter((l) => (l.llamada_seg ?? 0) >= 20)
    const agendo = ls.filter((l) => l.estado === 'agendado' || l.prospecto_id)
    const asistio = agendo.filter((l) => ASISTIO.includes(pros[l.prospecto_id]?.etapa))
    const cliente = agendo.filter((l) => pros[l.prospecto_id]?.etapa === 'cliente')
    return { leads: ls.length, calif: calif.length, hablo: hablo.length, agendo: agendo.length, asistio: asistio.length, cliente: cliente.length }
  }

  // ---- Meta: por anuncio
  const filasMeta = (meta.conectado ? (estado.periodo === 'todo' ? meta.total : meta.semana) : []) || []
  const porVideo = {}
  const llave = (k) => `${k.camp}-${k.video}`
  for (const f of filasMeta) {
    const k = claveDeAnuncio(f.anuncio, f.campana)
    if (!k || !enCamp(k)) continue
    const x = (porVideo[llave(k)] ??= { ...k, meta: { gasto: 0, impresiones: 0, alcance: 0, conversaciones: 0, vistas3s: 0, thruplays: 0, clics: 0, frec: [] }, leads: [] })
    for (const c of ['gasto', 'impresiones', 'alcance', 'conversaciones', 'vistas3s', 'thruplays', 'clics']) x.meta[c] += f[c]
    x.meta.frec.push(f.frecuencia)
    x.anuncio = f.anuncio
  }
  for (const l of deAnuncio) {
    const k = claveDeFuente(l.fuente)
    ;(porVideo[llave(k)] ??= { ...k, meta: null, leads: [] }).leads.push(l)
  }
  const estados = Object.fromEntries((meta.estados || []).map((e) => [llave(claveDeAnuncio(e.anuncio, e.campana) || { camp: '?', video: e.anuncio }), e]))
  const videos = Object.values(porVideo).map((x) => {
    const p = pasos(x.leads)
    const m = x.meta
    const est = estados[llave(x)]
    const dias = est?.creado ? Math.floor((Date.now() - new Date(est.creado).getTime()) / 864e5) : null
    return {
      ...x, p, est, dias,
      gancho: m && m.impresiones ? pct(m.vistas3s, m.impresiones) : null,
      retencion: m && m.vistas3s ? pct(m.thruplays, m.vistas3s) : null,
      frecuencia: m?.frec.length ? Math.max(...m.frec) : null,
      costoCita: m && p.agendo ? m.gasto / p.agendo : null,
      costoLead: m && p.calif ? m.gasto / p.calif : null,
    }
  })
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
  const ordenados = videos.sort((a, b) => (a.camp + a.video).localeCompare(b.camp + b.video))
  const tarjeta = (x) => {
    const [tono, txt] = consejo(x)
    const m = x.meta
    const mini = [['Chats', m?.conversaciones], ['Reales', x.p.calif], ['Citas', x.p.agendo], ['Clientes', x.p.cliente]]
    const mmax = Math.max(1, ...mini.map(([, n]) => n || 0))
    return `<article class="an-video ${ganador === x ? 'gana' : ''}">
      <header><span class="an-letra">${x.video}</span><div><b>${CAMP[x.camp]} · Video ${x.video}</b><small>${h(LETRAS[x.video] || x.anuncio || '')}</small></div>${x.est ? `<span class="chip ${x.est.estado === 'ACTIVE' ? 'verde' : ''}">${x.est.estado === 'ACTIVE' ? '● Activo' : h(x.est.estado.toLowerCase())}</span>` : ''}</header>
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

  const sinMeta = !meta.conectado
    ? `<div class="tarjeta an-aviso"><b>📡 Falta conectar Meta</b><p>El embudo de HQ ya funciona. Para ver lo gastado, cuántos vieron cada video y el costo por cita, falta la llave de Meta (solo lectura). ${h(meta.motivo || '')}</p>
       <ol><li>En <b>Meta Business Settings → Users → System users</b>, crea (o usa) un usuario de sistema con acceso a la cuenta de anuncios "Eduardo's" y genera un token con el permiso <b>ads_read</b>.</li>
       <li>En Netlify (sitio <b>nxus-hq</b>) → <b>Site configuration → Environment variables</b>: <code>META_TOKEN</code> = ese token y <code>META_AD_ACCOUNT_ID</code> = <code>act_736971049130563</code>.</li>
       <li><b>Deploys → Trigger deploy</b>. Al volver aquí, ya salen los números de Meta.</li></ol></div>`
    : ''

  v.innerHTML = `
    <div class="an">
      <div class="an-barra-sup">
        <div class="an-tabs">${[['todo', 'Todo'], ['MX', '🇲🇽 México'], ['NY', '🗽 Nueva York']].map(([k, t]) => `<button data-camp="${k}" class="${estado.camp === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="an-tabs">${[['todo', 'Desde el inicio'], ['7', 'Últimos 7 días']].map(([k, t]) => `<button data-per="${k}" class="${estado.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="an-vivo"><i></i>En vivo · ${new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}</div>
      </div>
      ${sinMeta}
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
      <p class="nota an-pie">Meta ${meta.conectado ? `actualizado ${new Date(meta.al).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}` : 'sin conectar'} · HQ en vivo · Esta pantalla se actualiza sola cada minuto. "Personas reales" = terminaron el filtro de ManyChat. "NEX habló" = llamada de 20 s o más.</p>
    </div>`

  v.querySelectorAll('[data-camp]').forEach((b) => (b.onclick = () => { estado.camp = b.dataset.camp; vistaAnuncios(v, { D, h, titulo, dinero }) }))
  v.querySelectorAll('[data-per]').forEach((b) => (b.onclick = () => { estado.periodo = b.dataset.per; vistaAnuncios(v, { D, h, titulo, dinero }) }))
  const obj = v.querySelector('#an-obj')
  obj.onchange = () => { guardarObjetivo(Math.max(1, Number(obj.value) || 40)); vistaAnuncios(v, { D, h, titulo, dinero }) }
  // Siempre al día: se vuelve a pedir cada minuto mientras la pantalla está abierta.
  clearInterval(v._anReloj)
  v._anReloj = setInterval(() => {
    if (location.hash !== '#anuncios' || !document.body.contains(v)) return clearInterval(v._anReloj)
    if (document.activeElement?.id === 'an-obj') return
    vistaAnuncios(v, { D, h, titulo, dinero }).catch(() => {})
  }, 60_000)
}
