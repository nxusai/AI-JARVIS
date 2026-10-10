// Recorrido completo de las dos pantallas en Chromium con un Supabase falso.
// Uso: node tests/ui/recorrido.mjs   (necesita Playwright instalado)
import { execSync, spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const SALIDA = process.env.CAPTURAS ?? path.join(AQUI, 'capturas');
mkdirSync(SALIDA, { recursive: true });

let playwright;
try { playwright = await import('playwright'); } catch {
  playwright = await import(path.join(execSync('npm root -g').toString().trim(), 'playwright/index.mjs'));
}
const { chromium } = playwright;

const PUERTO = 8765;
const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const URL_BASE = `http://127.0.0.1:${PUERTO}`;

const navegador = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const errores = [];

async function preparar(contexto) {
  await contexto.route('**/@supabase/supabase-js@*/+esm', (r) => r.fulfill({
    contentType: 'application/javascript', body: readFileSync(path.join(AQUI, 'supabase-falso.js'), 'utf8'),
  }));
  await contexto.route('**/js/config.js', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: "export const SUPABASE_URL='https://falso.supabase.co';export const SUPABASE_ANON_KEY='falsa';export const NEGOCIO='Aurelius';export const LEMA='Conquistando el come todo';",
  }));
  await contexto.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}
function vigilar(pagina, nombre) {
  pagina.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errores.push(`${nombre}: ${m.text()}`); });
}
const toast = (p) => p.locator('.toast').last();

try {
  // ================= CONSOLA =================
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await preparar(ctx);
  const p = await ctx.newPage();
  vigilar(p, 'consola');
  p.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Caja del restaurante') : d.accept()));

  await p.goto(`${URL_BASE}/admin.html`);
  await p.fill('#acceso-correo', 'duena@aurelius.mx');
  await p.fill('#acceso-clave', 'mala');
  await p.click('#form-acceso button');
  await p.getByText('Correo o contraseña incorrectos').waitFor();
  await p.fill('#acceso-clave', 'secreto');
  await p.click('#form-acceso button');
  await p.locator('.tarjetas-hoy').waitFor();
  assert.equal(await p.locator('.t-emp').count(), 3);
  await p.screenshot({ path: `${SALIDA}/1-hoy.png`, fullPage: true });

  // Calendario
  await p.click('#pestanas [data-vista=calendario]');
  await p.locator('.matriz').waitFor();
  await p.screenshot({ path: `${SALIDA}/2-calendario-todos.png`, fullPage: true });
  await p.selectOption('[data-cambio=cal-empleado]', 'e2');
  await p.locator('.cal').waitFor();
  await p.screenshot({ path: `${SALIDA}/3-calendario-ana.png`, fullPage: true });

  // Autorizar horas extra de un día
  const conExtra = p.locator('.cal-dia', { hasText: '?' }).first();
  await conExtra.click();
  await p.locator('#modal form[data-form=extra]').waitFor();
  await p.screenshot({ path: `${SALIDA}/4-dia-extra.png` });
  await p.click('#modal form[data-form=extra] button.btn-primario');
  await toast(p).filter({ hasText: 'Se pagarán' }).waitFor();
  await p.locator('#modal .estado', { hasText: 'Se pagan' }).waitFor();
  await p.click('#modal [data-cerrar]');

  // Nómina: corregir un día sin salida desde el aviso
  await p.click('#pestanas [data-vista=nomina]');
  await p.locator('.total-pagar').first().waitFor();
  await p.screenshot({ path: `${SALIDA}/5-nomina.png`, fullPage: true });
  const chip = p.locator('.pendiente-chip', { hasText: 'sin salida' }).first();
  if (await chip.count()) {
    await chip.click();
    await p.locator('#modal details summary').click();
    await p.click('#modal form[data-form=nuevo-registro] button');
    await toast(p).filter({ hasText: 'Registro agregado' }).waitFor();
    await p.click('#modal [data-cerrar]');
  }
  // Ver detalle y descargar Excel
  await p.locator('tr[data-accion=detalle]').first().click();
  await p.locator('.detalle-fila:not(.oculto)').first().waitFor();
  const [descarga] = await Promise.all([p.waitForEvent('download'), p.click('[data-accion=exportar]')]);
  const csv = readFileSync(await descarga.path(), 'utf8');
  assert.match(csv, /Total a pagar/);
  assert.match(csv, /Juan Pérez/);
  assert.match(descarga.suggestedFilename(), /^nomina-aurelius-.*\.csv$/);

  // Empleados: nuevo, con código repetido primero
  await p.click('#pestanas [data-vista=empleados]');
  await p.click('[data-accion=nuevo-empleado]');
  await p.fill('#form-empleado [name=nombre]', 'María Gómez');
  await p.fill('#form-empleado [name=puesto]', 'Hostess');
  await p.fill('#form-empleado [name=sueldo]', '4000');
  await p.fill('#form-empleado [name=pin]', '1234');
  for (const d of [1, 2, 3, 4, 5]) await p.check(`#form-empleado [name=trabaja-${d}]`);
  await p.fill('#form-empleado [name=entrada-1]', '12:00');
  await p.fill('#form-empleado [name=salida-1]', '20:00');
  await p.click('[data-accion=copiar-horario]');
  assert.equal(await p.inputValue('#form-empleado [name=salida-5]'), '20:00');
  await p.screenshot({ path: `${SALIDA}/6-empleado-nuevo.png` });
  await p.click('#modal .modal-pie .btn-primario');
  await toast(p).filter({ hasText: 'ya lo usa otro' }).waitFor();
  await p.fill('#form-empleado [name=pin]', '2468');
  await p.click('#modal .modal-pie .btn-primario');
  await toast(p).filter({ hasText: 'Empleado guardado' }).waitFor();
  await p.locator('td', { hasText: 'María Gómez' }).waitFor();
  const db = await p.evaluate(() => window.__db);
  assert.equal(db.empleados.filter((e) => e.nombre === 'María Gómez').length, 1, 'no debe duplicar al reintentar');
  assert.equal(db.horarios.filter((h) => h.empleado_id === db.empleados.find((e) => e.nombre === 'María Gómez').id).length, 5);

  // Cambio de horario por rango (vacaciones)
  await p.click('#pestanas [data-vista=calendario]');
  await p.click('[data-accion=abrir-rango]');
  await p.selectOption('#form-rango [name=tipo]', 'permiso');
  assert.equal(await p.locator('#form-rango [name=entrada]').isDisabled(), true);
  await p.fill('#form-rango [name=nota]', 'Vacaciones');
  await p.click('#modal .modal-pie .btn-primario');
  await toast(p).filter({ hasText: 'días actualizados' }).waitFor();
  assert.equal((await p.evaluate(() => window.__db.cambios_dia.filter((c) => c.tipo === 'permiso').length)), 7);

  // Ajustes: código de activación
  await p.click('#pestanas [data-vista=ajustes]');
  await p.click('[data-accion=nuevo-codigo]');
  await p.locator('.codigo-grande', { hasText: 'ABCD2345' }).waitFor();
  await p.screenshot({ path: `${SALIDA}/7-ajustes-codigo.png` });
  await p.click('#modal .modal-pie [data-cerrar]');
  await p.locator('td', { hasText: 'Agregó' }).first().waitFor();

  // Cerrar la quincena
  await p.click('#pestanas [data-vista=nomina]');
  await p.click('[data-accion=cerrar-quincena]');
  await p.getByText('Quincena cerrada el').waitFor();

  // Vista de celular
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click('#pestanas [data-vista=hoy]');
  await p.locator('.tarjetas-hoy').waitFor();
  await p.screenshot({ path: `${SALIDA}/8-celular-hoy.png`, fullPage: true });
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(ancho <= 390, `la consola se desborda en celular (${ancho}px)`);

  // ================= CHECADOR =================
  const ck = await navegador.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
  await preparar(ck);
  const k = await ck.newPage();
  vigilar(k, 'checador');
  await k.goto(`${URL_BASE}/checador.html`);
  await k.locator('#pantalla-activar').waitFor();
  await k.fill('#codigo-activacion', 'malo');
  await k.click('#pantalla-activar button');
  await k.getByText('Código inválido').waitFor();
  await k.fill('#codigo-activacion', 'abcd2345');
  await k.click('#pantalla-activar button');
  await k.locator('#panel-checar').waitFor();
  await k.getByText('Mira a la cámara').waitFor();
  await k.screenshot({ path: `${SALIDA}/9-checador.png` });
  // Debe caber completo en pantallas de laptop comunes, sin hacer scroll.
  for (const [w, h] of [[1366, 768], [1280, 720], [1024, 768]]) {
    await k.setViewportSize({ width: w, height: h });
    const abajo = await k.evaluate(() => document.querySelector('#panel-checar').getBoundingClientRect().bottom);
    assert.ok(abajo <= h, `el checador no cabe en ${w}x${h} (termina en ${abajo}px)`);
  }
  await k.screenshot({ path: `${SALIDA}/9b-checador-1024x768.png` });
  await k.setViewportSize({ width: 1366, height: 768 });

  for (const t of '9999') await k.click(`[data-tecla="${t}"]`);
  await k.click('#btn-entrada');
  await k.getByText('Código incorrecto').waitFor();

  await k.keyboard.type('5678');
  await k.click('#btn-salida');
  await k.locator('#resultado:not([hidden])').waitFor();
  assert.match(await k.textContent('#res-titulo'), /Gracias, Ana/);
  assert.equal(await k.evaluate(() => window.__fotoRecibida), true, 'debe mandar la foto');
  await k.screenshot({ path: `${SALIDA}/10-checador-resultado.png` });

  // Al recargar sigue autorizada
  await k.reload();
  await k.locator('#panel-checar').waitFor();

  assert.deepEqual(errores, [], `errores en consola:\n${errores.join('\n')}`);
  console.log('Recorrido de pantallas: OK');
} finally {
  await navegador.close();
  servidor.kill();
}
