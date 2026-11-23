// La pegatina de escaparate «Encuéntranos en Klendar» (§4zzz-cartel, 23-11):
// redonda, con el símbolo, la frase, un QR grande a la ficha del local
// (`klendar.app/b/<dirección>`, donde se ven sus ofertas de hoy) y su nombre.
// La misma que la pieza 04 del kit impreso (`docs/kit/plantillas/pegatina.html`
// de la app): fondo de tinta, el QR en un cuadrado blanco y el coral solo en
// el símbolo. Con «Claro», blanco con un aro de tinta (gasta menos tinta en
// casa).
//
// Tres formas de sacarla (`?modo=`):
//   - `hoja` (de serie): cuatro de 9,5 cm en un folio A4, para papel adhesivo;
//   - `grande`: una de 14 cm en un folio A4;
//   - `imprenta`: una hoja de 106 × 106 mm (10 cm de corte redondo y 3 mm de
//     sangrado), para «Guardar como PDF» y mandarla a una imprenta.
//
// Sin negocio (`/cartel/pegatina`, `/en/poster/sticker`): la genérica, «Estamos
// en Klendar» con un QR a klendar.app, para repartir (también en el kit).
//
// El QR NO es el del cartel del local (`/v/<código>`): ese da un sello por
// visita y una pegatina por fuera del cristal se escanea sin entrar. Se abre
// con el id del negocio (lo que ya se ve en su ficha): no descubre nada.

import { esc, html, isUuid, rpc } from './page.js';
import { slugDe } from './public.js';
import { notFound } from './views.js';
import { CARTEL_JS_V, CSS_BARRA, FUENTES, SIMBOLO_SUELTO, selectorIdioma } from './poster.js';
import { NOMBRE_IDIOMA, TS, idiomaCartel, webDe } from './cartel_idiomas.js';

const MODOS = ['hoja', 'grande', 'imprenta'];

/** Más pequeño cuanto más largo (como `clase_nombre` del kit). */
const claseNombre = (n) => { const l = [...String(n || '')].length; return l <= 12 ? 'n1' : l <= 20 ? 'n2' : l <= 32 ? 'n3' : 'n4'; };

/**
 * La pegatina del negocio [id] (o la genérica si no hay). [ruta]: 'es' o
 * 'en'; [q]: `lang`, `modo` y `fondo` (= claro).
 */
export async function stickerPage(id, ruta, q = new URLSearchParams()) {
  const lang = idiomaCartel(q.get('lang'), ruta);
  const S = TS[lang];
  const web = webDe(lang);
  const modo = MODOS.includes(q.get('modo')) ? q.get('modo') : 'hoja';
  const claro = q.get('fondo') === 'claro';
  const base = ruta === 'en' ? '/en/poster/sticker' : '/cartel/pegatina';
  const generica = !id;
  let nombre = '';
  let url = `https://klendar.app${web === 'en' ? '/en' : '/'}`;
  if (!generica) {
    const b = isUuid(id) ? await rpc('business_profile', { p_id: id }) : null;
    if (!b?.name) return notFound(web, `${base}/${id}`, 'b');
    nombre = b.name;
    const slug = await slugDe(id).catch(() => null);
    url = `https://klendar.app${web === 'en' ? '/en' : ''}/b/${encodeURIComponent(slug || id)}`;
  }
  const aqui = `${base}${generica ? '' : `/${encodeURIComponent(id)}`}`;
  const enlace = (cambio) => {
    const v = { lang: lang !== ruta ? lang : '', modo: modo !== 'hoja' ? modo : '', fondo: claro ? 'claro' : '', ...cambio };
    const p = new URLSearchParams(Object.entries(v).filter(([, x]) => x));
    const s = p.toString();
    return `${aqui}${s ? `?${s}` : ''}`;
  };
  const opcion = (href, actual, texto) => `<a href="${esc(href)}"${actual ? ' aria-current="page"' : ''}>${esc(texto)}</a>`;
  const modos = `<nav class="grupo" aria-label="${esc(S.how)}">
    ${opcion(enlace({ modo: '' }), modo === 'hoja', S.sheet)}${opcion(enlace({ modo: 'grande' }), modo === 'grande', S.big)}${opcion(enlace({ modo: 'imprenta' }), modo === 'imprenta', S.pro)}</nav>`;
  const fondos = `<nav class="grupo" aria-label="${esc(S.bg)}">
    ${opcion(enlace({ fondo: '' }), !claro, S.dark)}${opcion(enlace({ fondo: 'claro' }), claro, S.light)}</nav>`;
  const ayuda = modo === 'imprenta' ? S.helpPro : modo === 'grande' ? S.helpBig : S.helpSheet;
  const titulo = generica ? S.weAre : S.findUs;

  const una = () => `<div class="peg${claro ? ' claro' : ''}${generica ? ' gen' : ''}">
      <span class="simb">${SIMBOLO_SUELTO}</span>
      <p class="frase">${esc(titulo)}</p>
      <div class="caja"><div class="qr" data-qr="${esc(url)}" data-nivel="Q"></div></div>
      ${generica ? `<p class="sub">${esc(S.sub)}</p><p class="web">klendar.app</p>` : `<p class="nombre ${claseNombre(nombre)}">${esc(nombre)}</p>`}
    </div>`;
  const cuantas = modo === 'hoja' ? 4 : 1;
  // La hoja de la imprenta mide 106 mm; la del folio, A4.
  const pagina = modo === 'imprenta' ? { w: 106, h: 106, size: '106mm 106mm' } : { w: 210, h: 297, size: 'A4' };
  // Diámetro de cada una, en % del ancho de la hoja.
  const d = modo === 'imprenta' ? (100 / 106) * 100 : modo === 'grande' ? (140 / 210) * 100 : (95 / 210) * 100;

  return html(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(S.title)}${nombre ? ` · ${esc(nombre)}` : ''} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<style>${FUENTES}</style>
<style>${CSS_BARRA}
  .hoja { background: #fff; width: min(${modo === 'imprenta' ? 440 : 640}px, calc(100vw - 32px)); aspect-ratio: ${pagina.w} / ${pagina.h};
    border-radius: ${modo === 'imprenta' ? 6 : 14}px; box-shadow: 0 24px 60px -30px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.06); overflow: hidden;
    container-type: inline-size; }
  /* Dentro (las medidas en cqw son de la hoja: en el propio contenedor serían de la ventana). */
  .rejilla { height: 100%; display: grid; place-content: center; gap: ${(8 / 210) * 100}cqw; }
  .cuatro .rejilla { grid-template-columns: repeat(2, ${d}cqw); }
  .hoja.imprenta { ${claro ? '' : 'background: #0A0A0A;'} }
  .peg { width: ${d}cqw; aspect-ratio: 1; border-radius: 50%; background: #0A0A0A; color: #fff; position: relative;
    container-type: inline-size; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .hoja:not(.imprenta) .peg.claro { box-shadow: 0 0 0 .25mm #BDBDBD; }
  .peg.claro { background: #fff; color: #0A0A0A; }
  .peg.claro::before { content: ''; position: absolute; inset: 2.6cqw; border: 1.1cqw solid #0A0A0A; border-radius: 50%; }
  .simb { width: 9cqw; height: 9cqw; margin-top: 13.5cqw; }
  .simb svg { width: 100%; height: 100%; display: block; }
  .frase { font-family: Sora, sans-serif; font-weight: 800; font-size: 5.5cqw; line-height: 1.04; letter-spacing: -.035em;
    margin: 2.4cqw 0 0; max-width: 60cqw; text-wrap: balance; }
  .caja { margin-top: 3.4cqw; width: 41cqw; height: 41cqw; background: #fff; border-radius: 3.4cqw; padding: 4cqw; }
  .claro .caja { padding: 2cqw; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .qr { width: 100%; height: 100%; }
  .nombre { font-family: Sora, sans-serif; font-weight: 700; letter-spacing: -.02em; line-height: 1.08; margin: 3cqw 0 0; max-width: 54cqw;
    overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .n1 { font-size: 4.2cqw; } .n2 { font-size: 3.5cqw; } .n3 { font-size: 2.6cqw; max-width: 50cqw; } .n4 { font-size: 2.2cqw; max-width: 46cqw; }
  .sub { font-weight: 700; font-size: 2.9cqw; line-height: 1.2; margin: 2.8cqw 0 0; max-width: 50cqw; text-wrap: balance; }
  .web { font-family: Sora, sans-serif; font-weight: 800; font-size: 3.4cqw; letter-spacing: -.02em; margin: .9cqw 0 0; }
  /* La genérica: la frase más grande (es lo único que dice). */
  .gen .frase { font-size: 7cqw; max-width: 50cqw; }
  .gen .simb { margin-top: 11.5cqw; }
  .gen .sub { font-size: 3.1cqw; }
  /* En pantalla, por dónde corta la imprenta. */
  @media screen { .hoja.imprenta .peg { outline: 1px dashed rgba(255,255,255,.45); } .hoja.imprenta .peg.claro { outline-color: rgba(0,0,0,.35); } }
  @page { size: ${pagina.size}; margin: 0; }
  @media print {
    .hoja { width: ${pagina.w}mm; height: ${pagina.h}mm; aspect-ratio: auto; border-radius: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<header class="barra">
  <h1>${esc(S.title)}${nombre ? ` · ${esc(nombre)}` : ''}</h1>
  <p>${esc(ayuda)} ${esc(S.hint)}</p>
  <div class="ops">${modos}${fondos}${selectorIdioma(S, lang, NOMBRE_IDIOMA, { modo: modo !== 'hoja' ? modo : '', fondo: claro ? 'claro' : '' })}
    <button type="button" class="imprimir" data-imprimir>${esc(S.print)}</button></div>
</header>
<div class="vista">
<main class="hoja ${modo}${cuantas === 4 ? ' cuatro' : ''}" lang="${lang}" role="img" aria-label="${esc(`${titulo}${nombre ? ` · ${nombre}` : ''} · QR: ${url}`)}">
  <div class="rejilla">${Array.from({ length: cuantas }, una).join('')}</div>
</main>
</div>
<script src="/assets/vendor/qrcode.js?v=1" defer></script>
<script src="/assets/cartel.js?v=${CARTEL_JS_V}" defer></script>
</body>
</html>`, 200, generica ? undefined : 'public, max-age=60, s-maxage=300');
}
