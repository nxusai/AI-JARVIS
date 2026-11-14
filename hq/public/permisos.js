// Permisos: qué puede ver y hacer cada persona en HQ. Eduardo (admin) los da y los quita aquí;
// la base de datos los hace cumplir (supabase/esquema.sql: puede(), pros_puede(), pros_ve()).
// Lo personal de Eduardo (pendientes, metas, hábitos, gastos personales y su ahorro) no es un permiso:
// nunca se comparte.

export const GRUPOS = [
  {
    grupo: 'Clientes',
    icono: '◉',
    items: [
      ['clientes_editar', 'Dar de alta y editar clientes', ''],
      ['clientes_borrar', 'Borrar clientes', 'borra'],
      ['clientes_dinero', 'Ver cuánto paga cada cliente', 'dinero'],
    ],
  },
  {
    grupo: 'Tareas',
    icono: '☰',
    items: [
      ['tareas_todas', 'Ver, asignar y cambiar las tareas de todos', ''],
      ['tareas_borrar', 'Borrar tareas', 'borra'],
    ],
  },
  {
    grupo: 'Asistencia',
    icono: '◷',
    items: [
      ['asistencia_ver', 'Ver entradas y salidas de todo el equipo, con todo el historial', ''],
      ['asistencia_corregir', 'Corregir horas y registrar entradas a mano', 'sensible'],
    ],
  },
  {
    grupo: 'Nómina',
    icono: '⧉',
    items: [
      ['nomina_ver', 'Ver la nómina: cuánto gana cada quien', 'dinero'],
      ['nomina_editar', 'Cambiar sueldos, ajustes y comisiones', 'dinero'],
    ],
  },
  {
    grupo: 'Finanzas del negocio',
    icono: '$',
    items: [
      ['finanzas_ver', 'Ver ingresos, gastos del negocio, ganancias y flujo', 'dinero'],
      ['finanzas_editar', 'Registrar cobros y gastos del negocio, y cómo paga cada cliente', 'dinero'],
    ],
  },
  {
    grupo: 'Anuncios y documentos',
    icono: '📈',
    items: [
      ['anuncios_gasto', 'Ver cuánto se gasta en anuncios', 'dinero'],
      ['documentos_ver', 'Ver contratos y propuestas (PDF)', ''],
    ],
  },
  {
    grupo: 'Portafolio',
    icono: '❖',
    items: [['portafolio', 'Usar el portafolio: subir trabajos (Eduardo los aprueba) y generar portafolios para clientes', '']],
  },
  {
    grupo: 'Administración',
    icono: '⚙',
    items: [
      ['bitacora_ver', 'Ver la bitácora: quién hizo qué, cuándo y qué cambió', ''],
      ['personas_gestionar', 'Dar de alta personas y reenviar accesos (no puede dar permisos)', 'sensible'],
    ],
  },
]
export const NOMBRE = Object.fromEntries(GRUPOS.flatMap((g) => g.items.map(([k, t]) => [k, t])))
const CORTO = {
  clientes_editar: 'Editar clientes',
  clientes_borrar: 'Borrar clientes',
  clientes_dinero: 'Pagos de clientes',
  tareas_todas: 'Todas las tareas',
  tareas_borrar: 'Borrar tareas',
  asistencia_ver: 'Ver asistencia',
  asistencia_corregir: 'Corregir asistencia',
  nomina_ver: 'Ver nómina',
  nomina_editar: 'Cambiar nómina',
  finanzas_ver: 'Ver finanzas',
  finanzas_editar: 'Registrar finanzas',
  anuncios_gasto: 'Gasto en anuncios',
  documentos_ver: 'Contratos y propuestas',
  bitacora_ver: 'Bitácora',
  portafolio: 'Portafolio',
  personas_gestionar: 'Alta de personas',
}
const RIESGO = Object.fromEntries(GRUPOS.flatMap((g) => g.items.map(([k, , r]) => [k, r])))
// Para cambiar algo primero hay que poder verlo.
const REQUIERE = { clientes_borrar: 'clientes_editar', tareas_borrar: 'tareas_todas', asistencia_corregir: 'asistencia_ver', nomina_editar: 'nomina_ver', finanzas_editar: 'finanzas_ver' }
const PROS_VER = { nada: 'No ve prospectos ni leads', suyos: 'Solo los suyos (de su link o que tú le asignes)', todos: 'Todos los prospectos y leads' }

export const PLANTILLAS = {
  basico: { nombre: 'Solo lo básico', desc: 'Sus tareas, su reloj, clientes (sin dinero) y el equipo', p: [], pros: { pros_ver: 'nada' } },
  ventas: { nombre: 'Ventas', desc: 'Trabaja sus propios prospectos y leads', p: [], pros: { pros_ver: 'suyos', pros_trabajar: true, pros_etapas: true } },
  lider_ventas: { nombre: 'Líder de ventas', desc: 'Todos los prospectos, cierra clientes y reparte tareas', p: ['tareas_todas'], pros: { pros_ver: 'todos', pros_trabajar: true, pros_etapas: true, pros_convertir: true } },
  operaciones: { nombre: 'Operaciones', desc: 'Clientes, tareas de todos, asistencia y documentos', p: ['clientes_editar', 'tareas_todas', 'asistencia_ver', 'documentos_ver'], pros: { pros_ver: 'nada' } },
  contador: { nombre: 'Contador (ver)', desc: 'Ve finanzas, nómina, asistencia y pagos; no cambia nada', p: ['clientes_dinero', 'asistencia_ver', 'nomina_ver', 'finanzas_ver', 'anuncios_gasto', 'documentos_ver', 'bitacora_ver'], pros: { pros_ver: 'nada' } },
  contador_total: { nombre: 'Contador (lleva todo)', desc: 'Además registra cobros, gastos, nómina y corrige horas', p: ['clientes_dinero', 'asistencia_ver', 'asistencia_corregir', 'nomina_ver', 'nomina_editar', 'finanzas_ver', 'finanzas_editar', 'anuncios_gasto', 'documentos_ver', 'bitacora_ver'], pros: { pros_ver: 'nada' } },
  socio: { nombre: 'Socio', desc: 'Ve casi todo del negocio; no borra ni da de alta', p: ['clientes_editar', 'clientes_dinero', 'tareas_todas', 'asistencia_ver', 'nomina_ver', 'finanzas_ver', 'anuncios_gasto', 'documentos_ver', 'bitacora_ver'], pros: { pros_ver: 'todos', pros_trabajar: true, pros_etapas: true, pros_convertir: true } },
}
const PROS_BASE = { pros_ver: 'nada', pros_trabajar: false, pros_etapas: false, pros_convertir: false }

/** "Contador (ver)" si coincide con una plantilla; si no, "Personalizado". */
export function plantillaDe(p) {
  const mios = [...(p.permisos ?? [])].sort().join(',')
  for (const [k, t] of Object.entries(PLANTILLAS)) {
    const pr = { ...PROS_BASE, ...t.pros }
    if ([...t.p].sort().join(',') === mios && Object.keys(PROS_BASE).every((x) => (p[x] ?? PROS_BASE[x]) === pr[x])) return t.nombre
  }
  return 'Personalizado'
}

export function estadoAcceso(p) {
  if (p.rol === 'admin') return { t: 'Admin · todo', cls: 'ok' }
  if (!p.activo) return { t: 'Apagado', cls: 'mal' }
  if (p.acceso_hasta && new Date(p.acceso_hasta) <= new Date()) return { t: 'Venció', cls: 'mal' }
  if (p.acceso_hasta) return { t: `Hasta ${new Date(p.acceso_hasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`, cls: 'aviso' }
  return { t: 'Activo', cls: 'ok' }
}

/** Lo que verá en su menú con esos permisos. */
function menuDe(perm, pros) {
  const tiene = (k) => perm.includes(k)
  const ve = pros.pros_ver !== 'nada'
  return [
    'Inicio',
    'Clientes',
    ...(ve ? ['Prospectos', 'Leads', 'Anuncios', 'Cartera'] : []),
    'Tareas',
    'Equipo',
    'Reloj',
    ...(tiene('finanzas_ver') ? ['Finanzas'] : []),
    ...(tiene('nomina_ver') || tiene('asistencia_ver') ? ['Nómina'] : []),
    ...(tiene('personas_gestionar') ? ['Usuarios'] : []),
    ...(tiene('bitacora_ver') ? ['Bitácora'] : []),
  ]
}

/** El panel de permisos de una persona. */
export function editarPermisos({ D, h, $, $$, abrirModal, cerrarModal, intenta, mostrar, avatarHtml }, p, alGuardar) {
  let perm = [...(p.permisos ?? [])]
  let pros = { ...PROS_BASE, pros_ver: p.pros_ver || 'nada', pros_trabajar: !!p.pros_trabajar, pros_etapas: !!p.pros_etapas, pros_convertir: !!p.pros_convertir }
  const hastaIni = p.acceso_hasta ? new Date(p.acceso_hasta).toLocaleDateString('en-CA') : ''
  const fila = ([k, t, r]) =>
    `<label class="permiso"><input type="checkbox" data-k="${k}" ${perm.includes(k) ? 'checked' : ''}><span class="interruptor"></span><span class="txt">${h(t)}${r === 'dinero' ? ' <i class="riesgo dinero" title="Ve o mueve dinero">💰</i>' : r === 'borra' ? ' <i class="riesgo borra" title="Puede borrar">⚠ borra</i>' : r === 'sensible' ? ' <i class="riesgo sensible" title="Sensible">⚠</i>' : ''}</span></label>`
  abrirModal(
    `<form id="f-permisos" class="permisos-panel">
      <div class="cabeza-per">${avatarHtml}<div><h2>Permisos de ${h(p.nombre)}</h2><small>${h(p.cargo || '')}</small></div></div>
      <div class="plantillas"><span>Empieza con una plantilla:</span>${Object.entries(PLANTILLAS).map(([k, t]) => `<button type="button" class="chip-btn" data-pl="${k}" title="${h(t.desc)}">${h(t.nombre)}</button>`).join('')}</div>
      <div class="per-cols">
        <div class="per-grupos">
          <fieldset class="per-g"><legend>✦ Prospectos y leads</legend>
            <label class="ancho">Qué ve<select name="pros_ver">${Object.entries(PROS_VER).map(([k, t]) => `<option value="${k}" ${pros.pros_ver === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="permiso"><input type="checkbox" data-pr="pros_trabajar" ${pros.pros_trabajar ? 'checked' : ''}><span class="interruptor"></span><span class="txt">Trabajarlos: notas, siguiente paso y apuntar nuevos</span></label>
            <label class="permiso"><input type="checkbox" data-pr="pros_etapas" ${pros.pros_etapas ? 'checked' : ''}><span class="interruptor"></span><span class="txt">Mover etapas (reunión hecha, propuesta, perdido…)</span></label>
            <label class="permiso"><input type="checkbox" data-pr="pros_convertir" ${pros.pros_convertir ? 'checked' : ''}><span class="interruptor"></span><span class="txt">Convertirlos en clientes</span></label>
          </fieldset>
          ${GRUPOS.map((g) => `<fieldset class="per-g"><legend>${g.icono} ${h(g.grupo)}</legend>${g.items.map(fila).join('')}</fieldset>`).join('')}
          <fieldset class="per-g nunca"><legend>🔒 Nunca se comparte</legend><p>Tus pendientes, metas y hábitos, tus gastos personales y tu ahorro para metas. Ningún permiso los abre: solo tú.</p></fieldset>
        </div>
        <aside class="per-vista">
          <div class="tarjeta-mini"><b>Acceso</b>
            <label class="permiso"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}><span class="interruptor"></span><span class="txt">Puede entrar a HQ</span></label>
            <label>Hasta <small>vacío = sin fecha</small><input type="date" name="acceso_hasta" value="${hastaIni}" min="${new Date().toLocaleDateString('en-CA')}"></label>
            <div class="rapidos"><button type="button" class="chip-btn" data-dias="30">30 días</button><button type="button" class="chip-btn" data-dias="90">90 días</button><button type="button" class="chip-btn" data-dias="0">Sin fecha</button></div>
            <small class="nota">Útil para un contador en temporada de impuestos: al vencer, ya no entra solo.</small>
          </div>
          <div class="tarjeta-mini" id="per-prev"></div>
        </aside>
      </div>
      <div class="acciones"><button class="btn primario">Guardar permisos</button><button type="button" class="btn peligro" id="per-bloquear">🔒 Quitar todo y apagar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div>
    </form>`,
    (caja) => {
      const f = $('#f-permisos', caja)
      const pintar = () => {
        $$('[data-k]', caja).forEach((c) => (c.checked = perm.includes(c.dataset.k)))
        $$('[data-pr]', caja).forEach((c) => (c.checked = !!pros[c.dataset.pr]))
        f.pros_ver.value = pros.pros_ver
        const plant = plantillaDe({ permisos: perm, ...pros })
        $$('[data-pl]', caja).forEach((b) => b.classList.toggle('on', PLANTILLAS[b.dataset.pl].nombre === plant))
        const dinero = perm.filter((k) => RIESGO[k] === 'dinero')
        const borra = perm.filter((k) => RIESGO[k] === 'borra')
        $('#per-prev', caja).innerHTML = `<b>Así verá HQ</b><small>${h(plant)}</small>
          <ul class="menu-prev">${menuDe(perm, pros).map((x) => `<li>${x}</li>`).join('')}</ul>
          <div class="per-badges">${dinero.length ? `<span class="badge dinero">💰 Ve dinero: ${dinero.map((k) => CORTO[k]).join(', ')}</span>` : '<span class="badge ok">No ve dinero</span>'}${borra.length ? '<span class="badge borra">⚠ Puede borrar</span>' : '<span class="badge ok">No borra nada</span>'}</div>`
      }
      f.addEventListener('change', (e) => {
        const k = e.target.dataset?.k
        if (k) {
          if (e.target.checked) {
            perm = [...new Set([...perm, k, ...(REQUIERE[k] ? [REQUIERE[k]] : [])])]
          } else perm = perm.filter((x) => x !== k && REQUIERE[x] !== k)
        }
        const pr = e.target.dataset?.pr
        if (pr) {
          pros[pr] = e.target.checked
          if (e.target.checked && pros.pros_ver === 'nada') pros.pros_ver = 'suyos'
        }
        if (e.target.name === 'pros_ver') {
          pros.pros_ver = e.target.value
          if (pros.pros_ver === 'nada') pros = { ...pros, pros_trabajar: false, pros_etapas: false, pros_convertir: false }
        }
        pintar()
      })
      $$('[data-pl]', caja).forEach(
        (b) =>
          (b.onclick = () => {
            const t = PLANTILLAS[b.dataset.pl]
            perm = [...t.p]
            pros = { ...PROS_BASE, ...t.pros }
            pintar()
          }),
      )
      $$('[data-dias]', caja).forEach(
        (b) =>
          (b.onclick = () => {
            const n = Number(b.dataset.dias)
            f.acceso_hasta.value = n ? new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA') : ''
          }),
      )
      pintar()
      const guardar = async (cambio, msj) => {
        if (await intenta(() => D.guardarPersona({ id: p.id, ...cambio }), msj)) {
          cerrarModal()
          await alGuardar?.()
          mostrar()
        }
      }
      f.onsubmit = (e) => {
        e.preventDefault()
        const hasta = f.acceso_hasta.value ? new Date(`${f.acceso_hasta.value}T23:59:59`).toISOString() : null
        guardar({ permisos: perm, ...pros, activo: f.activo.checked, acceso_hasta: hasta, plantilla: plantillaDe({ permisos: perm, ...pros }) }, 'Permisos guardados')
      }
      $('#per-bloquear', caja).onclick = () => {
        if (!confirm(`¿Quitarle TODOS los permisos a ${p.nombre} y apagar su acceso ya? (Lo puedes regresar después.)`)) return
        guardar({ permisos: [], ...PROS_BASE, activo: false, plantilla: '' }, 'Acceso apagado')
      }
    },
  )
}

/** La matriz: todas las personas contra todos los permisos; un toque prende o apaga. */
export function matrizPermisos({ h }, gente) {
  const cols = GRUPOS.flatMap((g) => g.items.map(([k]) => k))
  return `<div class="tabla-scroll"><table class="tabla matriz"><tr><th>Persona</th><th>Prospectos</th>${cols.map((k) => `<th title="${h(NOMBRE[k])}"><span>${h(CORTO[k])}${RIESGO[k] === 'dinero' ? '&nbsp;💰' : ''}</span></th>`).join('')}</tr>${gente
    .map(
      (p) =>
        `<tr><td><b>${h(p.nombre)}</b><small>${h(plantillaDe(p))}</small></td><td><small>${{ nada: '—', suyos: 'Suyos', todos: 'Todos' }[p.pros_ver || 'nada']}</small></td>${cols
          .map((k) => `<td><button class="celda ${(p.permisos ?? []).includes(k) ? 'si' : ''}" data-mx="${p.id}|${k}" aria-label="${h(CORTO[k])} para ${h(p.nombre)}">${(p.permisos ?? []).includes(k) ? '✓' : ''}</button></td>`)
          .join('')}</tr>`,
    )
    .join('')}</table></div>`
}
export function alternar(p, k) {
  const tiene = (p.permisos ?? []).includes(k)
  let perm = tiene ? (p.permisos ?? []).filter((x) => x !== k && REQUIERE[x] !== k) : [...new Set([...(p.permisos ?? []), k, ...(REQUIERE[k] ? [REQUIERE[k]] : [])])]
  return perm
}
export { CORTO }
