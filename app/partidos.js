/* «Tu cuenta» → «Equipos que sigues» (#/equipos), como la app
 * (/partidos/equipos; migración 20261201100000_partidos de la app).
 *
 * - La lista con el próximo partido de cada equipo (a su página pública,
 *   /partidos/<id>), «Dejar de seguir» y «Seguir a un equipo», que abre el
 *   buscador (`broadcast_team_search`).
 * - `#/equipos?seguir=<id>&nombre=<nombre>`: lo que manda «Seguir a Real
 *   Madrid» desde la web pública sin sesión. Al entrar, se sigue; si el
 *   enlace no viene de un botón de esta web (sin la marca de
 *   /assets/partidos.js), primero se pregunta (`confirmaEnlace`).
 * - La fila de la portada de la cuenta (`filaEquipos`), debajo de «Series que
 *   sigues».
 *
 * Va después de app.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`, `esc`,
 * `ic`, `fila`, `toast`, `exigeSesion`, `confirmaEnlace`, `ocupado`…). Los
 * textos, de /assets/emisiones.js (los mismos que la app y la web pública).
 */
'use strict';

const KEm = globalThis.KlendarEmisiones;
const SE = () => KEm.t(EN ? 'en' : 'es');
/** sports_soccer (Material Icons, Apache 2.0): no está en la fuente recortada. */
const BALON_SVG = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7V5.3zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34zM7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34-.78 1.37zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11-.7 1.48zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54L14.27 15zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21z';
const icBalon = (s = 24) => `<svg class="ms-svg" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${BALON_SVG}"/></svg>`;
const UUID_EQ = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const partidoWeb = (id) => `${EN ? '/en/matches/' : '/partidos/'}${encodeURIComponent(id)}`;

/** La fila de la portada de «Tu cuenta» (grupo Preferencias). */
function filaEquipos() {
  return `<a class="fila" href="#/equipos">${icBalon()}
    <span class="fila-t"><b>${esc(SE().teamsYouFollow)}</b><small>${esc(EN ? "We'll tell you before each match" : 'Te avisamos antes de cada partido')}</small></span>
    ${ic('chevron_right')}</a>`;
}

const errorEquipo = (e) => (e?.clave === 'too_many'
  ? (EN ? "You're following 30 teams, the maximum. Unfollow one to follow this one." : 'Sigues a 30 equipos, el máximo. Deja alguno para seguir este.')
  : e?.message || amable(''));
const textoSigues = (n) => (EN ? `You're following ${n}. We'll let you know before each match.` : `Sigues a ${n}. Te avisamos antes de cada partido.`);
const textoYaNo = (n) => (EN ? `You're no longer following ${n}.` : `Ya no sigues a ${n}.`);

/** «Equipos que sigues». */
RUTAS.equipos = async (_partes, params) => {
  const S = SE();
  const seguir = params.get('seguir') || '';
  const nombre = String(params.get('nombre') || '').trim().slice(0, 60);
  const aqui = UUID_EQ.test(seguir) ? `equipos?seguir=${encodeURIComponent(seguir)}${nombre ? `&nombre=${encodeURIComponent(nombre)}` : ''}` : 'equipos';
  if (!exigeSesion(aqui)) return;

  // Llega de «Seguir a Real Madrid» (la web pública): se sigue y se quita de
  // la dirección (recargar no lo vuelve a hacer).
  if (UUID_EQ.test(seguir)) {
    const quien = nombre || (EN ? 'this team' : 'este equipo');
    const sigue = await confirmaEnlace(`equipos?seguir=${seguir}`, {
      titulo: S.follow(quien),
      texto: EN ? "We'll let you know before each match which bars nearby are showing it." : 'Te avisamos antes de cada partido con los bares que lo ponen cerca.',
      boton: S.follow(quien),
      volver: '#/equipos',
    });
    if (!sigue) return;
    history.replaceState(null, '', `${location.pathname}${location.search}#/equipos`);
    try {
      await llamar('follow_broadcast_team', { p_team: seguir });
      toast(textoSigues(quien));
    } catch (e) { toast(errorEquipo(e), true); }
  }

  const lista = (await llamar('my_followed_teams', { p_lang: EN ? 'en' : 'es' })) || [];
  const cabeza = `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(S.teamsYouFollow)}</h1>`;
  // Neutro con borde (el coral, solo para el botón principal y las ofertas).
  const botonSeguir = `<button type="button" class="pill" data-seguir-equipo>${esc(S.followTeam)}</button>`;
  if (!lista.length) {
    pinta(`${cabeza}
      <section class="vacio">
        <span class="vacio-ic">${icBalon(30)}</span>
        <h2>${esc(EN ? "You're not following any teams yet" : 'Aún no sigues a ningún equipo')}</h2>
        <p>${esc(S.noTeams)}</p>
        <div class="vacio-botones">${botonSeguir.replace('class="pill"', 'class="pill accent"')}</div>
      </section>`);
  } else {
    const tz = KZ ? KZ.MADRID : undefined;
    const lang = EN ? 'en' : 'es';
    pinta(`${cabeza}
      <p class="acciones">${botonSeguir}</p>
      <div class="equipos-lista">${lista.map((x) => {
        const n = x.next;
        const sub = [x.full_name && x.full_name !== x.name ? x.full_name : '', KEm.deporte(x.sport, lang)].filter(Boolean).join(' · ');
        const proximo = n && UUID_EQ.test(n.id || '')
          ? `<div class="lista">${fila({ href: partidoWeb(n.id), icono: 'explore', titulo: n.title,
            detalle: [KEm.cuandoLargo(n, tz, lang), n.competition].filter(Boolean).join(' · ') })}</div>`
          : `<p class="muted">${esc(EN ? 'No matches coming up for now' : 'Por ahora no hay partidos')}</p>`;
        return `<section class="bloque equipo">
          <h2>${esc(x.name)}</h2>
          ${sub ? `<p class="muted">${esc(sub)}</p>` : ''}
          ${proximo}
          <p><button type="button" class="pill" data-dejar="${esc(x.id)}" data-nombre="${esc(x.name)}">${esc(S.unfollow)}</button></p>
        </section>`;
      }).join('')}</div>`);
    $$('[data-dejar]').forEach((b) => b.addEventListener('click', () => ocupado(b, async () => {
      try {
        await llamar('unfollow_broadcast_team', { p_team: b.dataset.dejar });
        toast(textoYaNo(b.dataset.nombre || ''));
        RUTAS.equipos([], new URLSearchParams());
      } catch (e) { toast(errorEquipo(e), true); }
    })));
  }
  $$('[data-seguir-equipo]').forEach((b) => b.addEventListener('click', () => buscaEquipo(() => RUTAS.equipos([], new URLSearchParams()))));
};

/** «Seguir a un equipo»: buscar (por nombre, siglas o alias) y seguir o
 * dejar de seguir desde la lista. Al cerrar, `alCerrar` (si ha cambiado algo). */
function buscaEquipo(alCerrar) {
  const S = SE();
  const lang = EN ? 'en' : 'es';
  const d = document.createElement('dialog');
  d.className = 'dialogo hoja-equipos';
  d.setAttribute('aria-labelledby', 'eq-t');
  d.innerHTML = `<button type="button" class="cerrar-hoja" aria-label="${esc(t('Cerrar'))}">×</button>
    <h2 id="eq-t">${esc(S.followTeam)}</h2>
    <form class="formu" novalidate><label>${esc(S.searchTeam)}<input name="q" type="search" autocomplete="off" maxlength="40" enterkeyhint="search"></label></form>
    <p class="eq-err" role="alert" hidden></p>
    <div class="eq-res" aria-live="polite"></div>`;
  document.body.appendChild(d);
  const campo = d.querySelector('input[name=q]');
  const res = d.querySelector('.eq-res');
  // Los avisos, dentro del diálogo (el de la página queda detrás).
  const err = d.querySelector('.eq-err');
  const falla = (m) => { err.textContent = m; err.hidden = false; };
  let cambiado = false;
  let pedido = 0;
  let espera = null;
  const pintaRes = (lista, q) => {
    if (q.length < 2) { res.innerHTML = ''; return; }
    if (!lista.length) { res.innerHTML = `<p class="muted eq-nada">${esc(S.noTeamFound)}</p>`; return; }
    res.innerHTML = lista.map((x) => `<div class="eq-fila">
        <span class="eq-t"><b>${esc(x.name)}</b><small>${esc([x.full_name && x.full_name !== x.name ? x.full_name : '', KEm.deporte(x.sport, lang)].filter(Boolean).join(' · '))}</small></span>
        <button type="button" class="pill${x.following ? ' on' : ''}" data-equipo="${esc(x.id)}" data-nombre="${esc(x.name)}" aria-pressed="${x.following ? 'true' : 'false'}">${esc(x.following ? S.following(x.name) : S.follow(x.name))}</button>
      </div>`).join('');
  };
  const busca = async () => {
    const q = campo.value.trim();
    const n = ++pedido;
    if (q.length < 2) { pintaRes([], q); return; }
    try {
      const lista = (await llamar('broadcast_team_search', { p_q: q, p_limit: 20 })) || [];
      if (n === pedido) pintaRes(lista, q);
    } catch (e) { if (n === pedido) res.innerHTML = `<p class="muted">${esc(e.message || amable(''))}</p>`; }
  };
  campo.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(busca, 300); });
  d.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(espera); busca(); });
  res.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button[data-equipo]') : null;
    if (!b || b.disabled) return;
    // Sin `ocupado`: el botón cambia de texto al terminar («Sigues a …»).
    const on = b.getAttribute('aria-pressed') === 'true';
    const nom = b.dataset.nombre || '';
    b.disabled = true;
    llamar(on ? 'unfollow_broadcast_team' : 'follow_broadcast_team', { p_team: b.dataset.equipo }).then(() => {
      cambiado = true;
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      b.classList.toggle('on', !on);
      b.textContent = on ? S.follow(nom) : S.following(nom);
      err.hidden = true;
    }, (e2) => falla(errorEquipo(e2))).then(() => { b.disabled = false; });
  });
  d.querySelector('.cerrar-hoja').onclick = () => d.close();
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => { d.remove(); if (cambiado && alCerrar) alCerrar(); });
  d.showModal();
  campo.focus();
}
