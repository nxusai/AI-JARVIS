// El oído de Ultron: micrófono siempre abierto, como el de Nexy.
//
// No usa el reconocimiento de voz del navegador (se queda sordo solo, sin
// avisar). Mide la energía del micrófono: cuando sube sobre el ruido del
// cuarto empieza a grabar; cuando hay silencio, entrega esa frase como un
// archivo de audio para que la transcriba Scribe (ElevenLabs). Así detecta al
// instante que alguien habla (para interrumpir a Ultron) y las palabras llegan
// un momento después, de un transcriptor que no falla en silencio.
//
// Mientras Ultron habla, sube la barra para no oírse a sí mismo por las
// bocinas (además de la cancelación de eco del navegador).

const SOBRE_PISO = 2.6 // cuánto sobre el ruido del cuarto cuenta como voz
const GUARDIA = 2.4 // mientras Ultron habla, se exige esto más
const SOLTAR = 0.6 // bajar a umbral×esto termina la frase (histéresis)
const INICIO_MS = 110 // tanto sonido seguido confirma que es voz y no un golpe
const SILENCIO_MS = 700 // tanto silencio termina la frase
const MAX_MS = 20000 // nadie habla una frase más larga
const PISO_SUBE = 0.0008
const PISO_BAJA = 0.02

function formato() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

/**
 * Abre el micrófono y escucha. `al` = { empieza(), termina(blob, ms), nivel(0..1), error(msg) }.
 * Regresa { parar(), guardia(bool), vivo() }.
 */
export async function abrirOido(al) {
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch (err) {
    al.error(err?.name === 'NotAllowedError' ? 'No me diste permiso de usar el micrófono.' : 'No encuentro un micrófono.')
    return { parar() {}, guardia() {}, vivo: () => false, dormido: () => false, despertar: async () => {} }
  }
  if (typeof MediaRecorder === 'undefined') {
    al.error('Este navegador no puede grabar audio.')
    stream.getTracks().forEach((t) => t.stop())
    return { parar() {}, guardia() {}, vivo: () => false, dormido: () => false, despertar: async () => {} }
  }
  const mime = formato()
  const ctx = new AudioContext()
  void ctx.resume()
  const fuente = ctx.createMediaStreamSource(stream)
  const analizador = ctx.createAnalyser()
  analizador.fftSize = 1024
  analizador.smoothingTimeConstant = 0.35
  fuente.connect(analizador)
  const buf = new Float32Array(analizador.fftSize)

  let parado = false
  let enGuardia = false
  let piso = 0.01
  let suave = 0
  let grabadora = null
  let partes = []
  let armado = 0
  let hablando = false
  let desde = 0
  let ultimoSonido = 0

  const energia = () => {
    analizador.getFloatTimeDomainData(buf)
    let s = 0
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
    return Math.sqrt(s / buf.length)
  }
  const grabar = () => {
    partes = []
    try {
      grabadora = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    } catch {
      grabadora = new MediaRecorder(stream)
    }
    grabadora.ondataavailable = (e) => e.data?.size && partes.push(e.data)
    grabadora.start()
  }
  const tirar = () => {
    if (!grabadora) return
    try {
      grabadora.ondataavailable = null
      if (grabadora.state !== 'inactive') grabadora.stop()
    } catch {
      // ya no estaba
    }
    grabadora = null
    partes = []
  }
  const cerrarFrase = () => {
    const g = grabadora
    const inicio = desde
    hablando = false
    desde = 0
    grabadora = null
    if (!g) return
    const listo = () => {
      const blob = new Blob(partes, { type: g.mimeType || mime || 'audio/webm' })
      partes = []
      al.termina(blob, inicio ? performance.now() - inicio : 0)
    }
    g.onstop = listo
    try {
      if (g.state !== 'inactive') g.stop()
      else listo()
    } catch {
      listo()
    }
  }

  // Con un intervalo (no requestAnimationFrame) sigue oyendo aunque la pestaña no se vea.
  const reloj = setInterval(() => {
    if (parado) return
    const e = energia()
    suave += (e - suave) * 0.5
    al.nivel(Math.min(1, suave * 12))
    if (!hablando && armado === 0) {
      piso += (suave - piso) * (suave > piso ? PISO_SUBE : PISO_BAJA)
      piso = Math.max(piso, 0.0015)
    }
    const umbral = piso * SOBRE_PISO * (enGuardia ? GUARDIA : 1)
    const ahora = performance.now()
    if (!hablando) {
      if (suave > umbral) {
        if (armado === 0) {
          // Empieza a grabar desde el primer sonido; si era un golpe, se tira.
          armado = ahora
          grabar()
        } else if (ahora - armado >= INICIO_MS) {
          hablando = true
          desde = armado
          ultimoSonido = ahora
          al.empieza()
        }
      } else if (armado !== 0) {
        armado = 0
        tirar()
      }
    } else {
      if (suave > umbral * SOLTAR) ultimoSonido = ahora
      if (ahora - ultimoSonido >= SILENCIO_MS || ahora - desde >= MAX_MS) {
        armado = 0
        cerrarFrase()
      }
    }
  }, 30)

  return {
    parar() {
      parado = true
      clearInterval(reloj)
      tirar()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
    guardia(si) {
      enGuardia = Boolean(si)
    },
    vivo: () => !parado,
    // El navegador no deja oír hasta que tocan la página una vez.
    dormido: () => ctx.state !== 'running',
    despertar: () => ctx.resume(),
  }
}
