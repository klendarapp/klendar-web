/* «Tu cuenta» → «Artistas que sigues» (#/artistas), como la app (tanda C;
 * migración 20261205100000_artistas de la app).
 *
 * - La lista con la próxima fecha de cada artista (a su ficha, /o/<id>), su
 *   página pública (/a/<slug>), «Dejar de seguir» y «Seguir a un artista»,
 *   que abre el buscador (`artist_search`) con la misma hoja que «Seguir a un
 *   equipo» (`hojaSeguir`, app/partidos.js).
 * - `#/artistas?seguir=<id>&nombre=<nombre>`: lo que manda «Seguir» desde la
 *   página pública de un artista sin sesión. Al entrar, se sigue; si el
 *   enlace no viene de un botón de esta web (sin la marca de
 *   /assets/seguir.js), primero se pregunta (`confirmaEnlace`).
 * - Al seguir, se guarda la zona de los filtros para los avisos
 *   (`guardaZonaAvisos`, la misma que con los equipos).
 * - La fila de la portada de la cuenta (`filaArtistas`), junto a «Equipos
 *   que sigues».
 *
 * Va después de app.js y partidos.js y usa lo suyo (`RUTAS`, `llamar`,
 * `pinta`, `esc`, `fila`, `toast`, `exigeSesion`, `confirmaEnlace`,
 * `ocupado`, `pantallaVacia`, `hojaSeguir`, `guardaZonaAvisos`…). Los textos,
 * de /assets/artistas.js (los mismos que la app y la web pública).
 */
'use strict';

const KAr = globalThis.KlendarArtistas;
const SA = () => KAr.t(LANG);
/** music_note (Material Icons, Apache 2.0): no está en la fuente recortada. */
const NOTA_SVG = 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z';
const icArtista = (s = 24) => `<svg class="ms-svg" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${NOTA_SVG}"/></svg>`;
const UUID_AR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const artistaWeb = (slug) => `${PUB_EN ? '/en' : ''}/a/${encodeURIComponent(slug)}`;
/** La foto (o la inicial) de un artista, pequeña. */
const avatarArtista = (a) => (KAr.seguro(a.photo_url)
  ? `<img class="art-av" src="${esc(a.photo_url)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
  : `<span class="art-av" aria-hidden="true">${esc(KAr.inicial(a.name))}</span>`);

/** La fila de la portada de «Tu cuenta» (grupo Preferencias). */
function filaArtistas() {
  return `<a class="fila" href="#/artistas">${icArtista()}
    <span class="fila-t"><b>${esc(SA().youFollow)}</b><small>${esc(SA().rowHint)}</small></span>
    ${ic('chevron_right')}</a>`;
}

const errorArtista = (e) => (e?.clave === 'too_many' ? SA().tooManyFollow
  : e?.clave === 'rate_limited' ? SA().rateLimited
    : e?.clave === 'not_found' ? SA().notFound
      : e?.message || amable(''));

/** «Artistas que sigues». */
RUTAS.artistas = async (_partes, params) => {
  const S = SA();
  const seguir = params.get('seguir') || '';
  const nombre = String(params.get('nombre') || '').trim().slice(0, 60);
  const aqui = UUID_AR.test(seguir) ? `artistas?seguir=${encodeURIComponent(seguir)}${nombre ? `&nombre=${encodeURIComponent(nombre)}` : ''}` : 'artistas';
  if (!exigeSesion(aqui)) return;

  // Llega de «Seguir» (la página pública del artista): se sigue y se quita de
  // la dirección (recargar no lo vuelve a hacer).
  if (UUID_AR.test(seguir)) {
    const quien = nombre || (EN ? 'this artist' : 'este artista');
    const sigue = await confirmaEnlace(`artistas?seguir=${seguir}`, {
      titulo: `${S.follow} · ${quien}`,
      texto: S.weTell,
      boton: S.follow,
      volver: '#/artistas',
    });
    if (!sigue) return;
    history.replaceState(null, '', `${location.pathname}${location.search}#/artistas`);
    try {
      await llamar('follow_artist', { p_artist: seguir });
      guardaZonaAvisos();
      toast(S.on(quien));
    } catch (e) { toast(errorArtista(e), true); }
  }

  const lista = (await llamar('my_followed_artists', {})) || [];
  const cabeza = `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(S.youFollow)}</h1>`;
  // Neutro con borde (el coral, solo para el botón principal y las ofertas).
  const botonSeguir = `<button type="button" class="pill" data-seguir-artista>${esc(S.followOne)}</button>`;
  if (!lista.length) {
    pinta(`${cabeza}
      <section class="vacio">
        <span class="vacio-ic">${icArtista(30)}</span>
        <h2>${esc(S.noneYet)}</h2>
        <p>${esc(S.noneYetText)}</p>
        <div class="vacio-botones">${botonSeguir.replace('class="pill"', 'class="pill accent"')}</div>
      </section>`);
  } else {
    pinta(`${cabeza}
      <p class="acciones">${botonSeguir}</p>
      <div class="equipos-lista artistas-lista">${lista.map((x) => {
        const n = x.next;
        const conPagina = !x.hidden && KAr.esSlug(x.slug);
        const proximo = x.hidden ? `<p class="muted">${esc(S.notPublic)}</p>`
          : n && UUID_AR.test(n.offer_id || '')
            ? `<div class="lista">${fila({ href: `${pre}/o/${n.offer_id}`, icono: 'local_activity', titulo: n.title, detalle: KAr.linea(n, LANG) })}</div>`
            : `<p class="muted">${esc(S.noNext)}</p>`;
        return `<section class="bloque equipo artista">
          <div class="art-fila">${avatarArtista(x)}
            <h2>${conPagina ? `<a href="${esc(artistaWeb(x.slug))}">${esc(x.name)}</a>` : esc(x.name)}</h2></div>
          ${proximo}
          <p><button type="button" class="pill" data-dejar="${esc(x.id)}" data-nombre="${esc(x.name)}">${esc(S.unfollow)}</button></p>
        </section>`;
      }).join('')}</div>`);
    // Dejar de seguir se confirma, como en la app.
    $$('[data-dejar]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirma({ titulo: S.unfollow, texto: S.unfollowQ(b.dataset.nombre || ''), aceptar: S.unfollow, peligro: true }))) return;
      ocupado(b, async () => {
        try {
          await llamar('unfollow_artist', { p_artist: b.dataset.dejar });
          toast(S.off(b.dataset.nombre || ''));
          RUTAS.artistas([], new URLSearchParams());
        } catch (e) { toast(errorArtista(e), true); }
      });
    }));
  }
  $$('[data-seguir-artista]').forEach((b) => b.addEventListener('click', () => buscaArtista(() => RUTAS.artistas([], new URLSearchParams()))));
};

/** «Seguir a un artista»: buscar por nombre y seguir o dejar de seguir desde
 * la lista (la misma hoja que los equipos). */
function buscaArtista(alCerrar) {
  const S = SA();
  hojaSeguir({
    titulo: S.followOne,
    etiqueta: S.searchArtist,
    nada: S.noneFoundArtist,
    buscar: (q) => llamar('artist_search', { p_q: q, p_limit: 20 }),
    fila: (x) => ({
      foto: avatarArtista(x),
      detalle: Number(x.upcoming) > 0 ? S.dates(Number(x.upcoming)) : S.noNext,
      si: S.following, no: S.follow,
    }),
    cambia: (id, on) => llamar(on ? 'unfollow_artist' : 'follow_artist', { p_artist: id }),
    error: errorArtista,
    alCerrar,
  });
}
