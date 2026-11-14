import { createServer } from 'node:http'
import { datosDe, readUltron, supabase } from './ultron.mjs'
import { TAG } from './lugar.mjs'

/**
 * Ultron's voice console on the machine he lives in. Only that machine can
 * open it (127.0.0.1): no login. It is the same live agent as in the work
 * center ("Ultron · Centro de trabajo" in ElevenLabs: his voice, real time),
 * and what he looks up (tasks, files) is answered here, as one person of the
 * direction (ultron.json → "consola", by default Senen), with that person's
 * permissions.
 *
 *   GET  /                    the page: the orb and one button
 *   POST /vivo                a one-use permit for the live agent + who speaks
 *   POST /herramienta/<name>  his lookups, as that person
 */
export const PUERTO_CONSOLA = 8790
const AGENTE = 'Ultron · Centro de trabajo'
const API = 'https://api.elevenlabs.io/v1/convai'
const ZONA = 'America/New_York'

const sinTilde = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const primerNombre = (n) => String(n ?? '').trim().split(/\s+/)[0] || ''
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: ZONA }) : '—')

/** The profile the console speaks as: active, of the direction, never an administrator. */
export async function personaDeConsola(db, nombre) {
  const filas = await db.rest('perfiles?activo=eq.true&ultron=eq.true&select=*')
  const quien = primerNombre(sinTilde(nombre))
  return (filas ?? []).find((p) => p.rol !== 'admin' && primerNombre(sinTilde(p.nombre)) === quien) ?? null
}

// -- what he looks up, with that person's permissions ------------------------------

const HOJAS = [
  { k: 'pedidas', titulo: 'Pedidas', estatus: ['recibida'] },
  { k: 'proceso', titulo: 'En proceso', estatus: ['en-proceso', 'en-correccion'] },
  { k: 'revisar', titulo: 'Para revisar', estatus: ['entregada'] },
  { k: 'aprobadas', titulo: 'Aprobadas', estatus: ['aprobada'] },
]
const ESTADO_LARGO = {
  recibida: 'Pedida: nadie del equipo la ha tomado',
  'en-proceso': 'En proceso: el equipo la está haciendo',
  'en-correccion': 'En proceso: el equipo está haciendo una corrección',
  entregada: 'Para revisar: el equipo ya la entregó; falta aprobarla o pedir corrección',
  aprobada: 'Aprobada: terminada',
}
const atrasada = (t) => t.compromiso && t.compromiso < hoyISO() && !['entregada', 'aprobada'].includes(t.estatus)

/** The answers to the agent's client tools, from what that person can see. */
export function herramientasDe({ datos, persona, gente }) {
  const empresa = (id) => datos.empresas.find((e) => e.id === id)?.nombre ?? 'sin empresa'
  const quien = (id) => (id === persona.id ? primerNombre(persona.nombre) : primerNombre(gente.find((g) => g.id === id)?.nombre) || 'alguien')
  const linea = (t) =>
    [
      `Tarea ${t.folio} «${t.titulo}»`,
      `empresa ${empresa(t.empresa_id)}`,
      `estado: ${ESTADO_LARGO[t.estatus] ?? t.estatus}`,
      t.urgente ? 'URGENTE' : '',
      t.compromiso && t.estatus !== 'aprobada' ? `compromiso ${t.compromiso}${atrasada(t) ? ' (atrasada)' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  const coincide = (texto, q) => sinTilde(q).split(/\s+/).filter(Boolean).every((w) => sinTilde(texto).includes(w))
  const tareas = [...datos.tareas].sort((a, b) => String(b.pedida).localeCompare(String(a.pedida)))
  const mes = hoyISO().slice(0, 7)
  return {
    resumen_centro: () => {
      const cuenta = HOJAS.map((x) => `${x.titulo}: ${x.k === 'aprobadas' ? tareas.filter((t) => t.estatus === 'aprobada' && String(t.aprobada ?? '').slice(0, 7) === mes).length : tareas.filter((t) => x.estatus.includes(t.estatus)).length}`)
      const mias = tareas.filter((t) => t.estatus === 'entregada')
      const tarde = tareas.filter(atrasada)
      return [
        `${cuenta.join(', ')} (aprobadas: este mes)`,
        `Le tocan a ${primerNombre(persona.nombre)} (revisar y aprobar): ${mias.length}${mias.length ? ` (${mias.slice(0, 3).map((t) => `${t.folio} ${t.titulo}`).join('; ')})` : ''}`,
        `Atrasadas: ${tarde.length}${tarde.length ? ` (${tarde.slice(0, 3).map((t) => `${t.folio} ${t.titulo}`).join('; ')})` : ''}`,
        `Urgentes abiertas: ${tareas.filter((t) => t.urgente && t.estatus !== 'aprobada').length}`,
      ].join('\n')
    },
    ultimas_tareas: ({ cantidad = 3 } = {}) => {
      const l = tareas.slice(0, Math.max(1, Math.min(6, Number(cantidad) || 3)))
      return l.length ? l.map((t) => `${linea(t)} · pedida ${fecha(t.pedida)}`).join('\n') : 'Todavía no hay tareas.'
    },
    buscar_tareas: ({ texto = '', hoja = '' } = {}) => {
      let l = tareas
      const h = sinTilde(hoja)
      if (h === 'atrasadas') l = l.filter(atrasada)
      else if (h === 'urgentes') l = l.filter((t) => t.urgente && t.estatus !== 'aprobada')
      else if (HOJAS.some((x) => x.k === h)) l = l.filter((t) => HOJAS.find((x) => x.k === h).estatus.includes(t.estatus))
      if (String(texto).trim()) l = l.filter((t) => coincide(`${t.folio} ${t.titulo} ${t.descripcion ?? ''} ${empresa(t.empresa_id)}`, texto))
      return l.length ? `${l.length} encontradas.\n${l.slice(0, 6).map(linea).join('\n')}` : 'Ninguna tarea con eso.'
    },
    ver_tarea: ({ folio } = {}) => {
      const t = tareas.find((x) => Number(x.folio) === Number(folio))
      if (!t) return `No veo la tarea ${folio}.`
      const corr = datos.correcciones.filter((c) => c.tarea_id === t.id)
      const notas = datos.notas.filter((n) => n.tarea_id === t.id)
      const archivos = datos.archivos.filter((a) => a.tarea_id === t.id)
      return [
        linea(t),
        `Lo que pidió: ${String(t.descripcion || t.titulo).slice(0, 400)}`,
        `Historia: pedida ${fecha(t.pedida)} por ${quien(t.cliente_id)}${t.tomada ? `; la tomó ${quien(t.tomada_por)} el ${fecha(t.tomada)}` : ''}${t.aprobada ? `; aprobada el ${fecha(t.aprobada)}` : ''}`,
        `Correcciones: ${corr.length}${corr.map((c) => `\n  - corrección ${c.n ?? ''}: ${String(c.instrucciones ?? '').slice(0, 160)}`).join('')}`,
        `Actualizaciones: ${notas.length}${notas.slice(-2).map((n) => `\n  - de ${quien(n.autor)} el ${fecha(n.creada)}: ${String(n.texto || '').slice(0, 160)}`).join('')}`,
        `Archivos (${archivos.length}): ${archivos.slice(0, 8).map((a) => `id ${a.id}: ${a.nombre}`).join('; ') || 'ninguno'}`,
      ].join('\n')
    },
    buscar_archivos: ({ texto = '' } = {}) => {
      const l = datos.archivos.filter((a) => a.vigente !== false && coincide(`${a.nombre} ${empresa(a.empresa_id)}`, texto))
      return l.length ? `${l.length} archivos.\n${l.slice(0, 6).map((a) => `id ${a.id}: ${a.nombre}${a.empresa_id ? ` (${empresa(a.empresa_id)})` : ''}`).join('\n')}` : 'No encontré archivos con eso.'
    },
    mandar_al_correo: () => 'Desde esta consola no puedo mandar correos. Dile que lo pida en el Centro de trabajo, donde llega a su correo.',
    pedir_tarea: () => 'Desde esta consola no registro tareas nuevas. Dile que la pida en el Centro de trabajo con el botón de pedir, y ahí queda a su nombre.',
  }
}

/** What the agent is told when the call starts (the same variables as in the work center). */
export function contextoDe({ datos, persona, herramientas }) {
  const hora = Number(new Date().toLocaleString('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }))
  const nombre = primerNombre(persona.nombre) || 'Director'
  return {
    nombre,
    rol: 'la dirección',
    hoy: new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA }),
    empresas: datos.empresas.map((e) => e.nombre).join(', ') || 'ninguna',
    reglas_tema:
      'Tu trabajo es el Centro de trabajo: tareas, archivos de la Biblioteca y catálogos. Saludos y plática breve sí, con amabilidad. Si te piden algo ajeno al trabajo, contesta con simpatía en una frase que en eso no puedes ayudar y ofrece algo del Centro de trabajo, sin sonar cortante.',
    resumen: `${herramientas.resumen_centro()}\n\nLas más recientes:\n${herramientas.ultimas_tareas({ cantidad: 6 })}`,
    saludo: `${hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${nombre}. ¿En qué te ayudo?`,
  }
}

// -- the server ----------------------------------------------------------------

async function el(path, llave) {
  const res = await fetch(`${API}${path}`, { headers: { 'xi-api-key': llave }, signal: AbortSignal.timeout(10_000) })
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(r?.detail?.message || (typeof r?.detail === 'string' ? r.detail : '') || `ElevenLabs ${res.status}`)
  return r
}

function leer(req, limite = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let texto = ''
    req.on('data', (d) => {
      texto += d
      if (texto.length > limite) {
        reject(new Error('muy largo'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(texto))
    req.on('error', reject)
  })
}

export function startConsolaLocal({ elevenKey, puerto = PUERTO_CONSOLA }) {
  let agente = null
  let cache = null // { hasta, datos, persona, gente }
  const contexto = async () => {
    if (cache && cache.hasta > Date.now()) return cache
    const cfg = readUltron()
    if (!cfg?.url || !cfg?.servicio) throw new Error('No estoy conectado al Centro de trabajo.')
    const db = supabase(cfg)
    const persona = await personaDeConsola(db, cfg.consola || 'Senen')
    if (!persona) throw new Error(`No encuentro a ${cfg.consola || 'Senen'} en el Centro de trabajo (activo y con Ultron).`)
    const [datos, gente] = await Promise.all([datosDe(db, persona), db.rest('perfiles?select=id,nombre')])
    cache = { hasta: Date.now() + 20_000, datos, persona, gente: gente ?? [] }
    return cache
  }

  const servidor = createServer(async (req, res) => {
    // Only this machine, by its own name: a web page elsewhere cannot reach it through the browser.
    const host = String(req.headers.host ?? '')
    if (host !== `127.0.0.1:${puerto}` && host !== `localhost:${puerto}`) return res.writeHead(403).end()
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGINA)
    }
    const responder = (code, body) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body))
    if (req.method !== 'POST') return res.writeHead(404).end()
    const origen = req.headers.origin
    if (origen !== `http://127.0.0.1:${puerto}` && origen !== `http://localhost:${puerto}`) return res.writeHead(403).end()
    try {
      if (req.url === '/vivo') {
        const llave = typeof elevenKey === 'function' ? elevenKey() : elevenKey
        if (!llave) return responder(503, { error: 'Me falta la llave de voz.' })
        cache = null
        const c = await contexto()
        if (!agente) {
          const r = await el(`/agents?search=${encodeURIComponent(AGENTE)}&page_size=10`, llave)
          agente = (r.agents ?? []).find((a) => a.name === AGENTE)?.agent_id ?? null
          if (!agente) return responder(503, { error: 'Ultron en vivo no está preparado en ElevenLabs.' })
        }
        const [token, firmada] = await Promise.allSettled([el(`/conversation/token?agent_id=${agente}`, llave), el(`/conversation/get-signed-url?agent_id=${agente}`, llave)])
        const conversationToken = token.status === 'fulfilled' ? token.value.token : null
        const signedUrl = firmada.status === 'fulfilled' ? firmada.value.signed_url : null
        if (!conversationToken && !signedUrl) {
          agente = null
          throw firmada.reason || token.reason
        }
        const h = herramientasDe(c)
        return responder(200, { conversationToken, signedUrl, variables: contextoDe({ ...c, herramientas: h }) })
      }
      const m = /^\/herramienta\/([a-z_]+)$/.exec(req.url ?? '')
      if (m) {
        const args = JSON.parse((await leer(req)) || '{}')
        const h = herramientasDe(await contexto())
        if (!h[m[1]]) return responder(404, { resultado: 'No conozco esa herramienta.' })
        return responder(200, { resultado: String(await h[m[1]](args)).slice(0, 6000) })
      }
      return res.writeHead(404).end()
    } catch (err) {
      console.log(`${TAG} voice console: ${err.message}`)
      return responder(500, { error: err.message })
    }
  })
  servidor.on('error', (err) => console.log(`${TAG} voice console not started: ${err.message}`))
  servidor.listen(puerto, '127.0.0.1', () => console.log(`${TAG} voice console on http://127.0.0.1:${puerto}`))
  return servidor
}

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#07080b;color:#f4efe8;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;overflow:hidden}
main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
canvas{width:min(70vmin,560px);height:min(70vmin,560px)}
#estado{font-size:20px;letter-spacing:.04em;color:#ffb066;min-height:28px;text-align:center;padding:0 24px}
#boton{appearance:none;border:0;border-radius:999px;padding:18px 44px;font-size:20px;font-weight:600;background:#ff9a2e;color:#120a02;cursor:pointer}
#boton.fin{background:#2a2c33;color:#f4efe8}
#boton:disabled{opacity:.5;cursor:default}
</style></head><body><main>
<canvas id="orbe" width="1120" height="1120" aria-hidden="true"></canvas>
<div id="estado" role="status">Toca para hablar con Ultron</div>
<button id="boton" type="button">Hablar</button>
</main><script type="module">
const SDK='https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.32.0/+esm'
const lienzo=document.getElementById('orbe'),c=lienzo.getContext('2d'),estado=document.getElementById('estado'),boton=document.getElementById('boton')
let nivel=0,meta=0,t=0,ses=null,modo='',reloj=null
const P=[];for(let i=0;i<1400;i++){const y=1-i/1399*2,r=Math.sqrt(1-y*y),a=i*2.39996;P.push([Math.cos(a)*r,y,Math.sin(a)*r])}
function dibujar(){t+=0.004;nivel+=(meta-nivel)*0.15;c.clearRect(0,0,1120,1120);const R=330*(1+nivel*0.18),s=Math.sin(t),k=Math.cos(t)
for(const[x,y,z]of P){const X=x*k-z*s,Z=x*s+z*k,j=1+nivel*0.25*Math.sin(t*40+y*9),px=560+X*R*j,py=560+y*R*j,a=(Z+1.3)/2.3
c.fillStyle='rgba(255,'+(140+Math.round(70*a))+',46,'+(0.35+a*0.65)+')';c.fillRect(px,py,4.2,4.2)}requestAnimationFrame(dibujar)}dibujar()
const post=async(ruta,cuerpo)=>{const r=await fetch(ruta,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cuerpo??{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'No pude hablar con el cerebro.');return j}
const NOMBRES=['resumen_centro','ultimas_tareas','buscar_tareas','ver_tarea','buscar_archivos','mandar_al_correo','pedir_tarea']
const herramientas=Object.fromEntries(NOMBRES.map(n=>[n,async(args)=>{try{return (await post('/herramienta/'+n,args)).resultado}catch(e){return 'No pude consultarlo: '+e.message}}]))
function listo(){ses=null;clearInterval(reloj);meta=0;boton.disabled=false;boton.textContent='Hablar';boton.classList.remove('fin');estado.textContent='Toca para hablar con Ultron'}
async function empezar(){boton.disabled=true;estado.textContent='Conectando…'
let cred,Conversation;try{[cred,{Conversation}]=await Promise.all([post('/vivo'),import(SDK)])}catch(e){estado.textContent=e.message;boton.disabled=false;return}
const base={clientTools:herramientas,dynamicVariables:cred.variables,
onModeChange:({mode})=>{modo=mode;estado.textContent=mode==='speaking'?'Ultron está hablando…':'Te escucho…'},
onDisconnect:listo,onError:(m)=>{estado.textContent='Ultron: '+m}}
try{ses=cred.conversationToken?await Conversation.startSession({...base,conversationToken:cred.conversationToken,connectionType:'webrtc'}):await Conversation.startSession({...base,signedUrl:cred.signedUrl,connectionType:'websocket'})}
catch(e){try{if(!cred.signedUrl)throw e;ses=await Conversation.startSession({...base,signedUrl:cred.signedUrl,connectionType:'websocket'})}catch(e2){estado.textContent=/permission|denied|NotAllowed/i.test(String(e2))?'Necesito permiso para el micrófono.':'No pude conectar: '+(e2.message||e2);boton.disabled=false;return}}
boton.disabled=false;boton.textContent='Terminar';boton.classList.add('fin');estado.textContent='Te escucho…'
reloj=setInterval(()=>{let n=0;try{n=modo==='speaking'?ses.getOutputVolume():ses.getInputVolume()}catch{}meta=Math.min(1,n*2.2)},80)}
boton.onclick=async()=>{if(ses){const s=ses;listo();try{await s.endSession()}catch{}return}empezar()}
</script></body></html>`
