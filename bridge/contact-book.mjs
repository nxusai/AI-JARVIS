import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * The owner's approved contacts — the only people Nexy may phone for them.
 *
 * The list lives in a file on this Mac and is written only by
 * scripts/contacts.mjs, which the owner runs themselves. No tool can add to
 * it. That is the point: a number read out of an email, heard from a caller
 * or made up by the model has no way onto the list, so it has no way to ring.
 *
 * Numbers are E.164 and limited to the countries the owner calls: the US and
 * Canada (+1) and Mexico (+52).
 */

export const CONTACTS_FILE = join(homedir(), '.nexy', 'contactos.json')

export const ALLOWED_NUMBER = /^\+(1\d{10}|52\d{10})$/

/** Case- and accent-blind, so "jose" finds "José". */
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** "+52 (55) 1234-5678" -> "+525512345678". */
export const normalisePhone = (s) => String(s ?? '').replace(/[\s().-]/g, '')

export function readContacts() {
  try {
    const list = JSON.parse(readFileSync(CONTACTS_FILE, 'utf8')).contactos
    return Array.isArray(list)
      ? list.filter(
          (c) =>
            c &&
            typeof c.nombre === 'string' &&
            c.nombre.trim() &&
            ALLOWED_NUMBER.test(c.telefono ?? ''),
        )
      : []
  } catch {
    return []
  }
}

export function writeContacts(list) {
  mkdirSync(dirname(CONTACTS_FILE), { recursive: true })
  writeFileSync(CONTACTS_FILE, JSON.stringify({ contactos: list }, null, 2) + '\n')
}

/**
 * Who `name` means: an exact name first, otherwise every contact whose name
 * contains it or has a word starting with it. More than one is the caller's
 * cue to ask which.
 */
export function findContacts(list, name) {
  const q = fold(name)
  if (!q) return []
  const exact = list.filter((c) => fold(c.nombre) === q)
  if (exact.length) return exact
  return list.filter((c) => {
    const n = fold(c.nombre)
    return n.includes(q) || n.split(' ').some((w) => w.startsWith(q))
  })
}

export const country = (phone) => (phone.startsWith('+52') ? 'México' : 'EE. UU.')
