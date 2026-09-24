import { configure, esc, isUuid, rpc, rpcAll } from '../_lib/page.js';
import { benefit, firstPhoto, fmtDay, fmtLong, fmtTime } from '../_lib/public.js';

// El recuadro que el negocio pega en su web: lo que tiene vivo ahora mismo,
// sin que tenga que mantener nada. Es una página suelta pensada para ir
// dentro de un iframe (Wix, WordPress, Squarespace y compañía suelen dejar
// pegar un iframe, no siempre un script), y le dice su alto a quien la
// embebe para que no salgan barras de desplazamiento.

const BASE = 'https://klendar.app';

const T = (en) => en
  ? { none: 'Nothing on right now.', all: 'See everything', on: 'On right now', by: 'on Klendar' }
  : { none: 'Ahora mismo no hay nada.', all: 'Ver todo', on: 'Ahora mismo', by: 'en Klendar' };

export async function onRequestGet(ctx) {
  configure(ctx.env);
  const id = ctx.params.id;
  const url = new URL(ctx.request.url);
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  const en = lang === 'en';
  const limit = Math.max(1, Math.min(6, parseInt(url.searchParams.get('limit') || '3', 10) || 3));
  const S = T(en);

  if (!isUuid(id)) return new Response('not found', { status: 404 });
  const [b, offers] = await Promise.all([
    rpc('business_profile', { p_id: id }),
    rpcAll('business_offers', { p_id: id }),
  ]);
  if (!b || !b.name) return new Response('not found', { status: 404 });

  const items = offers.slice(0, limit).map((o) => {
    const img = firstPhoto(o.images);
    const when = o.kind === 'future_event'
      ? fmtLong(o.event_at, lang)
      : `${fmtDay(o.redeem_start_at, lang)} · ${fmtTime(o.redeem_start_at, lang)}–${fmtTime(o.redeem_end_at, lang)}`;
    const tag = benefit(o.discount, o.price_cents, o.currency, lang);
    return `<a class="it" href="${BASE}${en ? '/en' : ''}/o/${esc(o.id)}" target="_blank" rel="noopener">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
      <span class="tx"><b>${esc(o.title)}</b>
        <span class="me">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="mu">${esc(when)}</span></span>
      </span></a>`;
  }).join('');

  const html = `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} · Klendar</title>
<meta name="robots" content="noindex">
<style>
  :root { color-scheme: light dark; --ink: #0B0F1A; --mu: #5A6472; --line: rgba(11,15,26,.12);
          --bg: #fff; --accent: #C81E42; --soft: rgba(255,77,109,.12); }
  @media (prefers-color-scheme: dark) {
    :root { --ink: #F2F5FA; --mu: #A6B0C0; --line: rgba(255,255,255,.14); --bg: #0B0F1A; --accent: #FF4D6D; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .box { border: 1px solid var(--line); border-radius: 16px; padding: 12px; }
  .hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .hd b { font-size: 14px; }
  .hd .mu { font-size: 12px; }
  .it { display: flex; gap: 10px; align-items: center; padding: 8px; border-radius: 12px;
        text-decoration: none; color: inherit; }
  .it:hover { background: var(--soft); }
  .it img, .it .ph { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; flex: none;
        display: grid; place-items: center; background: var(--soft); color: var(--accent); }
  .tx { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .tx b { font-size: 15px; }
  .me { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .mu { color: var(--mu); font-size: 13px; }
  .tag { background: var(--soft); color: var(--accent); font-weight: 700; font-size: 12px;
         padding: 2px 8px; border-radius: 999px; }
  .ft { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .ft a { color: var(--accent); font-weight: 700; text-decoration: none; font-size: 13px; }
  .empty { color: var(--mu); padding: 10px 8px; }
</style></head>
<body><div class="box" id="box">
  <div class="hd"><b>${esc(b.name)}</b><span class="mu">· ${esc(S.on)}</span></div>
  ${items || `<p class="empty">${esc(S.none)}</p>`}
  <div class="ft">
    <a href="${BASE}${en ? '/en' : ''}/b/${esc(id)}" target="_blank" rel="noopener">${esc(S.all)} →</a>
    <span class="mu">${esc(S.by)}</span>
  </div>
</div>
<script>
  // Le decimos a la web que nos embebe cuánto medimos, para que no haya
  // barras de desplazamiento dentro del recuadro.
  function alto() {
    var h = document.getElementById('box').getBoundingClientRect().height + 4;
    parent.postMessage({ klendar: 'height', height: Math.ceil(h) }, '*');
  }
  addEventListener('load', alto); addEventListener('resize', alto); alto();
</script>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
      // Este es el único sitio del dominio que se deja meter en un iframe:
      // es justo para lo que está hecho. Manda `frame-ancestors`; el
      // X-Frame-Options del resto del sitio lo quita `_headers`.
      'content-security-policy': 'frame-ancestors *',
    },
  });
}
