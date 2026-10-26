/* «Avísame si hay algo de «karaoke»» en Explorar (tanda D; migración
 * 20261232100001 de la app). Como la app: añade la palabra a «Avísame si…»
 * y, si ya la tienes, dice «Te avisaremos de «karaoke»» y lleva a tus
 * palabras (Tu cuenta → Ajustes → Notificaciones).
 *
 * Las páginas van en caché y no saben quién las mira: si en este navegador
 * hay una sesión de «Tu cuenta», aquí se mira (`my_alert_words`) y se añade
 * sin salir de la página (`add_alert_word`). Sin sesión (o sin JavaScript)
 * el enlace lleva a «Tu cuenta» (`#/avisame-palabra?palabra=…`), que la
 * añade al entrar, con la marca de que se ha pulsado aquí (no vuelve a
 * preguntar; `hayIntencion` en app.js).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var en = !!(yo && yo.dataset.lang === 'en');
  var URL_SB = yo && yo.dataset.url;
  var KEY = yo && yo.dataset.key;
  var caja = document.querySelector('[data-avisame-palabra]');
  if (!caja) return;
  var palabra = caja.getAttribute('data-avisame-palabra') || '';
  var a = caja.querySelector('a');
  var cuenta = en ? '/app/?lang=en' : '/app/';

  var T = en ? {
    added: function (w) { return 'We’ll let you know if there’s something for “' + w + '” nearby'; },
    already: function (w) { return 'You already get alerts for “' + w + '”'; },
    too_short: 'Type at least 3 letters.', too_long: '40 characters at most.',
    too_common: 'That word is too common: try a more specific one.',
    too_many: '10 keywords at most: remove one to add another.',
    oops: 'Something went wrong. If it happens again, email info@klendar.app.',
  } : {
    added: function (w) { return 'Te avisaremos si hay algo de «' + w + '» cerca'; },
    already: function (w) { return 'Ya te avisamos de «' + w + '»'; },
    too_short: 'Escribe al menos 3 letras.', too_long: 'Como mucho 40 caracteres.',
    too_common: 'Esa palabra es demasiado común: prueba con otra más concreta.',
    too_many: 'Como mucho 10 palabras: quita alguna para añadir otra.',
    oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
  };

  // Sin sesión: la marca de que se ha pulsado aquí.
  a.addEventListener('click', function () {
    if (a.getAttribute('data-directo') === '1') return;
    try {
      sessionStorage.setItem('klendar.intencion', JSON.stringify({
        r: 'avisame-palabra?palabra=' + encodeURIComponent(palabra), t: Date.now(),
      }));
    } catch (x) { /* sin almacenamiento */ }
  }, true);

  if (!URL_SB || !KEY) return;
  // La clave de la sesión de supabase-js: `sb-<ref>-auth-token` (en local,
  // `sb-localhost-auth-token`).
  var ref = '';
  try { ref = new URL(URL_SB).hostname.split('.')[0]; } catch (x) { /* sin URL */ }
  function sesionGuardada() {
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (x) { return false; }
  }
  if (!ref || !sesionGuardada()) return;

  var aviso = null;
  function toast(msg, malo) {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'am-toast';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = msg;
    aviso.classList.toggle('bad', !!malo);
    aviso.classList.remove('mov-sale');
    aviso.hidden = false;
    clearTimeout(toast.t);
    // Se va con un fundido corto (Movimiento, /assets/site.css).
    toast.t = setTimeout(function () {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { aviso.hidden = true; return; }
      aviso.classList.add('mov-sale');
      toast.t = setTimeout(function () { aviso.hidden = true; aviso.classList.remove('mov-sale'); }, 150);
    }, malo ? 6000 : 3500);
  }
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  /** Sin tildes ni signos, como `alert_word_norm` en la base. */
  function pliega(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  /** «Te avisaremos de «karaoke»», que lleva a tus palabras. */
  function yaLaTiene() {
    var b = a.querySelector('b');
    var sm = a.querySelector('small');
    if (b) b.textContent = caja.getAttribute('data-si') || '';
    if (sm) sm.textContent = caja.getAttribute('data-si-hint') || '';
    a.href = cuenta + '#/ajustes/notificaciones';
    a.setAttribute('data-directo', '1');
    caja.classList.add('on');
  }

  (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
    'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
    .then(function () {
      var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(URL_SB, KEY,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return;
        return sb.rpc('my_alert_words').then(function (res) {
          if (res.error || !res.data) return;
          var mias = (res.data.words || []).map(function (w) { return pliega(w.word); });
          if (mias.indexOf(pliega(palabra)) >= 0) { yaLaTiene(); return; }
          // Con sesión: se añade aquí mismo.
          a.setAttribute('data-directo', '1');
          a.addEventListener('click', function (e) {
            if (caja.classList.contains('on')) return; // ya añadida: a sus palabras
            e.preventDefault();
            caja.setAttribute('aria-busy', 'true');
            sb.rpc('add_alert_word', { p_word: palabra }).then(function (r2) {
              var d = r2.data;
              if (r2.error || !d) { toast(T.oops, true); return; }
              if (d.ok === false) { toast(T[d.error] || T.oops, true); return; }
              yaLaTiene();
              toast(d.already ? T.already(d.word || palabra) : T.added(d.word || palabra));
            }).catch(function () { toast(T.oops, true); })
              .then(function () { caja.removeAttribute('aria-busy'); });
          });
        });
      });
    })
    .catch(function () { /* sin red: el enlace a «Tu cuenta» */ });
})();
