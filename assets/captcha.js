// La comprobación anti-robots de la app (captcha.html): lo que hace la página
// con Turnstile y el canal `KlendarCaptcha`. Antes, en línea; la CSP de scripts
// no lo deja (RUNBOOK §4zzz-csp). Sin `defer`: tiene que estar `alCargar`
// antes de que llegue el script de Turnstile (`onload=alCargar`).
(function () {
  var q = new URLSearchParams(location.search);
  var pre = q.get('pre') === '1';
  var canal = window.KlendarCaptcha;
  var id = null;
  function manda(m) { if (canal && canal.postMessage) canal.postMessage(m); }
  window.alCargar = function () {
    if (!q.get('k')) { manda('error:sin_clave'); return; }
    var opciones = {
      sitekey: q.get('k'),
      language: q.get('hl') || 'es',
      theme: q.get('tema') === 'dark' ? 'dark' : 'light',
      appearance: 'interaction-only',
      callback: function (token) { manda('ok:' + token); },
      'error-callback': function (code) { manda('error:' + code); return true; },
      'expired-callback': function () { manda(pre ? 'expired' : 'error:expired'); },
      'unsupported-callback': function () { manda('error:unsupported'); },
    };
    if (pre) {
      opciones['refresh-expired'] = 'auto';
      opciones['before-interactive-callback'] = function () { manda('interactive'); };
    }
    id = window.turnstile.render('#caja', opciones);
  };
  /** El siguiente token, en la misma página (la app, tras gastar uno). */
  window.klOtro = function () {
    if (id !== null && window.turnstile) window.turnstile.reset(id);
  };
})();
