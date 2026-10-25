// Solo para armar la muestra en un solo archivo (scripts/hq-muestra.mjs).
import { iniciar } from './app.js'
import { crearMuestra } from './datos-muestra.js'

iniciar(crearMuestra(), { muestra: true })
