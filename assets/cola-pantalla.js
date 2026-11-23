// La pantalla de la cola virtual (`/cola/<código>/pantalla`, functions/_lib/cola.js
// `queueScreenPage`): el QR para apuntarse y los números, cada 5 s. Los datos
// van en `<script type="application/json" id="cola-pantalla-datos">` (textos,
// idioma, lo de la primera vez, Supabase público y el código). Antes en
// línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function () {
  var el = document.getElementById('cola-pantalla-datos');
  var D; try { D = JSON.parse(el ? el.textContent : 'null'); } catch (e) { D = null; }
  if (!D) return;
  var S = D.S || {};
  var esperaTxt = D.en
    ? function (m) { return m <= 1 ? 'Approximate wait: 1 min' : 'Approximate wait: about ' + m + ' min'; }
    : function (m) { return m <= 1 ? 'Espera aproximada: 1 min' : 'Espera aproximada: unos ' + m + ' min'; };
  var caja = document.querySelector('.lado .qr');
  if (caja && typeof qrcode === 'function') { var qr = qrcode(0, 'M'); qr.addData(D.joinUrl); qr.make(); caja.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var pre = D.en ? 'No. ' : 'Nº ';
  function pinta(d) {
    var b = (d && d.business) || {}; var q = d && d.queue;
    var h = '<h1>' + esc(b.name) + '</h1>';
    if (!q) h += '<p class="vacia">' + esc(S.noQueue) + '</p>';
    else {
      var llam = q.called || [];
      h += '<p class="et">' + esc(S.now) + '</p>';
      h += llam.length ? '<p class="ahora">' + esc(pre + llam[0]) + (llam.length > 1 ? '<small>' + esc(llam.slice(1, 4).map(function (n) { return pre + n; }).join(' · ')) + '</small>' : '') + '</p>' : '<p class="ahora">—</p>';
      h += '<p class="et">' + esc(S.next) + '</p>';
      h += (q.next || []).length ? '<p class="sig">' + esc(q.next.map(function (n) { return pre + n; }).join(' · ')) + '</p>' : '<p class="vacia">' + esc(S.none) + '</p>';
      if (q.status !== 'open') h += '<p class="espera">' + esc(S.closed) + '</p>';
      else if (q.wait_minutes != null && (q.next || []).length) h += '<p class="espera">' + esc(esperaTxt(q.wait_minutes < 15 ? q.wait_minutes : Math.floor((q.wait_minutes + 2) / 5) * 5)) + '</p>';
    }
    document.getElementById('numeros').innerHTML = h;
  }
  pinta(D.info);
  setInterval(function () {
    fetch(D.url + '/rest/v1/rpc/queue_screen', {
      method: 'POST',
      headers: { apikey: D.key, Authorization: 'Bearer ' + D.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: D.code }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.ok) pinta(d); }).catch(function () {});
  }, 5000);
})();
