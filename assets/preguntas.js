/* «Preguntas» en la ficha pública de un negocio (`/b/<slug>` y
 * `?ver=preguntas`), como la app (migración 20261237100000):
 *
 *   · Lo contestado lo pinta la Function (sin sesión, igual para todos).
 *   · Con sesión, aquí: «Tus preguntas» que aún no se ven (Esperando
 *     respuesta · Oculta por el negocio: motivo) con «Borrar mi pregunta»;
 *     «A mí también me sirve» encendido o apagado (ni en la propia ni al
 *     equipo); por qué no puedes preguntar ahora (una esperando, 3 al día);
 *     y al equipo, «N preguntas sin contestar · Contestar» (al panel).
 *   · Sin sesión, «A mí también me sirve» lleva a entrar.
 *
 * Va en `<script data-biz data-lang data-url data-key data-cuenta>`. Sin red,
 * la ficha se queda como la pinta la Function. */
(function () {
  'use strict';
  var yo = document.currentScript;
  if (!yo) return;
  var biz = yo.getAttribute('data-biz');
  var en = yo.getAttribute('data-lang') === 'en';
  var cuenta = yo.getAttribute('data-cuenta') || '/app/';
  var T = en ? {
    tuyas: 'Your questions', esperando: 'Waiting for a reply', oculta: 'Hidden by the business',
    borrar: 'Delete my question', borrarSeguro: 'Delete your question?', sirve: 'Helpful to me too',
    pendiente: 'You already have a question waiting for a reply here.',
    hoy: "That's enough for today: you can ask more tomorrow.",
    equipo: function (n) { return n === 0 ? 'No questions to answer' : n === 1 ? '1 question to answer' : n + ' questions to answer'; },
    contestar: 'Answer', ver: 'See questions', error: 'Something went wrong. Try again in a moment.',
    propia: "It's your question.",
    motivos: {
      answered_elsewhere: 'The answer is already on the page', not_about_us: "It isn't about the venue",
      personal_data: 'It contains personal details', inappropriate: "It isn't appropriate", outdated: "It's out of date",
    },
  } : {
    tuyas: 'Tus preguntas', esperando: 'Esperando respuesta', oculta: 'Oculta por el negocio',
    borrar: 'Borrar mi pregunta', borrarSeguro: '¿Borrar tu pregunta?', sirve: 'A mí también me sirve',
    pendiente: 'Ya tienes una pregunta esperando respuesta aquí.',
    hoy: 'Por hoy ya está: mañana puedes preguntar más.',
    equipo: function (n) { return n === 0 ? 'Ninguna pregunta sin contestar' : n === 1 ? '1 pregunta sin contestar' : n + ' preguntas sin contestar'; },
    contestar: 'Contestar', ver: 'Ver preguntas', error: 'Algo no ha ido bien. Prueba otra vez en un momento.',
    propia: 'Es tu pregunta.',
    motivos: {
      answered_elsewhere: 'La respuesta ya está en la ficha', not_about_us: 'No es sobre el local',
      personal_data: 'Lleva datos personales', inappropriate: 'No es apropiada', outdated: 'Ya no está al día',
    },
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function sesionGuardada(ref) {
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (e) { return false; }
  }
  function botones() { return Array.prototype.slice.call(document.querySelectorAll('[data-sirve]')); }
  function texto(b, n) { b.textContent = T.sirve + (n > 0 ? ' · ' + n : ''); }

  /** Sin sesión: el botón lleva a entrar (y vuelve a «Pregúntale a …»). */
  function sinSesion() {
    botones().forEach(function (b) {
      b.hidden = false;
      var n = b.parentNode.querySelector('.sirve-n');
      if (n) n.hidden = true;
      b.addEventListener('click', function () {
        location.href = cuenta + '#/entrar?siguiente=' + encodeURIComponent('preguntar/' + biz);
      });
    });
  }

  function pintaMias(s, sb) {
    var mias = (s.mine || []);
    var html = '';
    if (s.team) {
      html += '<p class="pregunta-equipo"><span class="muted">' + esc(T.equipo(Number(s.unanswered) || 0)) + '</span> '
        + '<a class="pill" href="/panel/#/preguntas?biz=' + encodeURIComponent(biz) + '">' + esc(s.can_answer ? T.contestar : T.ver) + '</a></p>';
    }
    if (mias.length) {
      html += '<h3 class="side-h">' + esc(T.tuyas) + '</h3><div class="preguntas">' + mias.map(function (q) {
        var estado = q.state === 'hidden'
          ? T.oculta + ': ' + (T.motivos[q.hidden_reason] || '')
          : T.esperando;
        return '<article class="pregunta" id="pregunta-' + esc(q.id) + '"><p class="pregunta-t"><span><b>' + esc(q.question) + '</b>'
          + '<small class="tag pregunta-estado">' + esc(estado) + '</small></span></p>'
          + '<p class="pregunta-pie"><button type="button" class="pill" data-borrar-pregunta="' + esc(q.id) + '">' + esc(T.borrar) + '</button></p></article>';
      }).join('') + '</div>';
    }
    document.querySelectorAll('[data-preguntas-mias]').forEach(function (el) {
      el.innerHTML = html;
      el.hidden = !html;
    });
    document.querySelectorAll('[data-borrar-pregunta]').forEach(function (b) {
      b.addEventListener('click', function () {
        // eslint-disable-next-line no-alert
        if (!window.confirm(T.borrarSeguro)) return;
        b.disabled = true;
        sb.rpc('delete_my_question', { p_id: b.getAttribute('data-borrar-pregunta') }).then(function (r) {
          if (r && !r.error && r.data && r.data.ok) location.reload();
          else { b.disabled = false; window.alert(T.error); } // eslint-disable-line no-alert
        });
      });
    });
    // Preguntar: el equipo no; con una esperando o 3 hoy, por qué.
    document.querySelectorAll('[data-preguntar]').forEach(function (p) {
      if (s.team) { p.hidden = true; return; }
      var por = s.ask_block === 'pending' ? T.pendiente : s.ask_block === 'daily_limit' ? T.hoy : '';
      if (por) p.innerHTML = '<span class="muted">' + esc(por) + '</span>';
    });
  }

  /** «A mí también me sirve» con lo que ya marcaste. */
  function pintaSirve(estado, s, sb) {
    botones().forEach(function (b) {
      var id = b.getAttribute('data-sirve');
      var q = estado[id];
      var n = b.parentNode.querySelector('.sirve-n');
      if (s.team || (q && q.mine)) return; // ni la propia ni el equipo: solo el número
      b.hidden = false;
      if (n) n.hidden = true;
      var on = !!(q && q.helped);
      var cuenta0 = Number(b.getAttribute('data-n')) || 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      texto(b, cuenta0);
      b.addEventListener('click', function () {
        var quiere = b.getAttribute('aria-pressed') !== 'true';
        b.disabled = true;
        sb.rpc('set_question_helpful', { p_id: id, p_on: quiere }).then(function (r) {
          b.disabled = false;
          var d = r && r.data;
          if (r && !r.error && d && d.ok) {
            b.setAttribute('aria-pressed', d.helped ? 'true' : 'false');
            b.setAttribute('data-n', String(d.helpful));
            texto(b, Number(d.helpful) || 0);
          } else {
            window.alert(d && d.error === 'own' ? T.propia : T.error); // eslint-disable-line no-alert
          }
        });
      });
    });
  }

  (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
    .then(function () {
      var env = window.KLENDAR_ENV;
      if (!env) return null;
      var ref = (env.url.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
      if (!sesionGuardada(ref)) { sinSesion(); return null; }
      return (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
        .then(function () {
          // El mismo cliente que amigos.js, cerrado.js y visita.js (uno por página).
          var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(env.url, env.key,
            { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
          var p = Number(new URLSearchParams(location.search).get('p')) || 1;
          return Promise.all([
            sb.rpc('business_questions_summary', { p_business: biz }),
            sb.rpc('business_questions_page', { p_business: biz, p_limit: 24, p_offset: (p - 1) * 24 }),
          ]).then(function (res) {
            var s = res[0] && !res[0].error ? res[0].data : null;
            if (!s || !s.ok) { sinSesion(); return; }
            var estado = {};
            ((res[1] && res[1].data) || []).concat(s.top || []).forEach(function (q) { estado[q.id] = q; });
            pintaMias(s, sb);
            pintaSirve(estado, s, sb);
          });
        });
    })
    .catch(function () { /* sin red: la ficha, sin esto */ });
})();
