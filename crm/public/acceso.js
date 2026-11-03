// Cómo se entra al Centro de trabajo: con un nombre de usuario (por ejemplo
// "senen") y una contraseña tan corta como el admin quiera.
//
// Supabase pide un correo y una contraseña de al menos 6 caracteres, así que:
// · cada usuario tiene por dentro un correo de entrada que nadie ve ni usa
//   para mandar nada (crm.senen@nxusai.org); el correo de verdad de la persona,
//   si lo tiene, es aparte y solo sirve para mandarle su acceso o archivos;
// · la contraseña que escribe la persona se alarga siempre igual antes de
//   mandarla a Supabase.
// Lo usan la página y las funciones de Netlify: si cambias algo aquí, las
// contraseñas que ya existen dejan de servir.

export const DOMINIO_ENTRADA = 'nxusai.org'
const PREFIJO = 'crm.'
const RELLENO = '~Msa.Crm#26'
export const CLAVE_MINIMA = 3

/** "Senén Ramos" → "senen.ramos". Vacío si no queda nada útil. */
export function normalizarUsuario(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30)
}

export const usuarioValido = (u) => /^[a-z0-9][a-z0-9._-]{1,29}$/.test(u) && !/\.\./.test(u)

/** El correo de entrada (interno) de un usuario. */
export const correoDeUsuario = (u) => `${PREFIJO}${normalizarUsuario(u)}@${DOMINIO_ENTRADA}`

/** Si un correo de entrada es de los internos, su usuario; si no, null. */
export function usuarioDeCorreo(correo) {
  const m = String(correo || '').toLowerCase().match(new RegExp(`^${PREFIJO.replace('.', '\\.')}(.+)@${DOMINIO_ENTRADA.replace('.', '\\.')}$`))
  return m ? m[1] : null
}

/** La contraseña tal como se guarda en Supabase. */
export const claveReal = (c) => `${String(c ?? '').trim()}${RELLENO}`
