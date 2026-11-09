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
  let opts = null; const resets = [];
  w.turnstile = { render: (_c, o) => { opts = o; return 1; }, reset: () => resets.push(Date.now()), remove() {} };
  const body = { appendChild() {} };
  const document = { createElement: () => ({ style: {}, isConnected: true }), body, head: body, documentElement: { lang: 'es' } };
  new Function('window', 'document', trozo)(w, document);
  return { w, o: () => opts, resets };
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
