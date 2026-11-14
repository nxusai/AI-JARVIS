import { createServer } from 'node:http'
import { atender, readUltron, supabase, VOZ_ULTRON } from './ultron.mjs'
import { TAG } from './lugar.mjs'
import { transcribe, VOICE_ID } from './voz.mjs'

/**
 * Ultron's voice console on the machine he lives in. Only that machine can
 * open it (127.0.0.1): no login. Whoever sits there speaks as one person of
 * the direction (ultron.json → "consola", by default Senen) and Ultron answers
 * with that person's permissions, by voice.
 *
 *   GET  /      the page: one button, the orb, nothing to type
 *   POST /oir   a phrase of audio → { pregunta, respuesta, audio (base64 mp3) }
 */
export const PUERTO_CONSOLA = 8790
const MAX_AUDIO = 8 * 1024 * 1024

const sinTilde = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The profile the console speaks as: active, of the direction, never an administrator. */
export async function personaDeConsola(db, nombre) {
  const filas = await db.rest('perfiles?activo=eq.true&ultron=eq.true&select=*')
  const quien = sinTilde(nombre).trim()
  return (filas ?? []).find((p) => p.rol !== 'admin' && sinTilde(p.nombre).split(/\s+/)[0] === quien.split(/\s+/)[0]) ?? null
}

function leer(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = []
    let total = 0
    req.on('data', (d) => {
      total += d.length
      if (total > limite) {
        reject(new Error('audio muy largo'))
        req.destroy()
      } else partes.push(d)
    })
    req.on('end', () => resolve(Buffer.concat(partes)))
    req.on('error', reject)
  })
}

export function startConsolaLocal({ model, modeloRapido, effort, env, elevenKey, puerto = PUERTO_CONSOLA }) {
  let ocupado = false
  const servidor = createServer(async (req, res) => {
    // Only this machine, by its own name: a web page elsewhere cannot reach it through the browser.
    const host = String(req.headers.host ?? '')
    if (host !== `127.0.0.1:${puerto}` && host !== `localhost:${puerto}`) {
      res.writeHead(403).end()
      return
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGINA)
      return
    }
    if (req.method === 'POST' && req.url === '/oir') {
      const origen = req.headers.origin
      if (origen && origen !== `http://127.0.0.1:${puerto}` && origen !== `http://localhost:${puerto}`) {
        res.writeHead(403).end()
        return
      }
      const responder = (code, body) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      if (ocupado) return responder(429, { error: 'Todavía estoy contestando lo anterior.' })
      ocupado = true
      try {
        const cfg = readUltron()
        const llave = typeof elevenKey === 'function' ? elevenKey() : elevenKey
        if (!cfg?.url || !cfg?.servicio) return responder(503, { error: 'No estoy conectado al Centro de trabajo.' })
        if (!llave) return responder(503, { error: 'Me falta la llave de voz.' })
        const audio = await leer(req, MAX_AUDIO)
        const pregunta = audio.length > 2000 ? await transcribe(llave, audio, 'frase.webm') : ''
        if (!pregunta || pregunta.replace(/[^\p{L}\p{N}]/gu, '').length < 2) return responder(200, { vacio: true })
        const db = supabase(cfg)
        const persona = await personaDeConsola(db, cfg.consola || 'Senen')
        if (!persona) return responder(503, { error: `No encuentro a ${cfg.consola || 'Senen'} en el Centro de trabajo.` })
        const [m] = await db.rest('ultron_mensajes', {
          method: 'POST',
          prefer: 'return=representation',
          body: { persona: persona.id, canal: 'crm', pregunta: pregunta.slice(0, 2000), estado: 'pensando' },
        })
        const voz = VOICE_ID.test(cfg.voz ?? '') ? cfg.voz : VOZ_ULTRON
        const r = await atender({ db, m, model, modeloRapido, effort, env, elevenKey: llave, voz })
        if (!r) return responder(200, { pregunta, respuesta: 'Tuve un problema para responder. Intenta de nuevo.' })
        responder(200, { pregunta, respuesta: r.respuesta, audio: r.audio ? Buffer.from(r.audio).toString('base64') : null })
      } catch (err) {
        console.log(`${TAG} voice console: ${err.message}`)
        responder(500, { error: 'Tuve un problema. Intenta de nuevo.' })
      } finally {
        ocupado = false
      }
      return
    }
    res.writeHead(404).end()
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
</style></head><body><main>
<canvas id="orbe" width="1120" height="1120" aria-hidden="true"></canvas>
<div id="estado" role="status">Toca para hablar con Ultron</div>
<button id="boton" type="button">Hablar</button>
</main><script>
const lienzo=document.getElementById('orbe'),c=lienzo.getContext('2d'),estado=document.getElementById('estado'),boton=document.getElementById('boton')
let nivel=0,meta=0,t=0,modo='quieto'
const P=[];for(let i=0;i<1400;i++){const y=1-i/1399*2,r=Math.sqrt(1-y*y),a=i*2.39996;P.push([Math.cos(a)*r,y,Math.sin(a)*r])}
function dibujar(){t+=0.004;nivel+=(meta-nivel)*0.12;c.clearRect(0,0,1120,1120);const R=330*(1+nivel*0.18),s=Math.sin(t),k=Math.cos(t)
for(const[x,y,z]of P){const X=x*k-z*s,Z=x*s+z*k,j=1+nivel*0.25*Math.sin(t*40+y*9);const px=560+X*R*j,py=560+y*R*j,a=(Z+1.3)/2.3
c.fillStyle='rgba(255,'+(140+Math.round(70*a))+',46,'+(0.35+a*0.65)+')';c.fillRect(px,py,4.2,4.2)}
requestAnimationFrame(dibujar)}dibujar()
let flujo=null,ctx=null,analizador=null,grabadora=null,trozos=[],activo=false,sonando=null
const dormir=ms=>new Promise(r=>setTimeout(r,ms))
function volumen(){const d=new Uint8Array(analizador.fftSize);analizador.getByteTimeDomainData(d);let s=0;for(const v of d){const x=(v-128)/128;s+=x*x}return Math.sqrt(s/d.length)}
async function abrir(){flujo=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});ctx=new AudioContext();analizador=ctx.createAnalyser();analizador.fftSize=1024;ctx.createMediaStreamSource(flujo).connect(analizador)}
async function frase(){trozos=[];grabadora=new MediaRecorder(flujo);grabadora.ondataavailable=e=>e.data.size&&trozos.push(e.data);grabadora.start(200)
let hablo=false,silencio=0,inicio=Date.now();modo='escucha';estado.textContent='Te escucho…'
while(activo){await dormir(60);const v=volumen();meta=Math.min(1,v*6);if(v>0.035){hablo=true;silencio=0}else if(hablo){silencio+=60}
if(hablo&&silencio>1100)break;if(!hablo&&Date.now()-inicio>30000)break;if(Date.now()-inicio>45000)break}
await new Promise(r=>{grabadora.onstop=r;grabadora.stop()});meta=0;return hablo?new Blob(trozos,{type:grabadora.mimeType||'audio/webm'}):null}
async function conversar(){while(activo){const audio=await frase();if(!activo)break;if(!audio){estado.textContent='Aquí sigo. Háblame cuando quieras.';continue}
estado.textContent='Pensando…';modo='piensa';let r
try{const res=await fetch('/oir',{method:'POST',headers:{'content-type':audio.type},body:audio});r=await res.json()}catch{r={error:'No pude hablar con el cerebro.'}}
if(r.vacio){continue}if(r.error){estado.textContent=r.error;await dormir(2500);continue}
if(r.audio){estado.textContent='Ultron está hablando…';await tocar(r.audio)}else{estado.textContent='No me salió la voz. Intenta otra vez.';await dormir(2000)}}}
function tocar(b64){return new Promise(res=>{sonando=new Audio('data:audio/mpeg;base64,'+b64);const src=ctx.createMediaElementSource(sonando),an=ctx.createAnalyser();an.fftSize=512;src.connect(an);an.connect(ctx.destination)
const d=new Uint8Array(an.fftSize);let vivo=true;(function late(){if(!vivo)return;an.getByteTimeDomainData(d);let s=0;for(const v of d){const x=(v-128)/128;s+=x*x}meta=Math.min(1,Math.sqrt(s/d.length)*5);requestAnimationFrame(late)})()
const fin=()=>{vivo=false;meta=0;sonando=null;res()};sonando.onended=fin;sonando.onerror=fin;sonando.play().catch(fin)})}
boton.onclick=async()=>{if(activo){activo=false;boton.textContent='Hablar';boton.classList.remove('fin');estado.textContent='Toca para hablar con Ultron';sonando?.pause();grabadora?.state==='recording'&&grabadora.stop();return}
try{if(!flujo)await abrir();await ctx.resume()}catch{estado.textContent='Necesito permiso para el micrófono.';return}
activo=true;boton.textContent='Terminar';boton.classList.add('fin');conversar()}
</script></body></html>`
