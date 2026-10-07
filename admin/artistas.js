/* Administración → «Artistas» (tanda C; migración 20261205100000_artistas
 * de la app).
 *
 * Los artistas no tienen cuenta: los escribe un negocio en «Quién actúa» (solo
 * el nombre) y su ficha (foto, descripción y enlaces) la cambia SOLO
 * administración. Aquí:
 * - Artistas: la lista con filtro (todos, nuevos sin revisar, sin foto,
 *   ocultos) y buscador; «Editar» (foto a Storage `business-images`, ruta
 *   `artists/<id>/<archivo>`; nombre; descripción ≤ 300; enlaces) y, en su
 *   menú, «Ocultar» / «Mostrar» y «Ver la página».
 * - Repetidos: pares que parecen el mismo («DJ Nano» / «Dj-Nano»,
 *   `admin_artist_duplicates`); se elige cuál se queda y se fusiona
 *   (`admin_merge_artists`): sus eventos, quien lo sigue y su dirección vieja
 *   pasan al que se queda.
 * Arriba: «Añadir un artista» y «Más acciones» (descargar la lista).
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `sb`, `modal`,
 * `confirmDlg`, `table`, `toast`, `esperando`, `params`, `ponUrl`,
 * `menuAcciones`, `itemMenu`, `enlaceMenu`, `debounce`, `downloadCsv`…).
 */
'use strict';

const KAa = () => globalThis.KlendarArtistas;
/** Un texto en los dos idiomas (lo que lleva datos dentro). */
const bi = (es, en) => (I18N.lang === 'en' ? en : es);
const AR = { tab: 'lista', filtro: '', q: '' };
const FILTROS_AR = [['', 'Todos'], ['new', 'Nuevos sin revisar'], ['no_photo', 'Sin foto'], ['hidden', 'Ocultos']];
const ERR_ARTISTA = {
  name_invalid: 'El nombre tiene que tener entre 2 y 60 caracteres, con letras o números.',
  bio_too_long: 'La descripción cabe en 300 caracteres.',
  image_not_allowed: 'Esa foto no se puede usar: súbela desde aquí.',
  not_found: 'Ese artista ya no existe (o se ha fusionado con otro).',
  nothing_to_merge: 'No hay nada que fusionar.',
};
const errArtista = (r) => I18N.t(ERR_ARTISTA[r?.error] || 'No se ha podido completar. Prueba otra vez.');
const paginaArtista = (slug) => `${APP_URL}/a/${encodeURIComponent(slug)}`;
const fotoArtista = (a, tam = 40) => (a?.photo_url
  ? `<img class="thumb art-thumb" src="${esc(a.photo_url)}" alt="" width="${tam}" height="${tam}" loading="lazy">`
  : `<span class="ph art-thumb" aria-hidden="true">${esc(KAa().inicial(a?.name))}</span>`);
const cuandoAr = (iso) => (iso ? KZ.fmt(iso, TZ, LOC(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Sube la foto (reducida en el navegador) a `artists/<id>/…` y da su URL. */
async function subeFotoArtista(id, archivo) {
  if (archivo.size > 20 * 1024 * 1024) throw new Error(I18N.t('Esa foto pesa demasiado. Prueba con otra más pequeña.'));
  const blob = window.KFotos ? await window.KFotos.reduce(archivo, window.KFotos.TAM.logo) : archivo;
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error(I18N.t('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.'));
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const ruta = `artists/${id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('business-images').upload(ruta, blob, { contentType: blob.type });
  if (error) throw new Error(error.message);
  return sb.storage.from('business-images').getPublicUrl(ruta).data.publicUrl;
}

/** «Editar» / «Añadir un artista»: foto, nombre, descripción y enlaces.
 * Devuelve true si se ha guardado. */
function editaArtista(a) {
  return new Promise((resolve) => {
    const d = $('#modal');
    let foto = a?.photo_url || '';
    let archivo = null;
    const links = a?.links || {};
    d.classList.add('ancho');
    d.innerHTML = `<form method="dialog" novalidate>
      <h2>${esc(a ? bi(`Editar «${a.name}»`, `Edit “${a.name}”`) : I18N.t('Añadir un artista'))}</h2>
      <p class="muted" style="margin:0">${esc(I18N.t('Lo que escribe un negocio en «Quién actúa» solo pone el nombre: la ficha solo se cambia aquí.'))}</p>
      <fieldset class="grupo"><legend>${esc(I18N.t('Foto'))}</legend>
        <div class="art-foto-fila"><span id="arFotoVer"></span>
          <span class="actions"><label class="btn sm"><input type="file" id="arFoto" accept="image/jpeg,image/png,image/webp" hidden>${esc(I18N.t('Subir foto'))}</label>
          <button type="button" class="btn sm ghost" id="arSinFoto">${esc(I18N.t('Quitar foto'))}</button></span></div>
      </fieldset>
      <fieldset class="grupo"><legend>${esc(I18N.t('Nombre y descripción'))}</legend><div class="grupo-campos">
        <label class="f ancho"><span>${esc(I18N.t('Nombre'))}</span><input name="name" maxlength="60" required value="${esc(a?.name || '')}"></label>
        <label class="f ancho"><span>${esc(I18N.t('Descripción breve'))} <small id="arCuenta"></small></span><textarea name="bio" maxlength="300" rows="4">${esc(a?.bio || '')}</textarea></label>
      </div></fieldset>
      <fieldset class="grupo"><legend>${esc(I18N.t('Enlaces (opcionales)'))}</legend>
        <p class="muted small grupo-nota">${esc(I18N.t('Solo https. En Instagram y TikTok vale el usuario (@djnano).'))}</p>
        <div class="grupo-campos c2">${KAa().REDES.map(([k, n]) => `<label class="f"><span>${esc(n)}</span><input name="l_${k}" type="url" inputmode="url" maxlength="300" spellcheck="false" placeholder="https://" value="${esc(links[k] || '')}"></label>`).join('')}</div>
      </fieldset>
      <p class="err" id="arErr" role="alert"></p>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(I18N.t('Cancelar'))}</button><button type="submit" class="btn primary">${esc(I18N.t('Guardar'))}</button></div>
    </form>`;
    const form = $('form', d);
    const pintaFoto = () => {
      const url = archivo ? URL.createObjectURL(archivo) : foto;
      $('#arFotoVer', d).innerHTML = fotoArtista({ photo_url: url, name: form.elements.name.value || a?.name }, 72);
      $('#arSinFoto', d).hidden = !archivo && !foto;
    };
    const cuenta = () => { $('#arCuenta', d).textContent = `${form.elements.bio.value.length}/300`; };
    $('#arFoto', d).onchange = (e) => { archivo = e.target.files[0] || null; pintaFoto(); };
    $('#arSinFoto', d).onclick = () => { archivo = null; foto = ''; $('#arFoto', d).value = ''; pintaFoto(); };
    form.elements.bio.oninput = cuenta;
    pintaFoto(); cuenta();
    const cerrar = (v) => { d.classList.remove('ancho'); d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => cerrar(false);
    d.oncancel = (e) => { e.preventDefault(); cerrar(false); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const boton = $('button[type=submit]', form);
      if (boton.disabled) return;
      const nombre = form.elements.name.value.trim();
      const bio = form.elements.bio.value.trim();
      const err = $('#arErr', d);
      err.textContent = '';
      if (nombre.length < 2) { err.textContent = I18N.t(ERR_ARTISTA.name_invalid); form.elements.name.focus(); return; }
      const enlaces = Object.fromEntries(KAa().REDES.map(([k]) => [k, form.elements[`l_${k}`].value.trim()]).filter(([, x]) => x));
      boton.disabled = true;
      try {
        let id = a?.id || null;
        // Nuevo con foto: primero sin ella, para tener su id (la ruta lo lleva).
        if (!id && archivo) {
          const r0 = await rpc('admin_save_artist', { p_id: null, p_name: nombre, p_bio: bio || null, p_photo_url: null, p_links: enlaces });
          if (r0?.ok === false) { err.textContent = errArtista(r0); return; }
          id = r0.id;
        }
        if (archivo) foto = await subeFotoArtista(id, archivo);
        const r = await rpc('admin_save_artist', { p_id: id, p_name: nombre, p_bio: bio || null, p_photo_url: foto || null, p_links: enlaces });
        if (r?.ok === false) { err.textContent = errArtista(r); return; }
        // Los enlaces que la base no acepta (no https, mal escritos) se caen.
        const caidos = Object.keys(enlaces).filter((k) => !(r.links || {})[k]);
        toast(caidos.length ? bi(`Guardado. Estos enlaces no valen y no se han guardado: ${caidos.join(', ')}`, `Saved. These links aren't valid and weren't saved: ${caidos.join(', ')}`) : I18N.t('Guardado'), caidos.length > 0);
        cerrar(true);
      } catch (e2) {
        err.textContent = e2.message || I18N.t('No se ha podido completar. Prueba otra vez.');
      } finally { boton.disabled = false; }
    };
    I18N.translate(d);
    d.showModal();
    form.elements.name.focus();
  });
}

PAGES.artistas = async (v) => {
  const p = params();
  if (['lista', 'repetidos'].includes(p.tab)) AR.tab = p.tab;
  if (p.filtro != null) AR.filtro = FILTROS_AR.some(([k]) => k === p.filtro) ? p.filtro : '';
  const aUrl = () => ponUrl('artistas', { tab: AR.tab === 'lista' ? null : AR.tab, filtro: AR.tab === 'lista' && AR.filtro ? AR.filtro : null });
  aUrl();
  let filas = [];
  v.innerHTML = `
    <div class="page-head"><h1>Artistas</h1><span class="spacer"></span>
      <button class="btn primary sm" type="button" id="arNuevo">Añadir un artista</button>
      ${menuAcciones([itemMenu('data-ar-csv', esc(I18N.t('Descargar la lista (CSV)')))], { sm: true })}</div>
    ${helpBox('¿Qué hago aquí?', bi(
    '<p>Los artistas no tienen cuenta: un negocio los pone en <b>«Quién actúa»</b> de un evento, y lo que escribe <b>solo crea el nombre</b>. La foto, la descripción y los enlaces se cambian <b>solo aquí</b>. Revisa los <b>nuevos sin revisar</b> (escritos por negocios): ponles foto si la hay con permiso, corrige el nombre u ocúltalos si no son un artista. Quien sigue a un artista recibe un aviso cuando tiene una fecha nueva cerca. En <b>Repetidos</b>, los que parecen el mismo («DJ Nano» / «Dj-Nano»): al fusionarlos, sus eventos, quien los sigue y su dirección vieja pasan al que se queda.</p>',
    '<p>Artists don\'t have accounts: a business adds them under <b>“Who\'s performing”</b> on an event, and what it types <b>only creates the name</b>. The photo, description and links are changed <b>only here</b>. Check the <b>new, unreviewed</b> ones (typed by businesses): add a photo if there is one you\'re allowed to use, fix the name or hide them if they aren\'t an artist. People who follow an artist get notified when they have a new date nearby. Under <b>Duplicates</b>, the ones that look the same (“DJ Nano” / “Dj-Nano”): merging moves their events, followers and old address to the one you keep.</p>'))}
    <div class="tabs">${[['lista', 'Artistas'], ['repetidos', 'Repetidos']].map((t) => `<button type="button" data-t="${t[0]}" class="${AR.tab === t[0] ? 'on' : ''}" aria-pressed="${AR.tab === t[0]}">${t[1]}</button>`).join('')}</div>
    <div id="tabview"></div>`;

  const load = async () => {
    const tv = $('#tabview', v);
    tv.innerHTML = '<div class="loading">Cargando…</div>';
    I18N.translate(tv);
    if (AR.tab === 'repetidos') await repetidos(tv); else await lista(tv);
    I18N.translate(tv);
  };

  async function lista(tv) {
    tv.innerHTML = `<div class="toolbar">
        <select id="arFiltro" aria-label="${esc(I18N.t('Filtro'))}">${FILTROS_AR.map((o) => `<option value="${o[0]}" ${AR.filtro === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
        <input class="grow" type="search" id="arQ" value="${esc(AR.q)}" placeholder="Buscar artista" aria-label="Buscar artista">
      </div><div id="list"><div class="loading">Cargando…</div></div>`;
    const pinta = async () => {
      filas = (await rpc('admin_artists', { p_q: AR.q.trim() || null, p_filter: AR.filtro || null, p_limit: 200 })) || [];
      $('#list', tv).innerHTML = table({ cols: [
        { h: 'Artista', r: (a) => `<span class="art-celda">${fotoArtista(a)}<span class="title">${esc(a.name)}${a.hidden ? ` <span class="tag dim">${esc(I18N.t('oculto'))}</span>` : ''}${!a.edited && !a.hidden ? ` <span class="tag">${esc(I18N.t('sin revisar'))}</span>` : ''}<span class="sub">${esc(a.bio ? a.bio.slice(0, 80) + (a.bio.length > 80 ? '…' : '') : I18N.t('Sin descripción'))}</span></span></span>` },
        { h: 'Lo escribió', r: (a) => (a.created_by_business ? `${esc(a.created_by_business.name)}<span class="sub">${esc(a.created_by_business.city || '')} · ${esc(cuandoAr(a.created_at))}</span>` : `${esc(I18N.t('Administración'))}<span class="sub">${esc(cuandoAr(a.created_at))}</span>`) },
        { h: 'Próximas', num: true, r: (a) => `${fmtNum(a.events_upcoming)}<span class="sub">${esc(bi(`de ${fmtNum(a.events_total)}`, `of ${fmtNum(a.events_total)}`))}</span>` },
        { h: 'Lo siguen', num: true, r: (a) => fmtNum(a.followers) },
        { h: '', r: (a) => `<span class="actions"><button class="btn sm" type="button" data-editar="${esc(a.id)}">Editar</button>
          ${menuAcciones([
            itemMenu(`data-ocultar="${esc(a.id)}" data-oculto="${a.hidden ? '1' : '0'}"`, esc(I18N.t(a.hidden ? 'Mostrar' : 'Ocultar'))),
            a.hidden ? '' : enlaceMenu(paginaArtista(a.slug), `${esc(I18N.t('Ver la página'))} ↗`, true),
          ], { icono: true, sm: true })}</span>` },
      ], rows: filas, empty: AR.q.trim() || AR.filtro ? 'Ningún artista con esos filtros.' : 'Todavía no hay artistas: aparecen cuando un negocio pone «Quién actúa» en un evento.' });
      $$('[data-editar]', tv).forEach((btn) => { btn.onclick = () => esperando(btn, async () => { if (await editaArtista(filas.find((x) => x.id === btn.dataset.editar))) pinta(); }); });
      $$('[data-ocultar]', tv).forEach((btn) => {
        btn.onclick = () => esperando(btn, async () => {
          const ocultar = btn.dataset.oculto !== '1';
          const a = filas.find((x) => x.id === btn.dataset.ocultar);
          if (ocultar && !await confirmDlg(bi(`Ocultar «${a?.name || ''}»`, `Hide “${a?.name || ''}”`), esc(I18N.t('Sin página, fuera de la búsqueda y de las fichas de los eventos, y sin avisos. Quien lo sigue puede dejarlo. Se puede volver a mostrar.')), { submit: I18N.t('Ocultar') })) return;
          try {
            const r = await rpc('admin_hide_artist', { p_id: btn.dataset.ocultar, p_hidden: ocultar });
            if (r?.ok === false) { toast(errArtista(r), true); return; }
            toast(ocultar ? 'Ocultado' : 'Visible de nuevo');
            pinta();
          } catch (e) { toast(e.message, true); }
        });
      });
      I18N.translate($('#list', tv));
    };
    $('#arFiltro', tv).onchange = (e) => { AR.filtro = e.target.value; aUrl(); pinta(); };
    $('#arQ', tv).oninput = debounce((e) => { AR.q = e.target.value; pinta(); });
    await pinta();
  }

  async function repetidos(tv) {
    const pares = (await rpc('admin_artist_duplicates', { p_limit: 50 })) || [];
    const lado = (x) => `<span class="art-celda">${fotoArtista(x, 48)}<span class="title">${esc(x.name)}<span class="sub">${esc(bi(x.events === 1 ? '1 evento' : `${fmtNum(x.events)} eventos`, x.events === 1 ? '1 event' : `${fmtNum(x.events)} events`))} · /a/${esc(x.slug)}</span></span></span>`;
    tv.innerHTML = pares.length ? pares.map((par, i) => `<div class="card art-par">
        <p class="muted small" style="margin:0 0 10px">${esc(bi(`Parecido: ${Math.round(Number(par.similarity) * 100)} %`, `Similarity: ${Math.round(Number(par.similarity) * 100)}%`))}</p>
        <div class="art-par-lados">${lado(par.a)}${lado(par.b)}</div>
        <div class="actions" style="margin-top:12px">
          <button class="btn sm" type="button" data-queda="${i}" data-lado="a">${esc(bi(`Quedarse con «${par.a.name}»`, `Keep “${par.a.name}”`))}</button>
          <button class="btn sm" type="button" data-queda="${i}" data-lado="b">${esc(bi(`Quedarse con «${par.b.name}»`, `Keep “${par.b.name}”`))}</button>
        </div></div>`).join('')
      : `<div class="card"><p class="muted" style="margin:0">${esc(I18N.t('No hay artistas que parezcan repetidos.'))}</p></div>`;
    $$('[data-queda]', tv).forEach((btn) => {
      btn.onclick = () => esperando(btn, async () => {
        const par = pares[Number(btn.dataset.queda)];
        const queda = btn.dataset.lado === 'a' ? par.a : par.b;
        const va = btn.dataset.lado === 'a' ? par.b : par.a;
        if (!await confirmDlg(bi('Fusionar artistas', 'Merge artists'), esc(bi(
          `Se queda «${queda.name}». Los eventos de «${va.name}», quien lo sigue y su dirección (/a/${va.slug}) pasan a «${queda.name}». No se puede deshacer.`,
          `“${queda.name}” stays. “${va.name}”'s events, followers and address (/a/${va.slug}) move to “${queda.name}”. This can't be undone.`)), { submit: I18N.t('Fusionar'), danger: true })) return;
        try {
          const r = await rpc('admin_merge_artists', { p_target: queda.id, p_sources: [va.id] });
          if (r?.ok === false) { toast(errArtista(r), true); return; }
          toast(bi(`Fusionados: ${fmtNum(r.events)} eventos y ${fmtNum(r.follows)} personas pasan a «${queda.name}».`, `Merged: ${fmtNum(r.events)} events and ${fmtNum(r.follows)} followers move to “${queda.name}”.`));
          load();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  $$('.tabs button', v).forEach((b) => {
    b.onclick = () => {
      AR.tab = b.dataset.t; aUrl();
      $$('.tabs button', v).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      load();
    };
  });
  $('#arNuevo', v).onclick = (e) => esperando(e.currentTarget, async () => {
    if (await editaArtista(null)) { AR.tab = 'lista'; aUrl(); route(); }
  });
  $('[data-ar-csv]', v).onclick = () => {
    if (AR.tab !== 'lista' || !filas.length) { toast(I18N.t('No hay nada que descargar.')); return; }
    downloadCsv('artistas', filas, [['name', 'Nombre'], ['slug', 'Dirección'], [(a) => (a.hidden ? 'sí' : ''), 'Oculto'], [(a) => (a.edited ? 'sí' : ''), 'Revisado'],
      [(a) => a.created_by_business?.name || '', 'Lo escribió'], ['events_upcoming', 'Próximas'], ['events_total', 'Eventos'], ['followers', 'Lo siguen'], ['created_at', 'Alta']]);
  };
  await load();
};

// admin.js arranca (`boot()`) antes de que llegue este archivo: si ya ha
// pintado otra pantalla estando en «Artistas», se vuelve a pintar esta.
if (ME && currentRoute()[0] === 'artistas' && !$('#view #arNuevo')) route();
