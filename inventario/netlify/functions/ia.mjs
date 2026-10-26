// Ana Sofi en el inventario: lee la foto del packing slip y llena la
// recepción (proveedor, número, productos, lotes, caducidades), y al final
// revisa las fotos y lo que anotó el empleado para ordenar los problemas en
// categorías claras. Nada se guarda aquí: la página le enseña el resultado a
// quien está recibiendo y él lo guarda.
import Anthropic from '@anthropic-ai/sdk'
import { json, quien, sb } from '../lib/sb.mjs'

const MAX_FOTOS = 8
const MAX_BYTES = 4_500_000 // en base64, todas juntas (Netlify acepta 6 MB)
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

const LINEA = {
  type: 'object',
  additionalProperties: false,
  required: ['producto', 'producto_id', 'unidad', 'cantidad', 'lote', 'caducidad', 'precio'],
  properties: {
    producto: { type: 'string', description: 'El producto como viene en la hoja, claro y corto.' },
    producto_id: { type: 'string', description: 'El id del producto del catálogo si es claramente el mismo; vacío si no hay.' },
    unidad: { type: 'string', description: 'costal, lb, kg, caja, galón, cubeta, pieza… como venga.' },
    cantidad: { type: 'number', description: 'La cantidad que dice la hoja; 0 si no se lee.' },
    lote: { type: 'string', description: 'Lote o batch, vacío si no viene.' },
    caducidad: { type: 'string', description: 'Fecha de caducidad (expiration / best by) AAAA-MM-DD; vacío si no viene.' },
    precio: { type: 'number', description: 'Precio por unidad si viene; 0 si no.' },
  },
}

const PACKING = {
  type: 'object',
  additionalProperties: false,
  required: ['es_packing', 'proveedor_nombre', 'proveedor_id', 'packing_numero', 'packing_fecha', 'lineas', 'notas', 'dudas'],
  properties: {
    es_packing: { type: 'boolean', description: 'true si la foto es un packing slip, factura, remisión o bill of lading.' },
    proveedor_nombre: { type: 'string', description: 'Quien manda la mercancía (el vendedor/shipper), no Mi Semago.' },
    proveedor_id: { type: 'string', description: 'El id del proveedor del catálogo si es claramente el mismo; vacío si es nuevo.' },
    packing_numero: { type: 'string', description: 'Número de packing slip, orden, factura o PO que traiga.' },
    packing_fecha: { type: 'string', description: 'Fecha de la hoja AAAA-MM-DD; vacío si no viene.' },
    lineas: { type: 'array', items: LINEA },
    notas: { type: 'string', description: 'Algo importante de la hoja (backorder, faltantes anotados, temperatura, instrucciones). Corto; vacío si nada.' },
    dudas: { type: 'array', items: { type: 'string' }, description: 'Lo que no se pudo leer bien y el empleado debe revisar (máximo 4).' },
  },
}

const INCIDENCIAS = ['faltante', 'sobrante', 'danado', 'caducado', 'calidad', 'equivocado', 'sin-packing', 'temperatura', 'transporte', 'otro']
const PROBLEMAS = ['ninguno', 'faltante', 'sobrante', 'danado', 'caducado', 'calidad', 'equivocado', 'otro']

const REVISION = {
  type: 'object',
  additionalProperties: false,
  required: ['resultado', 'resumen', 'lineas', 'incidencias', 'dudas'],
  properties: {
    resultado: { type: 'string', enum: ['completa', 'incompleta', 'con-problemas', 'rechazada'] },
    resumen: { type: 'string', description: 'Dos a cuatro líneas en español sencillo: qué llegó, qué faltó o vino mal y qué hacer (reclamar al proveedor, apartar, etc.).' },
    lineas: {
      type: 'array',
      description: 'Una por cada producto de la recepción, con su id.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'problema', 'calidad', 'nota'],
        properties: {
          id: { type: 'string' },
          problema: { type: 'string', enum: PROBLEMAS },
          calidad: { type: 'string', enum: ['buena', 'regular', 'mala'] },
          nota: { type: 'string', description: 'Lo que pasó con este producto en una frase; vacío si todo bien.' },
        },
      },
    },
    incidencias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'producto', 'cantidad', 'detalle'],
        properties: {
          tipo: { type: 'string', enum: INCIDENCIAS },
          producto: { type: 'string', description: 'Vacío si es de toda la entrega.' },
          cantidad: { type: 'number', description: 'Cuántas unidades afecta; 0 si no aplica.' },
          detalle: { type: 'string' },
        },
      },
    },
    dudas: { type: 'array', items: { type: 'string' }, description: 'Lo que el empleado debería revisar antes de cerrar (máximo 3).' },
  },
}

const SISTEMA =
  'Eres Ana Sofi, la asistente de Mi Semago (The Better Latin Dairy Company), una quesería en Estados Unidos. ' +
  'Ayudas al equipo de almacén a registrar lo que llega de los proveedores: ingredientes para hacer queso (leche en polvo, sal, cuajo, cultivos, cloruro de calcio, empaques, etc.). ' +
  'Las hojas pueden venir en inglés o en español, fotografiadas con el celular, chuecas o con poca luz. ' +
  'Nunca inventes: lo que no se lee va vacío o en 0 y, si importa, en "dudas". Escribe en español claro y corto, para gente de almacén.'

function imagenes(lista) {
  const fotos = (Array.isArray(lista) ? lista : []).slice(0, MAX_FOTOS).filter((f) => TIPOS.includes(f?.tipo) && typeof f?.data === 'string' && f.data.length > 100)
  const total = fotos.reduce((s, f) => s + f.data.length, 0)
  if (total > MAX_BYTES) throw Object.assign(new Error('Las fotos pesan demasiado. Manda menos fotos.'), { status: 413 })
  return fotos
}

async function pedir(client, schema, content) {
  const res = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: SISTEMA,
    messages: [{ role: 'user', content }],
  })
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('Ana Sofi no pudo con eso. Intenta con otra foto.'), { status: 422 })
  return JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))
  // Netlify corta una función a los 60 segundos: un solo intento de 50, para
  // que Ana Sofi tenga tiempo de leer varias fotos y aun así contestemos.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 0 })

  try {
    const fotos = imagenes(d.imagenes)
    const bloques = (lista, etiqueta) =>
      lista.flatMap((f, i) => [
        { type: 'text', text: etiqueta(f, i) },
        { type: 'image', source: { type: 'base64', media_type: f.tipo, data: f.data } },
      ])

    if (d.accion === 'packing') {
      if (!fotos.length) return json({ ok: false, error: 'Falta la foto del packing slip' }, 400)
      // El catálogo, con los candados de quien pide, para reconocer proveedor y productos.
      const [provs, prods] = await Promise.all([
        sb('/rest/v1/proveedores?select=id,nombre&activo=eq.true&order=nombre', { token: yo.token }),
        sb('/rest/v1/productos?select=id,nombre,unidad&activo=eq.true&order=nombre', { token: yo.token }),
      ])
      const catalogo =
        `Proveedores que ya conocemos (id · nombre):\n${provs.map((p) => `${p.id} · ${p.nombre}`).join('\n') || '(ninguno todavía)'}\n\n` +
        `Productos que ya conocemos (id · nombre · unidad):\n${prods.map((p) => `${p.id} · ${p.nombre} · ${p.unidad}`).join('\n') || '(ninguno todavía)'}`
      const ficha = await pedir(client, PACKING, [
        ...bloques(fotos, (_, i) => `Página ${i + 1} del packing slip:`),
        { type: 'text', text: `${catalogo}\n\nLee el packing slip y llena la recepción. Una línea por producto, con su lote y caducidad si vienen.` },
      ])
      // Solo ids que de verdad existen.
      const provIds = new Set(provs.map((p) => p.id))
      const prodIds = new Set(prods.map((p) => p.id))
      if (!provIds.has(ficha.proveedor_id)) ficha.proveedor_id = ''
      for (const l of ficha.lineas) if (!prodIds.has(l.producto_id)) l.producto_id = ''
      return json({ ok: true, ficha })
    }

    if (d.accion === 'revisar') {
      const r = d.recepcion ?? {}
      const lineas = (Array.isArray(r.lineas) ? r.lineas : []).slice(0, 60)
      if (!lineas.length) return json({ ok: false, error: 'Agrega primero lo que llegó' }, 400)
      const TIPO = { mercancia: 'Foto de la mercancía', dano: 'Foto de algo dañado', packing: 'Foto del packing slip', otro: 'Foto' }
      const texto =
        `Proveedor: ${String(r.proveedor || '—').slice(0, 120)}\n` +
        `Trajo packing slip: ${r.sin_packing ? 'NO' : 'sí'}\n` +
        `Temperatura al llegar: ${String(r.temperatura || 'no se anotó').slice(0, 30)}\n` +
        `Transporte limpio y en buen estado: ${r.transporte_ok === false ? 'NO' : r.transporte_ok === true ? 'sí' : 'no se anotó'}\n\n` +
        `Productos (id · producto · esperado según la hoja · recibido · dañados · unidad · lote · caducidad · lo que anotó el empleado):\n` +
        lineas
          .map((l) => [l.id, l.producto, l.cantidad_esperada ?? '?', l.cantidad_recibida ?? '?', l.danados || 0, l.unidad, l.lote || '—', l.caducidad || '—', l.nota || ''].map((x) => String(x).slice(0, 200)).join(' · '))
          .join('\n') +
        `\n\nLo que anotó el empleado:\n${String(r.notas || '(nada)').slice(0, 3000)}\n\n` +
        `Hoy es ${new Date().toISOString().slice(0, 10)}. Revisa las fotos y los datos. Para cada producto decide su problema y su calidad; ` +
        `junta todo lo que salió mal en "incidencias" (faltantes = esperado menos recibido; dañados = lo marcado o lo que se vea roto en las fotos; caducado o por caducar en menos de 30 días; sin packing slip; temperatura fuera de rango para refrigerados, más de 41 °F; transporte sucio). ` +
        `"completa" solo si llegó todo bien; "rechazada" si el empleado dice que se regresó la entrega.`
      const revision = await pedir(client, REVISION, [...bloques(fotos, (f, i) => `${TIPO[f.uso] ?? 'Foto'} ${i + 1}${f.nota ? ` (${String(f.nota).slice(0, 200)})` : ''}:`), { type: 'text', text: texto }])
      const ids = new Set(lineas.map((l) => String(l.id)))
      revision.lineas = revision.lineas.filter((l) => ids.has(l.id))
      return json({ ok: true, revision })
    }

    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    if (err.status === 413 || err.status === 422) return json({ ok: false, error: err.message }, err.status)
    console.log('ia:', err?.status ?? '', err?.message ?? err)
    if (err instanceof Anthropic.AuthenticationError) return json({ ok: false, error: 'La llave de Anthropic no sirve. Revisa ANTHROPIC_API_KEY en Netlify.' }, 503)
    if (err instanceof Anthropic.PermissionDeniedError || /credit balance/i.test(err?.message ?? '')) return json({ ok: false, error: 'La cuenta de Anthropic no tiene saldo. Hay que recargar créditos.' }, 503)
    if (err instanceof Anthropic.RateLimitError) return json({ ok: false, error: 'Ana Sofi está muy ocupada. Intenta en un minuto.' }, 429)
    return json({ ok: false, error: 'Ana Sofi no respondió a tiempo. Intenta otra vez.' }, 502)
  }
}
