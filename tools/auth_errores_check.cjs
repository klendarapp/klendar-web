// Los errores de la contraseña (assets/auth-errors.js), sin navegador:
//   node tools/auth_errores_check.cjs assets/auth-errors.js
// Mismos casos que test/auth_form_message_test.dart de la app (2-11-2026).
global.window = global;
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
require('vm').runInThisContext(require('fs').readFileSync(process.argv[2], 'utf8'));
const E = (o) => Object.assign(new Error(o.message || 'x'), o);
const t = [
  [E({ code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.', reasons: ['pwned'] }), 'filtraciones'],
  [E({ code: 'weak_password', message: 'x', reasons: ['length'] }), 'al menos 8 caracteres.'],
  [E({ code: 'weak_password', message: 'x', reasons: ['characters'] }), 'al menos 8 caracteres.'],
  [E({ message: 'Password is known to be weak and easy to guess' }), 'filtraciones'],
  [E({ code: 'same_password', message: 'New password should be different from the old password.' }), 'distinta'],
  [E({ message: 'New password should be different from the old password.' }), 'distinta'],
  [E({ message: 'Password should be at least 8 characters.' }), 'al menos 8 caracteres.'],
];
let ok = true;
for (const [e, want] of t) { const r = KL_AUTH_ERROR(e, 'es'); const p = r.includes(want); ok = ok && p; console.log(p ? 'ok' : 'FALLO', r); }
console.log(KL_AUTH_ERROR(t[0][0], 'en'));
process.exit(ok ? 0 : 1);
