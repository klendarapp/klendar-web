// Centro de ayuda de la web (/preguntas/, /en/faq/): pestañas y buscador.
// Lo mismo que la app (Cuenta → Ayuda): dos pestañas, «Para ti» y «Para
// negocios»; el buscador ignora tildes y mayúsculas y busca en preguntas y
// respuestas; si en la pestaña no hay nada y en la otra sí, lo dice y deja
// saltar. `#negocios` abre esa pestaña y `#<id>` abre esa pregunta.
(function () {
  var raiz = document.querySelector('[data-ayuda]');
  if (!raiz) return;
  var EN = document.documentElement.lang === 'en';
  var T = EN
    ? { nada: 'Nothing matches “%s”.', una: '1 result', varias: '%d results', otra: 'In “%t” there %v.', ver: 'See them in “%t”', es1: 'is 1', esN: 'are %d' }
    : { nada: 'No hay nada con «%s».', una: '1 resultado', varias: '%d resultados', otra: 'En «%t» hay %v.', ver: 'Verlas en «%t»', es1: '1', esN: '%d' };
  var pliega = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var tabs = Array.prototype.slice.call(raiz.querySelectorAll('[role=tab]'));
  var paneles = tabs.map(function (b) { return document.getElementById(b.getAttribute('aria-controls')); });
  var q = raiz.querySelector('#ayuda-q');
  var estado = raiz.querySelector('.ayuda-estado');
  var items = paneles.map(function (p) {
    return Array.prototype.slice.call(p.querySelectorAll('details.faq')).map(function (d) {
      return { d: d, texto: pliega(d.textContent) };
    });
  });
  raiz.classList.add('js');
  raiz.querySelectorAll('[data-solo-js]').forEach(function (x) { x.hidden = false; });
  var actual = 0;

  function elige(i, foco) {
    actual = i;
    tabs.forEach(function (b, k) {
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
      paneles[k].hidden = k !== i;
    });
    if (foco) tabs[i].focus();
    filtra();
  }

  function coincide(it, palabras) {
    return palabras.every(function (w) { return it.texto.indexOf(w) !== -1; });
  }

  function filtra() {
    var crudo = q ? q.value.trim() : '';
    var palabras = pliega(crudo).split(/\s+/).filter(Boolean);
    var cuentas = items.map(function (lista) {
      var n = 0;
      lista.forEach(function (it) {
        var si = !palabras.length || coincide(it, palabras);
        it.d.hidden = !si;
        if (si) n++;
      });
      return n;
    });
    estado.textContent = '';
    if (!palabras.length) return;
    var aqui = cuentas[actual];
    var otra = 1 - actual;
    var p = document.createElement('p');
    p.textContent = aqui ? (aqui === 1 ? T.una : T.varias.replace('%d', aqui)) : T.nada.replace('%s', crudo);
    estado.appendChild(p);
    if (!aqui && cuentas[otra]) {
      var nombre = tabs[otra].textContent.trim();
      var o = document.createElement('p');
      o.className = 'ayuda-otra';
      o.textContent = T.otra.replace('%t', nombre).replace('%v', cuentas[otra] === 1 ? T.es1 : T.esN.replace('%d', cuentas[otra])) + ' ';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill ghost';
      b.textContent = T.ver.replace('%t', nombre);
      b.addEventListener('click', function () { elige(otra, true); });
      o.appendChild(b);
      estado.appendChild(o);
    }
  }

  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { elige(i); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); elige(1 - i, true); }
    });
  });
  if (q) q.addEventListener('input', filtra);

  function desdeHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    var k = paneles.findIndex(function (p) { return p.id === 'ayuda-' + h; });
    if (k >= 0) { elige(k); return; }
    var d = document.getElementById(h);
    if (d && d.tagName === 'DETAILS') {
      var i = paneles.findIndex(function (p) { return p.contains(d); });
      if (i >= 0) elige(i);
      d.open = true;
      d.scrollIntoView();
    }
  }
  addEventListener('hashchange', desdeHash);
  elige(0);
  desdeHash();
})();
