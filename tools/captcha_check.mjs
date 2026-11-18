// La comprobación anti-robots de la web (KL_CAPTCHA, assets/auth-errors.js)
// con un Turnstile simulado y relojes falsos: un reintento solo antes del
// error, token siempre fresco y sin tope con el recuadro a la vista.
//   node tools/captcha_check.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2] || 'assets/auth-errors.js', 'utf8');
const trozo = src.slice(src.indexOf('/* La comprobación anti-robots'));
function monta() {
  const w = { KLENDAR_ENV: { turnstile: 'k' } };
  let opts = null; const resets = []; const quitados = [];
  w.turnstile = { render: (_c, o) => { opts = o; return 1; }, reset: () => resets.push(Date.now()), remove: (id) => quitados.push(id) };
  // Lo justo del DOM: un hueco del formulario (`.kl-captcha-sitio`) a la vista.
  const el = (conectado) => ({
    style: {}, hijos: [], parentNode: null, _c: conectado, classList: { contains: () => false },
    get isConnected() { return this._c || !!(this.parentNode && this.parentNode.isConnected); },
    getClientRects() { return this.isConnected ? [1] : []; },
    appendChild(h) { h.parentNode = this; this.hijos.push(h); },
    removeChild(h) { h.parentNode = null; this.hijos = this.hijos.filter((x) => x !== h); },
    setAttribute() {}, removeAttribute() {}, addEventListener() {},
  });
  const body = el(true);
  const sitio = el(true);
  sitio.nodeType = 1;
  const document = {
    createElement: () => el(false), body, head: body, documentElement: { lang: 'es', getAttribute: () => null },
    querySelectorAll: (q) => (q === '.kl-captcha-sitio' && sitio._c ? [sitio] : []), querySelector: () => null,
  };
  new Function('window', 'document', trozo)(w, document);
  return { w, o: () => opts, resets, quitados, sitio };
}
const tick = async (ms) => { mock.timers.tick(ms); for (let i = 0; i < 5; i++) await Promise.resolve(); };
test('error: un reintento solo y luego el error', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o, resets } = monta();
  w.KL_CAPTCHA.pre(); await tick(0);
  const p = w.KL_CAPTCHA(); let r = null; p.then(t => r = ['ok', t], e => r = ['mal', e.code]);
  await tick(0);
  o()['error-callback']('300030'); await tick(1);
  assert.equal(resets.length, 1); assert.equal(r, null);
  o()['error-callback']('300030'); await tick(1);
  assert.deepEqual(r, ['mal', 'captcha_failed']);
  mock.timers.reset();
});
test('sin respuesta: un reintento a los 20 s y error a los 40 s', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, resets } = monta();
  const p = w.KL_CAPTCHA(); let r = null; p.then(t => r = ['ok', t], e => r = ['mal', e.code]);
  await tick(0);
  await tick(20000); assert.equal(resets.length, 1); assert.equal(r, null);
  await tick(20000); assert.deepEqual(r, ['mal', 'captcha_failed']);
  mock.timers.reset();
});
test('token sin gastar: se renueva a los 270 s; uno fresco se usa al momento', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o, resets } = monta();
  w.KL_CAPTCHA.pre(); await tick(0);
  o().callback('T1'); await tick(269000); assert.equal(resets.length, 0);
  await tick(1000); assert.equal(resets.length, 1);
  o().callback('T2');
  assert.equal(await w.KL_CAPTCHA(), 'T2');
  mock.timers.reset();
});
test('con el recuadro a la vista espera lo que haga falta', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o } = monta();
  w.KL_CAPTCHA.pre(); await tick(0);
  o()['before-interactive-callback']();
  const p = w.KL_CAPTCHA(); let r = null; p.then(t => r = ['ok', t], e => r = ['mal', e.code]);
  await tick(0); await tick(120000); assert.equal(r, null);
  o()['after-interactive-callback'](); o().callback('T9'); await tick(0);
  assert.deepEqual(r, ['ok', 'T9']);
  mock.timers.reset();
});
test('quita: fuera el widget y quien esperaba falla; luego se prepara otra vez', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o, quitados, sitio } = monta();
  w.KL_CAPTCHA.pre(); await tick(0);
  assert.equal(sitio.hijos.length, 1);
  o()['before-interactive-callback']();
  const p = w.KL_CAPTCHA(); let r = null; p.then(t => r = ['ok', t], e => r = ['mal', e.code]);
  await tick(0);
  w.KL_CAPTCHA.quita(); await tick(0);
  assert.deepEqual(quitados, [1]); assert.equal(sitio.hijos.length, 0);
  assert.deepEqual(r, ['mal', 'captcha_failed']);
  w.KL_CAPTCHA.pre(); await tick(0);
  assert.equal(sitio.hijos.length, 1);
  mock.timers.reset();
});
test('por adelantado sin hueco a la vista no pinta nada; al pulsar, último recurso', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o, sitio } = monta();
  sitio._c = false;
  w.KL_CAPTCHA.pre(); await tick(0);
  assert.equal(o(), null);
  const p = w.KL_CAPTCHA(); await tick(0);
  assert.ok(o());
  o().callback('T5');
  assert.equal(await p, 'T5');
  mock.timers.reset();
});
test('un token fresco vale aunque su hueco ya no se vea (diálogo cerrado)', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { w, o, sitio } = monta();
  w.KL_CAPTCHA.pre(); await tick(0);
  const primero = o();
  primero.callback('T7');
  sitio._c = false;
  assert.equal(await w.KL_CAPTCHA(), 'T7');
  assert.equal(o(), primero);
  mock.timers.reset();
});
