// Pantalla del checador: la computadora del restaurante.
import { crearCliente, configurado } from './supabase.js';
import { NEGOCIO, LEMA } from './config.js';
import { fechaLarga, fechaLocal, hora12 } from './tiempo.js';

const CLAVE_TOKEN = 'aurelius.checador.token';
const LARGO_MAX_PIN = 6;
const LARGO_MIN_PIN = 4;
const SEGUNDOS_RESULTADO = 5;

const $ = (id) => document.getElementById(id);
const pantallas = ['pantalla-cargando', 'pantalla-sin-config', 'pantalla-activar', 'pantalla-checar', 'panel-checar'];

let supabase = null;
let pin = '';
let ocupado = false;
let desfaseReloj = 0; // ms que la hora del servidor va adelante de esta computadora
let camaraLista = false;

$('negocio').textContent = NEGOCIO.toUpperCase();
$('lema').textContent = LEMA;

function mostrar(...ids) {
  for (const id of pantallas) $(id).hidden = !ids.includes(id);
}

function leerToken() {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
}
function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch { /* sin almacenamiento: habrá que volver a activar */ }
}

// ---------- Reloj con la hora del servidor (no la de esta computadora) ----------
function ahora() { return new Date(Date.now() + desfaseReloj); }

async function sincronizarReloj() {
  try {
    const antes = Date.now();
    const { data, error } = await supabase.rpc('hora_servidor');
    if (error) return;
    const despues = Date.now();
    desfaseReloj = new Date(data).getTime() - (antes + despues) / 2;
  } catch { /* se queda con el último desfase */ }
}

function pintarReloj() {
  const t = ahora();
  $('hora').textContent = hora12(t);
  $('fecha').textContent = fechaLarga(fechaLocal(t));
}

// ---------- Cámara ----------
async function iniciarCamara() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $('camara-estado').textContent = 'Sin cámara';
    return;
  }
  try {
    const flujo = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
    });
    const video = $('video');
    video.srcObject = flujo;
    await video.play().catch(() => {});
    camaraLista = true;
    $('camara-estado').textContent = 'Mira a la cámara al checar';
  } catch {
    $('camara-estado').textContent = 'Cámara no disponible';
  }
}

function tomarFoto() {
  const video = $('video');
  if (!camaraLista || !video.videoWidth) return null;
  // Recorte vertical 3:4 del centro, 300 x 400 px.
  const alto = video.videoHeight;
  const ancho = Math.min(video.videoWidth, Math.round(alto * 3 / 4));
  const x = Math.round((video.videoWidth - ancho) / 2);
  const lienzo = $('lienzo');
  lienzo.width = 300;
  lienzo.height = 400;
  lienzo.getContext('2d').drawImage(video, x, 0, ancho, alto, 0, 0, 300, 400);
  return lienzo.toDataURL('image/jpeg', 0.7);
}

// ---------- Código (PIN) ----------
function pintarPin() {
  const puntos = $('puntos');
  puntos.replaceChildren(...Array.from({ length: Math.max(LARGO_MIN_PIN, pin.length) }, (_, i) => {
    const s = document.createElement('span');
    if (i < pin.length) s.className = 'lleno';
    return s;
  }));
}

function tecla(valor) {
  if (ocupado) return;
  $('mensaje').textContent = '';
  if (valor === 'borrar') pin = pin.slice(0, -1);
  else if (valor === 'limpiar') pin = '';
  else if (/^\d$/.test(valor) && pin.length < LARGO_MAX_PIN) pin += valor;
  pintarPin();
}

const ERRORES = {
  PIN_INCORRECTO: 'Código incorrecto. Intenta de nuevo.',
  BLOQUEADO: 'Demasiados intentos equivocados. Espera 5 minutos.',
  TIPO_INVALIDO: 'Algo salió mal. Intenta de nuevo.',
};

async function checar(tipo) {
  if (ocupado) return;
  if (pin.length < LARGO_MIN_PIN) {
    $('mensaje').textContent = 'Escribe tu código completo.';
    return;
  }
  ocupado = true;
  $('btn-entrada').disabled = $('btn-salida').disabled = true;
  $('mensaje').textContent = 'Registrando…';
  const foto = tomarFoto();
  try {
    const { data, error } = await supabase.rpc('checar', {
      p_token: leerToken(), p_pin: pin, p_tipo: tipo, p_foto: foto,
    });
    if (error) throw error;
    if (!data.ok) {
      if (data.error === 'DISPOSITIVO_NO_AUTORIZADO') {
        guardarToken(null);
        mostrarActivacion('Esta computadora ya no está autorizada. Pide un código nuevo.');
        return;
      }
      $('mensaje').textContent = ERRORES[data.error] ?? 'No se pudo registrar.';
      pin = '';
      pintarPin();
      return;
    }
    mostrarResultado(data, foto);
  } catch {
    $('mensaje').textContent = 'Sin conexión a internet. Intenta de nuevo; si sigue fallando, avisa al encargado.';
  } finally {
    ocupado = false;
    $('btn-entrada').disabled = $('btn-salida').disabled = false;
    if ($('mensaje').textContent === 'Registrando…') $('mensaje').textContent = '';
  }
}

let temporizador = null;
function mostrarResultado(data, foto) {
  const nombre = data.nombre.split(' ')[0];
  const hora = hora12(new Date(data.ts));
  const r = $('resultado');
  r.className = `k-resultado ${data.tipo}`;
  if (data.duplicado) {
    $('res-titulo').textContent = `Listo, ${nombre}`;
    $('res-hora').textContent = `Tu ${data.tipo} ya estaba registrada a las ${hora}`;
  } else if (data.tipo === 'entrada') {
    $('res-titulo').textContent = `¡Buen turno, ${nombre}!`;
    $('res-hora').textContent = `Entrada registrada · ${hora}`;
  } else {
    $('res-titulo').textContent = `¡Gracias, ${nombre}!`;
    $('res-hora').textContent = `Salida registrada · ${hora}`;
  }
  $('res-aviso').hidden = !data.aviso;
  $('res-aviso').textContent = data.aviso ?? '';
  $('res-foto').hidden = !foto;
  if (foto) $('res-foto').src = foto;
  r.hidden = false;
  pin = '';
  pintarPin();
  clearTimeout(temporizador);
  temporizador = setTimeout(cerrarResultado, (data.aviso ? 2 : 1) * SEGUNDOS_RESULTADO * 1000);
}

function cerrarResultado() {
  clearTimeout(temporizador);
  $('resultado').hidden = true;
}

// ---------- Activación de la computadora ----------
function mostrarActivacion(mensaje = '') {
  mostrar('pantalla-activar');
  $('mensaje-activar').textContent = mensaje;
  $('codigo-activacion').focus();
}

$('pantalla-activar').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('mensaje-activar').textContent = 'Verificando…';
  try {
    const { data, error } = await supabase.rpc('activar_dispositivo', { p_codigo: $('codigo-activacion').value });
    if (error) throw error;
    if (!data.ok) {
      $('mensaje-activar').textContent = 'Código inválido o vencido. Genera uno nuevo en la consola.';
      return;
    }
    guardarToken(data.token);
    $('codigo-activacion').value = '';
    iniciarChecador();
  } catch {
    $('mensaje-activar').textContent = 'Sin conexión a internet. Intenta de nuevo.';
  }
});

// ---------- Arranque ----------
let checadorIniciado = false;
function iniciarChecador() {
  mostrar('pantalla-checar', 'panel-checar');
  pintarPin();
  if (checadorIniciado) return;
  checadorIniciado = true;
  pintarReloj();
  setInterval(pintarReloj, 1000);
  sincronizarReloj();
  setInterval(sincronizarReloj, 10 * 60 * 1000);
  iniciarCamara();
}

document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-tecla]');
  if (boton) tecla(boton.dataset.tecla);
});
$('btn-entrada').addEventListener('click', () => checar('entrada'));
$('btn-salida').addEventListener('click', () => checar('salida'));
$('resultado').addEventListener('click', cerrarResultado);

document.addEventListener('keydown', (e) => {
  if ($('panel-checar').hidden) return;
  if (!$('resultado').hidden) { cerrarResultado(); return; }
  if (/^\d$/.test(e.key)) tecla(e.key);
  else if (e.key === 'Backspace') tecla('borrar');
  else if (e.key === 'Escape') tecla('limpiar');
  else if (e.key.toLowerCase() === 'e') checar('entrada');
  else if (e.key.toLowerCase() === 's') checar('salida');
});

async function arrancar() {
  if (!configurado) { mostrar('pantalla-sin-config'); return; }
  supabase = crearCliente({ auth: { persistSession: false, autoRefreshToken: false } });
  const token = leerToken();
  if (!token) { mostrarActivacion(); return; }
  try {
    const { data, error } = await supabase.rpc('estado_dispositivo', { p_token: token });
    if (error) throw error;
    if (!data.autorizado) {
      guardarToken(null);
      mostrarActivacion('Esta computadora ya no está autorizada. Pide un código nuevo.');
      return;
    }
  } catch {
    // Sin internet al abrir: se muestra el checador y avisará al intentar checar.
  }
  iniciarChecador();
}

arrancar();
