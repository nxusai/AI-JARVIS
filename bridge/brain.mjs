import { readFacts } from './memory.mjs'
import { fold, readBrands, readEditStyles, readManual, readReferences } from './brands.mjs'
import { readContacts } from './contact-book.mjs'
import { orgView } from './agents.mjs'

/**
 * The "brain" view on the console: what Nexy knows, as a graph.
 *
 * Nexy in the middle; her brands, each with the notes of its manual; her
 * departments with their agents; the people she may call; and what the owner
 * told her about themselves, hung on the brand it mentions or on Nexy herself.
 * Everything comes from the same plain files she reads — nothing is invented
 * for the picture — and contacts appear by name only, never by number.
 */

const short = (s, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function buildBrain() {
  const nodes = []
  const links = []
  const add = (node, to) => {
    nodes.push(node)
    if (to) links.push({ source: to, target: node.id })
  }

  add({ id: 'nexy', label: 'NEXY', kind: 'core' })

  const { activa, marcas } = readBrands()
  for (const b of marcas) {
    add({ id: `brand:${b.id}`, label: b.nombre, kind: 'brand', color: b.color, brand: b.id, active: b.id === activa }, 'nexy')
    readManual(b.id).forEach((note, i) =>
      add({ id: `note:${b.id}:${i}`, label: short(note), detail: note, kind: 'note', color: b.color, brand: b.id }, `brand:${b.id}`),
    )
    readReferences(b.id).forEach((file, i) =>
      add({ id: `ref:${b.id}:${i}`, label: 'Referencia visual', icon: '🖼️', detail: file.split('/').pop(), kind: 'ref', color: b.color, brand: b.id }, `brand:${b.id}`),
    )
    readEditStyles(b.id).forEach((s, i) =>
      add({ id: `style:${b.id}:${i}`, label: `Estilo: ${s.nombre}`, icon: '🎬', detail: s.ficha, kind: 'ref', color: b.color, brand: b.id }, `brand:${b.id}`),
    )
  }

  const { departments, agents } = orgView()
  for (const d of departments) add({ id: `dept:${d.id}`, label: d.label, icon: d.icon, kind: 'dept' }, 'nexy')
  for (const a of agents) {
    add({ id: `agent:${a.id}`, label: a.label, icon: a.icon, detail: a.description, kind: 'agent' }, `dept:${a.dept}`)
  }

  const contacts = readContacts()
  if (contacts.length) {
    add({ id: 'people', label: 'Contactos', icon: '👥', kind: 'dept' }, 'nexy')
    contacts.forEach((c, i) => add({ id: `person:${i}`, label: c.nombre, kind: 'person' }, 'people'))
  }

  const facts = readFacts()
  if (facts.length) add({ id: 'memory', label: 'Memoria', icon: '💭', kind: 'dept' }, 'nexy')
  facts.forEach((f, i) => {
    const text = fold(f)
    const about = marcas.find((b) => text.includes(fold(b.nombre)))
    add(
      { id: `fact:${i}`, label: short(f), detail: f, kind: 'fact', color: about?.color, brand: about?.id },
      about ? `brand:${about.id}` : 'memory',
    )
  })

  return { nodes, links }
}
