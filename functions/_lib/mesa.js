// QR de mesa con el wifi: `klendar.app/m/<código>` (y `/en/m/<código>`).
// Tanda D (migración 20261230100002 de la app).
//
// Arriba y en grande, el wifi del local (red y contraseña, con «Copiar
// contraseña»); debajo, lo de hoy de ese local, su carta, «Añadir a
// favoritos» y un «Descarga Klendar» discreto. Sin wifi, sirve de «QR de
// mesa» (ofertas y carta). Lo mismo que la app (`TableQrPage`); con la app
// instalada, el enlace la abre (App Link).
//
// · Sin sesión, sin rastreo: sin el contador de Cloudflare ni cookies. El
//   escaneo se cuenta con `table_qr_scan` desde el navegador (una conexión
//   cuenta una vez cada 30 minutos; la base no guarda quién).
// · `noindex` (cabecera y meta), fuera de los sitemaps y `privada` (sin
//   canonical, hreflang ni og:url): la contraseña no va a ningún buscador.
// · Ligera para el límite de CPU de Cloudflare: tres llamadas a la vez y
//   la página en la caché del borde 30 s (`max-age=30, s-maxage=30`): un
//   cambio de contraseña se ve en menos de un minuto, también contando la
//   caché del navegador.

import { esc, html, isUuid, rpc, rpcAll, supabasePublic } from './page.js';
import KZ from '../../assets/zona.js';
import { money, publicPage, zonaDe } from './public.js';
import { rejilla } from './tarjeta.js';

// Los catorce alérgenos de la carta (los mismos que la ficha y la app).
const ALERGENOS = {
  gluten: ['Gluten', 'Gluten'], crustaceos: ['Crustáceos', 'Crustaceans'], huevos: ['Huevos', 'Eggs'],
  pescado: ['Pescado', 'Fish'], cacahuetes: ['Cacahuetes', 'Peanuts'], soja: ['Soja', 'Soy'],
  lacteos: ['Lácteos', 'Milk'], frutos_cascara: ['Frutos de cáscara', 'Tree nuts'], apio: ['Apio', 'Celery'],
  mostaza: ['Mostaza', 'Mustard'], sesamo: ['Sésamo', 'Sesame'], sulfitos: ['Sulfitos', 'Sulphites'],
  altramuces: ['Altramuces', 'Lupin'], moluscos: ['Moluscos', 'Molluscs'],
};
const alergeno = (k, en) => (ALERGENOS[k] ? ALERGENOS[k][en ? 1 : 0] : String(k).replace(/_/g, ' '));

const T = {
  es: {
    title: 'Wifi y ofertas', wifi: 'Wifi gratis', ssid: 'Nombre de la red', pass: 'Contraseña', copy: 'Copiar contraseña',
    copied: 'Contraseña copiada', open: 'Sin contraseña', noWifi: 'Mira lo que hay hoy aquí y la carta.',
    today: 'Hoy aquí', none: 'Hoy no hay ofertas publicadas.', menu: 'Carta', fav: 'Añadir a favoritos', ficha: 'Ver la ficha',
    allergens: 'Alérgenos', menuNote: 'Los alérgenos son los que declara el negocio. Si tienes alergia, pregúntalo en el sitio.',
    app: 'Descarga Klendar: ofertas y planes cerca de ti',
    gone: 'Este cartel ya no vale', goneBody: (n) => `${n} ha cambiado sus carteles de mesa. Pide al personal el nuevo o mira su ficha.`,
    off: 'No disponible ahora mismo', offBody: 'Este local no se puede ver ahora en Klendar. Pregunta al personal por el wifi.',
    explore: 'Ver qué hay cerca',
    bad: 'Este código no existe', badBody: 'Puede que el cartel esté mal impreso. Pregunta al personal.',
  },
  en: {
    title: 'Wi-Fi and offers', wifi: 'Free Wi-Fi', ssid: 'Network name', pass: 'Password', copy: 'Copy password',
    copied: 'Password copied', open: 'No password', noWifi: 'See what’s on here today and the menu.',
    today: 'Here today', none: 'No offers posted today.', menu: 'Menu', fav: 'Add to favourites', ficha: 'See the page',
    allergens: 'Allergens', menuNote: 'Allergens are as declared by the business. If you have an allergy, ask at the venue.',
    app: 'Get Klendar: offers and plans near you',
    gone: 'This card is no longer valid', goneBody: (n) => `${n} has changed its table cards. Ask the staff for the new one or see its page.`,
    off: 'Not available right now', offBody: 'This venue can’t be seen on Klendar right now. Ask the staff for the Wi-Fi.',
    explore: "See what's nearby",
    bad: "This code doesn't exist", badBody: 'The card may be misprinted. Ask the staff.',
  },
};

// Lo propio de esta página (el resto, de site.css y public.css).
const CSS = `<style>
.mesa-wifi{border-radius:24px;padding:20px;margin:8px 0 18px;background:var(--glass,rgba(127,127,127,.08));border:1px solid var(--line,rgba(127,127,127,.2))}
.mesa-wifi h1{display:flex;align-items:center;gap:8px;font-size:20px;margin:0 0 12px}
.mesa-wifi .k{display:block;font-size:13px;opacity:.7;margin-top:10px}
.mesa-wifi .v{display:block;font-family:Sora,sans-serif;font-weight:800;font-size:clamp(22px,6vw,30px);line-height:1.15;word-break:break-all;user-select:all}
.mesa-wifi .pill{margin-top:14px;width:100%;justify-content:center}
.mesa-acc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 22px}
.mesa-acc .pill{justify-content:center}
.mesa-app{margin:28px 0 8px;font-size:13px;opacity:.75;text-align:center}
.mesa-app a{color:inherit}
</style>`;

const WIFI_IC = '<svg class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';

/** La página del QR de mesa. */
export async function tableQrPage(token, lang) {
  const en = lang === 'en';
  const S = T[en ? 'en' : 'es'];
  const path = `${en ? '/en' : ''}/m/${token}`;
  const info = /^[A-Za-z0-9_-]{16}$/.test(token || '') ? await rpc('table_qr_info', { p_token: token }) : null;
  const fichaDe = (slug) => `${en ? '/en' : ''}/b/${encodeURIComponent(slug)}`;
  const pagina = (title, body, status, cache) => {
    const res = html(publicPage({
      lang, path, title, description: S.noWifi, body, privada: true, contador: false,
      head: `<meta name="robots" content="noindex, nofollow">${CSS}`,
    }), status, cache);
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  };
  if (info?.error === 'token_changed') {
    const slug = info.slug || info.business_id;
    return pagina(S.gone, `<section class="vacio"><h1>${esc(S.gone)}</h1><p>${esc(S.goneBody(info.business_name || ''))}</p>
      ${slug ? `<div class="vacio-botones"><a class="pill accent" href="${esc(fichaDe(slug))}">${esc(S.ficha)}</a></div>` : ''}</section>`, 410, 'no-store');
  }
  const explorar = `${en ? '/en/explore' : '/explorar'}/`;
  const b = info?.ok ? info.business : null;
  if (!b?.id || !isUuid(b.id)) {
    return pagina(S.bad, `<section class="vacio"><h1>${esc(S.bad)}</h1><p>${esc(S.badBody)}</p>
      <div class="vacio-botones"><a class="pill accent" href="${explorar}">${esc(S.explore)}</a></div></section>`, 404, 'no-store');
  }
  if (!info.visible) {
    return pagina(S.off, `<section class="vacio"><h1>${esc(S.off)}</h1><p>${esc(S.offBody)}</p>
      <div class="vacio-botones"><a class="pill accent" href="${explorar}">${esc(S.explore)}</a></div></section>`, 200, 'public, max-age=30, s-maxage=30');
  }

  const tz = zonaDe(b);
  const [offers, carta] = await Promise.all([
    rpcAll('business_offers', { p_id: b.id }).catch(() => []),
    rpcAll('business_menu', { p_business: b.id }).catch(() => []),
  ]);
  // Lo de hoy: lo que se puede canjear ya o empieza hoy, y los eventos de hoy.
  const hoy = KZ.hoy(tz);
  const ahora = Date.now();
  const deHoy = offers.filter((o) => {
    const ini = o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at;
    if (!ini) return false;
    return KZ.dia(ini, tz) === hoy || (o.kind === 'flash_offer' && Date.parse(ini) <= ahora);
  });

  const w = info.wifi;
  const wifiHtml = w ? `<section class="mesa-wifi" aria-labelledby="mesa-wifi">
      <h1 id="mesa-wifi">${WIFI_IC}${esc(S.wifi)}</h1>
      ${w.ssid ? `<span class="k">${esc(S.ssid)}</span><span class="v">${esc(w.ssid)}</span>` : ''}
      <span class="k">${esc(S.pass)}</span>
      ${w.password ? `<span class="v" id="mesa-clave">${esc(w.password)}</span>
      <button type="button" class="pill accent big" data-copiar="${esc(w.password)}" data-hecho="${esc(S.copied)}">${esc(S.copy)}</button>`
    : `<span class="v">${esc(S.open)}</span>`}
    </section>` : `<h1>${esc(b.name)}</h1><p class="muted">${esc(S.noWifi)}</p>`;

  const ficha = fichaDe(b.slug || b.id);
  const cuenta = en ? '/app/?lang=en' : '/app/';
  const cartaHtml = carta.length ? `<h2 id="carta">${esc(S.menu)}</h2>
    <div class="menu">${carta.map((sec) => `<section><h3>${esc(sec.name)}</h3><ul>${(sec.items || []).map((it) => `<li>
      <span class="plato"><b>${esc(it.name)}</b>${it.description ? `<small>${esc(it.description)}</small>` : ''}${(it.allergens || []).length ? `<small class="alg">${esc(S.allergens)}: ${it.allergens.map((a) => esc(alergeno(a, en))).join(', ')}</small>` : ''}</span>
      <span class="price">${it.price_cents == null ? '' : esc(money(it.price_cents, 'EUR', lang))}</span></li>`).join('')}</ul></section>`).join('')}</div>
    <p class="note">${esc(S.menuNote)}</p>` : '';

  const sp = supabasePublic();
  const body = `
  ${wifiHtml}
  <div class="mesa-acc">
    <a class="pill" data-solo-publico data-fav="${esc(b.id)}" href="${cuenta}#/seguir/${encodeURIComponent(b.id)}"><span>${esc(S.fav)}</span></a>
    <a class="pill" href="${esc(ficha)}"><span>${esc(S.ficha)}</span></a>
  </div>
  <h2>${esc(S.today)}${w ? ` · ${esc(b.name)}` : ''}</h2>
  ${deHoy.length ? rejilla(deHoy, lang, { tz, sinNegocio: true }) : `<p class="empty">${esc(S.none)}</p>`}
  ${cartaHtml}
  <p class="mesa-app"><a href="${en ? '/en/' : '/'}">${esc(S.app)}</a></p>
  <script>(function(){var b=document.querySelector('[data-copiar]');if(b)b.addEventListener('click',function(){var t=b.getAttribute('data-copiar'),h=b.getAttribute('data-hecho'),l=b.textContent;
function ok(){b.textContent=h;setTimeout(function(){b.textContent=l;},2500);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,function(){});}else{var r=document.createRange();r.selectNodeContents(document.getElementById('mesa-clave'));var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy');ok();}catch(e){}}});
if(navigator.webdriver)return;try{var k=${JSON.stringify(sp.key)};fetch(${JSON.stringify(`${sp.url}/rest/v1/rpc/table_qr_scan`)},{method:'POST',keepalive:true,headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({p_token:${JSON.stringify(token)}})}).catch(function(){});}catch(e){}})();</script>`;

  return pagina(`${S.title} · ${b.name}`, body, 200, 'public, max-age=30, s-maxage=30');
}
