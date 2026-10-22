/* «Tu cuenta»: lo que has ahorrado con Klendar (Fidelizar, tanda C,
 * migración 20261211100000 de la app). Lo mismo que en Cuenta de la app.
 *
 * - En «Tu cuenta», debajo de los accesos: «Este mes has ahorrado 23 € con
 *   Klendar» y el total (solo si hay algo ahorrado).
 * - #/ahorro: este mes, el total, «¿Cómo se calcula?» y canje a canje
 *   (`my_savings`: precio de antes − lo pagado, por las plazas; lo que no
 *   tiene precio de antes no suma).
 *
 * Va después de app.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`, `t`, `esc`,
 * `ic`, `fecha`, `money`, `pantallaVacia`, `exigeSesion`, `EN`, `LOC`).
 * Comparten ámbito: los nombres de aquí empiezan por `ahorro`.
 */
'use strict';

/** «23 €»: en euros enteros, como la app (es aproximado). */
const ahorroEuros = (c) => ((c || 0) / 100).toLocaleString(LOC, {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/** La fila de «Tu cuenta» (se rellena sola; si no hay nada, no sale). */
async function pintaAhorroFila() {
  const caja = $('#ahorro-fila');
  if (!caja) return;
  const s = await llamar('my_savings', {}).catch(() => null);
  if (!s || !s.total_cents || !caja.isConnected) return;
  const titulo = s.month_cents > 0
    ? (EN ? `This month you've saved ${ahorroEuros(s.month_cents)} with Klendar` : `Este mes has ahorrado ${ahorroEuros(s.month_cents)} con Klendar`)
    : (EN ? `You've saved ${ahorroEuros(s.total_cents)} with Klendar` : `Has ahorrado ${ahorroEuros(s.total_cents)} con Klendar`);
  const detalle = s.month_cents > 0
    ? (EN ? `In total, ${ahorroEuros(s.total_cents)}` : `En total, ${ahorroEuros(s.total_cents)}`)
    : (EN ? 'Tap to see the breakdown' : 'Toca para ver el desglose');
  caja.innerHTML = fila({ href: '#/ahorro', icono: 'savings', titulo, detalle });
  caja.hidden = false;
}

RUTAS.ahorro = async () => {
  if (!exigeSesion('ahorro')) return;
  const s = await llamar('my_savings', {});
  const migas = `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>`;
  const tituloPagina = EN ? "What you've saved" : 'Lo que has ahorrado';
  if (!s?.total_cents) {
    pinta(migas + pantallaVacia({
      icono: 'savings',
      h: 'h1',
      titulo: EN ? "You haven't saved with Klendar yet" : 'Aún no has ahorrado con Klendar',
      texto: EN ? "When you redeem an offer with a previous price, you'll see what you saved here."
        : 'Cuando canjees una oferta con precio de antes, aquí verás lo que te has ahorrado.',
      // Como la app: «Ver ofertas» lleva a Descubre.
      botones: `<a class="pill accent" href="${PUB_EN ? '/en/discover/' : '/descubre/'}">${esc(EN ? 'See offers' : 'Ver ofertas')}</a>`,
    }));
    return;
  }
  const items = s.items || [];
  const sinPrecio = s.unpriced || 0;
  const como = EN
    ? "It's approximate. For each validated redemption, we take what you paid away from the previous price the business gave, times the places. Anything without a previous price (2-for-1, free with no price or other offers) doesn't count. We don't know what else you spent at the venue. The month is the venue's local month."
    : 'Es aproximado. Por cada canje validado, restamos lo que pagaste del precio de antes que indicó el negocio, por las plazas. Lo que no tiene precio de antes (2x1, gratis sin precio u otras ofertas) no suma. Lo que gastaste aparte en el local no lo sabemos. El mes es el de la hora del local.';
  pinta(`${migas}
    <h1>${esc(tituloPagina)}</h1>
    <div class="ticket ahorro-cifra" style="text-align:left">
      <p class="muted" style="margin:0">${esc(EN ? 'This month' : 'Este mes')}</p>
      <p style="font-size:2.4rem;font-weight:800;margin:2px 0 6px">${esc(ahorroEuros(s.month_cents))}</p>
      <p style="margin:0"><b>${esc(EN ? `In total, ${ahorroEuros(s.total_cents)}` : `En total, ${ahorroEuros(s.total_cents)}`)}</b></p>
    </div>
    <details class="ayuda-plegable"><summary>${esc(EN ? 'How is it worked out?' : '¿Cómo se calcula?')}</summary><p>${esc(como)}</p></details>
    <h2 class="seccion-t">${esc(EN ? 'Redemption by redemption' : 'Canje a canje')}</h2>
    <div class="olist">${items.map((i) => {
    const partes = [i.business_name, fecha(i.validated_at, { day: 'numeric', month: 'short' }, i.time_zone || undefined)];
    if (i.before_cents != null && i.paid_cents != null) partes.push(`${money(i.before_cents)} → ${money(i.paid_cents)}`);
    if ((i.seats || 1) > 1) partes.push(EN ? `${i.seats} places` : t(`${i.seats} plazas`));
    const dentro = `<span class="ocard-body"><b>${esc(i.offer_title)}</b>
        <span class="muted">${esc(partes.join(' · '))}</span>
        <span class="ocard-meta"><span class="tag">−${esc(money(i.saved_cents))}</span></span></span>`;
    return i.offer_id ? `<a class="ocard" href="${PUB_EN ? '/en/o/' : '/o/'}${esc(i.offer_id)}">${dentro}</a>` : `<div class="ocard">${dentro}</div>`;
  }).join('')}</div>
    ${sinPrecio ? `<p class="muted nota">${esc(EN
    ? (sinPrecio === 1 ? "1 redemption with no previous price doesn't count." : `${sinPrecio} redemptions with no previous price don't count.`)
    : (sinPrecio === 1 ? '1 canje sin precio de antes no suma.' : `${sinPrecio} canjes sin precio de antes no suman.`))}</p>` : ''}`);
};
