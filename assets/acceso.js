/* Klendar — cómo se abre la sesión en la web («Tu cuenta», panel y admin).
 *
 * 1. PKCE. Los clientes de Supabase de la web usan `flowType: 'pkce'`, como
 *    la app: al volver de Google o Apple la dirección trae `?code=…`, que
 *    solo sirve junto con un secreto que se quedó en ESTE navegador
 *    (`sb-…-auth-token-code-verifier`) y supabase-js canjea al arrancar. Así
 *    los tokens nunca pasan por la dirección (ni por el historial, ni por un
 *    contador de visitas), y un enlace con los tokens de otra persona
 *    (`#access_token=…`) ya no abre su sesión en tu navegador.
 *
 * 2. Enlaces de los correos. `send-auth-email` escribe los enlaces de la web
 *    como la dirección de vuelta + `?token_hash=…&type=…`. Aquí se canjean
 *    con `verifyOtp({ token_hash, type })`: funciona en cualquier navegador
 *    (el correo abierto en el móvil y la cuenta empezada en el ordenador) y
 *    un antivirus que «abre» el enlace para mirarlo no lo gasta, porque solo
 *    se gasta al ejecutar esta página. Los de la app siguen yendo por
 *    Supabase (`/auth/v1/verify` → app.klendar://auth-callback?code=…).
 *
 * Lo que traiga la dirección (token_hash, errores, tokens de un enlace
 * antiguo) se quita nada más cargar, antes que nada más lo lea o lo apunte.
 *
 * Uso:
 *   const sb = KL_SUPABASE();                  // cliente con PKCE
 *   const r = await KL_ENLACE(sb);             // { tipo, sesion, error } (una vez por página)
 *   KL_ENLACE.aviso(lang)                      // el aviso pendiente (y se gasta), o ''
 */
(function () {
  'use strict';
  var TIPOS = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];
  var AVISO = 'klendar.acceso.aviso';
  var TEXTOS = {
    es: {
      enlace: 'Ese enlace ya no vale: caduca en 1 hora y solo se puede usar una vez. Pide otro.',
      otroNavegador: 'No hemos podido terminar de entrar. Vuelve a intentarlo desde este navegador.',
      acceso: 'No hemos podido completar el acceso. Vuelve a intentarlo.',
    },
    en: {
      enlace: "That link doesn't work any more: it expires after 1 hour and can only be used once. Ask for a new one.",
      otroNavegador: "We couldn't finish logging you in. Please try again from this browser.",
      acceso: "We couldn't complete the login. Please try again.",
    },
  };

  var url = new URL(location.href);
  var q = url.searchParams;
  var enlace = null;
  var fallo = null;
  var cambia = false;

  if (q.has('token_hash')) {
    enlace = { token_hash: q.get('token_hash') || '', type: q.get('type') || '' };
    q.delete('token_hash');
    q.delete('type');
    cambia = true;
  }
  // Errores de Supabase al volver (Google cancelado, enlace caducado…).
  ['error', 'error_code', 'error_description'].forEach(function (k) {
    if (q.has(k)) { fallo = fallo || q.get('error_code') || q.get('error') || 'acceso'; q.delete(k); cambia = true; }
  });
  // En el `#`: las rutas son `#/…`; lo demás que traiga `=` es de Supabase
  // (tokens de un enlace de antes de PKCE, o `#error=…`): fuera, sin usarlo.
  var hash = url.hash;
  if (hash && hash.charAt(1) !== '/' && /(^#|&)(access_token|refresh_token|error|error_code|error_description)=/.test(hash)) {
    var hq = new URLSearchParams(hash.slice(1));
    fallo = fallo || hq.get('error_code') || hq.get('error') || 'otp_expired';
    hash = '';
    cambia = true;
  }
  if (cambia) {
    var qs = q.toString();
    history.replaceState(history.state, '', url.pathname + (qs ? '?' + qs : '') + hash);
  }

  function guardaAviso(clave) {
    try { sessionStorage.setItem(AVISO, clave); } catch (e) { /* sin almacenamiento */ }
  }
  function claveDe(error) {
    var c = String((error && (error.code || error.message)) || error || '');
    if (/otp_expired|expired|invalid|not.?found|flow_state|bad_code_verifier/i.test(c)) return 'enlace';
    if (c === 'otro_navegador') return 'otroNavegador';
    return 'acceso';
  }

  /** Borra los verificadores PKCE que se hayan quedado (`<clave>-…code-verifier`).
   * supabase-js los guarda al pedir un código o un enlace y solo los gasta si
   * la vuelta trae `?code=`; con los enlaces de `token_hash` o el código de 6
   * cifras se quedarían para siempre. La política de cookies dice «hasta
   * terminar de entrar o cerrar sesión». */
  function olvidaVerificadores(clave) {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(clave + '-') === 0 && /code-verifier$/.test(k)) localStorage.removeItem(k);
      }
    } catch (e) { /* sin almacenamiento */ }
  }
  window.KL_OLVIDA_VERIFICADORES = olvidaVerificadores;

  window.KL_SUPABASE = function (auth) {
    var env = window.KLENDAR_ENV || {};
    var opciones = Object.assign({ flowType: 'pkce' }, auth || {});
    var sb = window.supabase.createClient(env.url, env.key, { auth: opciones });
    var ref = (String(env.url || '').match(/^https:\/\/([a-z0-9]+)\./) || [])[1] || '';
    var clave = opciones.storageKey || 'sb-' + ref + '-auth-token';
    // Con sesión (ya se ha entrado: el canje de `?code=` ya ha pasado) o al
    // salir, los verificadores sobran.
    sb.auth.onAuthStateChange(function (ev, s) {
      if (s || ev === 'SIGNED_OUT') setTimeout(function () { olvidaVerificadores(clave); }, 0);
    });
    return sb;
  };

  var pendiente = null;
  window.KL_ENLACE = function (sb) {
    if (pendiente) return pendiente;
    pendiente = (async function () {
      var r = { tipo: null, error: null };
      if (enlace) {
        if (TIPOS.indexOf(enlace.type) < 0 || !/^[A-Za-z0-9_-]{16,200}$/.test(enlace.token_hash)) {
          r.error = { code: 'otp_expired' };
        } else {
          try {
            var res = await sb.auth.verifyOtp({ token_hash: enlace.token_hash, type: enlace.type });
            if (res.error) r.error = res.error;
            else {
              r.tipo = enlace.type;
              // El cambio de correo se confirma en dos correos: el primero no
              // trae sesión (falta el otro); el segundo, sí.
              r.sesion = !!(res.data && res.data.session);
            }
          } catch (e) { r.error = e; }
        }
      } else if (fallo) {
        r.error = { code: fallo };
      }
      // Vuelta de Google/Apple: supabase-js canjea `?code=` al arrancar y lo
      // quita. Si sigue ahí, faltaba el secreto de este navegador (se empezó
      // en otro, o se borraron los datos del sitio).
      try { await sb.auth.getSession(); } catch (e) { /* sin red */ }
      var ahora = new URL(location.href);
      if (ahora.searchParams.has('code')) {
        ahora.searchParams.delete('code');
        var resto = ahora.searchParams.toString();
        history.replaceState(history.state, '', ahora.pathname + (resto ? '?' + resto : '') + ahora.hash);
        r.error = r.error || { code: 'otro_navegador' };
      }
      if (r.error) {
        console.warn('acceso:', r.error);
        guardaAviso(claveDe(r.error));
      }
      return r;
    })();
    return pendiente;
  };

  /** El aviso de un enlace que no ha funcionado, en el idioma de la página.
   * Se gasta al leerlo: lo enseña la primera pantalla que lo pida (el panel,
   * o «Tu cuenta» si el panel manda a entrar). */
  window.KL_ENLACE.aviso = function (lang) {
    var k = null;
    try { k = sessionStorage.getItem(AVISO); sessionStorage.removeItem(AVISO); } catch (e) { /* sin almacenamiento */ }
    return k ? TEXTOS[lang === 'en' ? 'en' : 'es'][k] || '' : '';
  };
})();
