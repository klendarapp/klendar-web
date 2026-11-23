// «Echa la cuenta» de /para-negocios y /en/for-business (build_pages.py).
// Antes en línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp). El idioma,
// el de la página. El precio del plan, en `data-plan` de #calc: con `PRECIOS`
// apagado (functions/_lib/chrome.js) build_pages.py lo quita y la cuenta no
// habla del plan. Sin JavaScript, los campos se quedan sin resultado.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var caja = $('calc');
  if (!caja || !$('c-out')) return;
  var en = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
  var plan = caja.hasAttribute('data-plan') ? +caja.getAttribute('data-plan') || 0 : 0;
  var eur = function (n) { return n.toLocaleString(en ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function calc() {
    var t = +$('c-ticket').value || 0, d = +$('c-desc').value || 0;
    var g = +$('c-gente').value || 0, m = +$('c-margen').value || 0;
    var cobras = t * (1 - d / 100);
    var ingresos = cobras * g;
    var margen = ingresos * m / 100;
    var paraPagarlo = cobras * m / 100 > 0 ? Math.ceil(plan / (cobras * m / 100)) : 0;
    $('c-out').innerHTML = en
      ? '<b>' + eur(ingresos) + ' a month</b> through the till from that offer, '
        + eur(margen) + ' in margin.' + (plan ? ' The plan costs ' + eur(plan) + ' + VAT: '
        + '<b>' + paraPagarlo + (paraPagarlo === 1 ? ' redemption' : ' redemptions') + '</b> a month pays for it.' : '')
        + '<br><span class="mu">Each person pays you ' + eur(cobras) + ' instead of ' + eur(t) + '. '
        + 'If they were coming anyway, the discount costs you ' + eur(t * d / 100 * g) + '.</span>'
      : '<b>' + eur(ingresos) + ' al mes</b> de caja con esa oferta, '
        + eur(margen) + ' de margen.' + (plan ? ' El plan cuesta ' + eur(plan) + ' + IVA: lo pagas con '
        + '<b>' + paraPagarlo + (paraPagarlo === 1 ? ' canje' : ' canjes') + '</b> al mes.' : '')
        + '<br><span class="mu">Cada persona te paga ' + eur(cobras) + ' en vez de ' + eur(t) + '. '
        + 'Si esa gente iba a venir igual, el descuento te cuesta ' + eur(t * d / 100 * g) + '.</span>';
  }
  ['c-ticket', 'c-desc', 'c-gente', 'c-margen'].forEach(function (id) {
    $(id).addEventListener('input', calc);
  });
  calc();
})();
