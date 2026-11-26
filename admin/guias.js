/* Administración → Contenido → «Guías» (guías de temporada, migración
 * 20261283800000 de la app; RUNBOOK §4zo).
 *
 * «Navidad en Málaga», «Semana Santa», «Feria de Agosto»… Aquí:
 * - la lista (vivas, por empezar, terminadas y archivadas) con cuántas
 *   publicaciones tiene y cuántas puso un negocio;
 * Una guía es GENERAL (Iván, 17-11; migración 20261283900000): una sola
 * «Navidad» que cada sitio llena con sus planes; se ve «Navidad en Málaga»
 * según dónde mira cada uno.
 * - «Nueva guía…» / «Editar…»: título y texto corto (español y, si quieres,
 *   inglés; no pasan por la traducción con IA), «Añadir «en {sitio}» al
 *   título» (se apaga si el título no lo admite), foto de portada (Storage
 *   `business-images/guides/<id>/…`), ámbito (toda España, una comunidad o
 *   una provincia), primer y último día y su slug (`klendar.app/guia/<slug>`).
 *   Guardar una archivada la vuelve a poner viva: así se reutiliza el año
 *   siguiente con otras fechas;
 * - «Publicaciones…»: filtrar por sitio, añadir y quitar a mano. Lo que
 *   quites de un negocio queda fuera y el negocio no lo puede volver a poner;
 * - «Archivar» / «Recuperar» y «Ver la página».
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `sb`, `esc`, `$`,
 * `$$`, `table`, `toast`, `esperando`, `confirmDlg`, `helpBox`, `go`,
 * `route`, `debounce`, `I18N`, `APP_URL`, `LABELS`, `modTag`).
 */
'use strict';

const biG = (es, en) => (I18N.lang === 'en' ? en : es);
const ERR_GUIA = {
  slug_invalid: ['El slug solo lleva minúsculas, números y guiones (de 3 a 60): navidad-en-malaga.', 'The slug only takes lowercase letters, numbers and hyphens (3 to 60): navidad-en-malaga.'],
  slug_taken: ['Ese slug ya lo usa otra guía o colección.', 'Another guide or collection already uses that slug.'],
  title_invalid: ['El título va de 3 a 80 caracteres.', 'The title takes 3 to 80 characters.'],
  text_too_long: ['El texto corto cabe en 280 caracteres.', 'The short text fits in 280 characters.'],
  image_not_allowed: ['Esa foto no se puede usar: súbela desde aquí.', 'That photo cannot be used: upload it from here.'],
  place_invalid: ['Elige toda España, una comunidad o una provincia.', 'Pick all of Spain, a region or a province.'],
  dates_invalid: ['Las fechas no cuadran: el último día no puede ir antes del primero (y como mucho 120 días).', "The dates don't add up: the last day can't be before the first (and 120 days at most)."],
  not_found: ['Esa guía ya no existe.', 'That guide no longer exists.'],
};
const errGuia = (r) => {
  const e = ERR_GUIA[r?.error];
  return e ? biG(e[0], e[1]) : biG('No se ha podido completar. Prueba otra vez.', "Couldn't complete it. Try again.");
};
const tituloGuia = (g) => (I18N.lang === 'en' ? g?.title?.en || g?.title?.es : g?.title?.es) || g?.slug || '';
const diaGuia = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString(I18N.lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const paginaGuia = (slug) => `${APP_URL}/guia/${encodeURIComponent(slug)}`;
const estadoGuia = (g) => (g.archived_at
  ? `<span class="tag dim">${esc(biG('Archivada', 'Archived'))}</span>`
  : g.status === 'live' ? `<span class="tag ok">${esc(biG('En marcha', 'Live'))}</span>`
    : g.status === 'soon' ? `<span class="tag">${esc(biG('Por empezar', 'Upcoming'))}</span>`
      : `<span class="tag dim">${esc(biG('Terminada', 'Ended'))}</span>`);

/** Sube la portada (reducida en el navegador) a `guides/<id>/…` y da su URL. */
async function subePortadaGuia(id, archivo) {
  if (archivo.size > 20 * 1024 * 1024) throw new Error(biG('Esa foto pesa demasiado. Prueba con otra más pequeña.', 'That photo is too big. Try a smaller one.'));
  const blob = window.KFotos ? await window.KFotos.reduce(archivo, window.KFotos.TAM.foto) : archivo;
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error(biG('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.', "That image can't be opened. Try a JPG or PNG photo."));
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const ruta = `guides/${id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('business-images').upload(ruta, blob, { contentType: blob.type });
  if (error) throw new Error(error.message);
  return sb.storage.from('business-images').getPublicUrl(ruta).data.publicUrl;
}

/** «Nueva guía…» / «Editar…». Devuelve true si se ha guardado. */
function editaGuia(g) {
  return new Promise((resolve) => {
    const d = $('#modal');
    let foto = g?.cover_url || '';
    let archivo = null;
    const ambito = g?.region ? `r:${g.region}` : g?.province ? `p:${g.province}` : '';
    d.classList.add('ancho');
    d.innerHTML = `<form method="dialog" novalidate>
      <h2>${esc(g ? biG(`Editar «${tituloGuia(g)}»`, `Edit “${tituloGuia(g)}”`) : biG('Nueva guía', 'New guide'))}</h2>
      ${g?.archived_at ? `<p class="muted" style="margin:0">${esc(biG('Está archivada: al guardar vuelve a estar viva (cambia las fechas para reutilizarla).', "It's archived: saving makes it live again (change the dates to reuse it)."))}</p>` : ''}
      <fieldset class="grupo"><legend>${esc(biG('Nombre y texto', 'Name and text'))}</legend><div class="grupo-campos c2">
        <label class="f"><span>${esc(biG('Título (español)', 'Title (Spanish)'))}</span><input name="t_es" maxlength="80" required value="${esc(g?.title?.es || '')}" placeholder="Navidad en Málaga"></label>
        <label class="f"><span>${esc(biG('Título (inglés, opcional)', 'Title (English, optional)'))}</span><input name="t_en" maxlength="80" value="${esc(g?.title?.en || '')}" placeholder="Christmas in Málaga"></label>
        <label class="f"><span>${esc(biG('Texto corto (español)', 'Short text (Spanish)'))} <small data-cuenta="x_es"></small></span><textarea name="x_es" maxlength="280" rows="3">${esc(g?.text?.es || '')}</textarea></label>
        <label class="f"><span>${esc(biG('Texto corto (inglés, opcional)', 'Short text (English, optional)'))} <small data-cuenta="x_en"></small></span><textarea name="x_en" maxlength="280" rows="3">${esc(g?.text?.en || '')}</textarea></label>
        <label class="f ancho opcion"><input type="checkbox" name="title_place" ${g?.title_place === false ? '' : 'checked'}>
          <span>${esc(biG('Añadir «en {sitio}» al título («Navidad» se ve «Navidad en Málaga» según dónde mira cada uno)', 'Add “in {place}” to the title (“Christmas” shows as “Christmas in Málaga” depending on where each person is)'))}</span></label>
        <label class="f ancho"><span>${esc(biG('Slug (la dirección: klendar.app/guia/…)', 'Slug (the address: klendar.app/guia/…)'))}</span><input name="slug" maxlength="60" required spellcheck="false" value="${esc(g?.slug || '')}" placeholder="navidad-en-malaga"></label>
      </div></fieldset>
      <fieldset class="grupo"><legend>${esc(biG('Foto de portada', 'Cover photo'))}</legend>
        <div class="art-foto-fila"><span id="guFotoVer"></span>
          <span class="actions"><label class="btn sm"><input type="file" id="guFoto" accept="image/jpeg,image/png,image/webp" hidden>${esc(biG('Subir foto', 'Upload photo'))}</label>
          <button type="button" class="btn sm ghost" id="guSinFoto">${esc(biG('Quitar foto', 'Remove photo'))}</button></span></div>
      </fieldset>
      <fieldset class="grupo"><legend>${esc(biG('Dónde y cuándo', 'Where and when'))}</legend><div class="grupo-campos c2">
        <label class="f ancho"><span>${esc(biG('Ámbito', 'Scope'))}</span><select name="ambito" id="guAmbito"><option value="">${esc(biG('Toda España', 'All of Spain'))}</option></select></label>
        <label class="f"><span>${esc(biG('Primer día', 'First day'))}</span><input name="desde" type="date" required value="${esc(g?.starts_on || '')}"></label>
        <label class="f"><span>${esc(biG('Último día', 'Last day'))}</span><input name="hasta" type="date" required value="${esc(g?.ends_on || '')}"></label>
      </div><p class="muted small grupo-nota">${esc(biG('Una sola guía para todos los sitios del ámbito: cada negocio de allí ve «Añadir a…» al publicar algo de esas fechas, y en Descubre sale a quien tenga en su zona los planes mínimos (app_config.guides.min_plans, 3).', 'One guide for every place in the scope: each business there sees “Add to…” when publishing something on those dates, and it shows in Discover to people with the minimum plans in their area (app_config.guides.min_plans, 3).'))}</p></fieldset>
      <p class="err" id="guErr" role="alert"></p>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(biG('Cancelar', 'Cancel'))}</button><button type="submit" class="btn primary">${esc(biG('Guardar', 'Save'))}</button></div>
    </form>`;
    const form = $('form', d);
    const pintaFoto = () => {
      const url = archivo ? URL.createObjectURL(archivo) : foto;
      $('#guFotoVer', d).innerHTML = url ? `<img class="thumb" src="${esc(url)}" alt="" width="128" height="72" style="object-fit:cover;border-radius:8px">` : `<span class="muted">${esc(biG('Sin foto', 'No photo'))}</span>`;
      $('#guSinFoto', d).hidden = !archivo && !foto;
    };
    const cuentas = () => $$('[data-cuenta]', d).forEach((s) => { s.textContent = `${form.elements[s.dataset.cuenta].value.length}/280`; });
    $('#guFoto', d).onchange = (e) => { archivo = e.target.files[0] || null; pintaFoto(); };
    $('#guSinFoto', d).onclick = () => { archivo = null; foto = ''; $('#guFoto', d).value = ''; pintaFoto(); };
    form.elements.x_es.oninput = cuentas;
    form.elements.x_en.oninput = cuentas;
    // El slug sale del título mientras no se toque a mano.
    let slugAMano = Boolean(g);
    form.elements.slug.oninput = () => { slugAMano = true; };
    form.elements.t_es.oninput = () => {
      if (slugAMano) return;
      form.elements.slug.value = form.elements.t_es.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    };
    // El ámbito: toda España, las comunidades y las provincias.
    rpc('admin_guide_places', { p_q: '' }).then((r) => {
      const sel = $('#guAmbito', d);
      const grupo = (k, t) => {
        const xs = (r || []).filter((x) => x.kind === k);
        return xs.length ? `<optgroup label="${esc(t)}">${xs.map((x) => `<option value="${esc(x.place)}">${esc(x.name)}</option>`).join('')}</optgroup>` : '';
      };
      sel.insertAdjacentHTML('beforeend', grupo('region', biG('Comunidades', 'Regions')) + grupo('province', biG('Provincias', 'Provinces')));
      sel.value = ambito;
    }).catch(() => {});
    pintaFoto(); cuentas();
    const cerrar = (v) => { d.classList.remove('ancho'); d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => cerrar(false);
    d.oncancel = (e) => { e.preventDefault(); cerrar(false); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const boton = $('button[type=submit]', form);
      if (boton.disabled) return;
      const err = $('#guErr', d);
      err.textContent = '';
      const args = (id, cover) => ({
        p_id: id, p_slug: form.elements.slug.value.trim(),
        p_title: { es: form.elements.t_es.value.trim(), en: form.elements.t_en.value.trim() || null },
        p_text: { es: form.elements.x_es.value.trim() || null, en: form.elements.x_en.value.trim() || null },
        p_cover_url: cover || null, p_place: form.elements.ambito.value || null,
        p_starts_on: form.elements.desde.value || null, p_ends_on: form.elements.hasta.value || null,
        p_title_place: form.elements.title_place.checked,
      });
      ocupa(boton, true);
      try {
        let id = g?.id || null;
        // Nueva con foto: primero sin ella, para tener su id (la ruta lo lleva).
        if (!id && archivo) {
          const r0 = await rpc('admin_save_guide', args(null, null));
          if (r0?.ok === false) { err.textContent = errGuia(r0); return; }
          id = r0.id;
        }
        if (archivo) foto = await subePortadaGuia(id, archivo);
        const r = await rpc('admin_save_guide', args(id, foto));
        if (r?.ok === false) { err.textContent = errGuia(r); return; }
        toast(biG('Guía guardada', 'Guide saved'));
        cerrar(true);
      } catch (e2) {
        err.textContent = e2.message || errGuia(null);
      } finally { ocupa(boton, false); }
    };
    I18N.translate(d);
    d.showModal();
    form.elements.t_es.focus();
  });
}

PAGES.guias = async (v, param) => {
  const guias = await rpc('admin_guides');
  if (param) return pintaGuia(v, (guias || []).find((g) => g.id === param));
  const byId = Object.fromEntries((guias || []).map((g) => [g.id, g]));
  v.innerHTML = `
    <div class="page-head"><h1>${esc(biG('Guías de temporada', 'Seasonal guides'))}</h1><span class="spacer"></span><button class="btn primary sm" id="nuevaGuia">${esc(biG('Nueva guía…', 'New guide…'))}</button></div>
    ${helpBox(biG('¿Qué es esto?', 'What is this?'), biG(
    '<p>«Navidad», «Semana Santa», «Feria de Agosto»: <b>una sola guía</b> con <b>fechas</b> y <b>portada</b> para toda España (o una comunidad o provincia) que cada sitio va llenando. Se ve «Navidad en Málaga» según dónde mira cada uno. Sale en Descubre como una tarjeta grande a quien tenga en su zona al menos 3 planes de la guía y tiene su página en <code>klendar.app/guia/…</code>, con una por municipio con planes (<code>…/guia/navidad/malaga</code>).</p><p>La llenan los negocios: al publicar algo de esas fechas, los de allí ven «Añadir a…» (desmarcada). No hay revisión previa: si algo no encaja, quítalo en «Publicaciones…» y ya no lo podrán volver a poner. Solo entra lo que ven todos (nunca una exclusiva).</p><p>Para <b>el año siguiente</b>: «Editar…», nuevas fechas y Guardar. «Archivar» la cierra antes de tiempo.</p>',
    '<p>“Christmas”, “Holy Week”, “August Fair”: <b>one guide</b> with <b>dates</b> and a <b>cover</b> for all of Spain (or a region or province) that each place fills up. It shows as “Christmas in Málaga” depending on where each person is. It appears in Discover as a big card to people with at least 3 of its plans in their area and has its page at <code>klendar.app/guia/…</code>, plus one per municipality with plans (<code>…/guia/navidad/malaga</code>).</p><p>Businesses fill it: when they publish something on those dates, the ones there see “Add to…” (unticked). There is no prior review: if something doesn\'t fit, remove it in “Publications…” and they won\'t be able to add it again. Only what everyone can see goes in (never an exclusive).</p><p>For <b>next year</b>: “Edit…”, new dates and Save. “Archive” closes it early.</p>'))}
    ${table({ cols: [
      { h: biG('Guía', 'Guide'), r: (g) => `<span class="title">${esc(tituloGuia(g))}<span class="sub">${esc(g.slug)} · ${esc(g.scope_name || biG('Toda España', 'All of Spain'))}${g.title_place === false ? '' : ` · ${esc(biG('«… en {sitio}»', '“… in {place}”'))}`}</span></span>` },
      { h: biG('Fechas', 'Dates'), r: (g) => `<span class="small nowrap">${esc(diaGuia(g.starts_on))} → ${esc(diaGuia(g.ends_on))}</span>` },
      { h: biG('Estado', 'Status'), r: estadoGuia },
      { h: biG('Publicaciones', 'Publications'), num: true, r: (g) => `${esc(String(g.count ?? 0))} / ${esc(String(g.items ?? 0))}${g.from_business ? `<span class="sub">${esc(biG(`${g.from_business} de negocios`, `${g.from_business} from businesses`))}</span>` : ''}` },
      { h: '', r: (g) => `<span class="actions"><a class="btn sm" href="/guias/${esc(g.id)}">${esc(biG('Publicaciones…', 'Publications…'))}</a><button class="btn sm" data-edit="${esc(g.id)}">${esc(biG('Editar…', 'Edit…'))}</button><a class="btn sm ghost" href="${esc(paginaGuia(g.slug))}" target="_blank" rel="noopener">${esc(biG('Ver la página', 'See the page'))}</a><button class="btn sm ghost${g.archived_at ? '' : ' bad'}" data-arch="${esc(g.id)}">${esc(g.archived_at ? biG('Recuperar', 'Restore') : biG('Archivar', 'Archive'))}</button></span>` },
    ], rows: guias || [], empty: biG('Todavía no hay guías.', 'No guides yet.') })}
    <p class="muted small">${esc(biG('Publicaciones: las que se ven ahora / todas las que tiene.', 'Publications: those showing now / all it has.'))}</p>`;
  $('#nuevaGuia', v).onclick = async () => { if (await editaGuia(null)) route(); };
  $$('[data-edit]', v).forEach((b) => { b.onclick = () => esperando(b, async () => { if (await editaGuia(byId[b.dataset.edit])) route(); }); });
  $$('[data-arch]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const g = byId[b.dataset.arch];
      const archivar = !g.archived_at;
      if (archivar && !await confirmDlg(biG('Archivar la guía', 'Archive the guide'), esc(biG('Deja de salir en Descubre y su página dice que ha terminado. Las publicaciones no se tocan.', 'It stops showing in Discover and its page says it has ended. Publications are not touched.')), { danger: true, submit: biG('Archivar', 'Archive') })) return;
      const r = await rpc('admin_archive_guide', { p_id: g.id, p_archived: archivar }).catch((e) => ({ ok: false, error: e.message }));
      if (r?.ok === false) { toast(errGuia(r), true); return; }
      toast(archivar ? biG('Archivada', 'Archived') : biG('Recuperada', 'Restored'));
      route();
    });
  });
};

/** Las publicaciones de una guía: las que hay (y quién las puso) y añadir a mano. */
async function pintaGuia(v, g) {
  if (!g) { go('/guias'); return; }
  let busqueda = '';
  let sitio = '';
  const dibuja = async () => {
    const [dentro, fuera] = await Promise.all([
      rpc('admin_collection_items', { p_collection: g.id }),
      busqueda.trim().length >= 2
        ? rpc('admin_offers_page', {
          p_moderation: 'all', p_status: 'all', p_kind: 'all',
          p_query: busqueda.trim(), p_business: null, p_limit: 15, p_offset: 0,
        }).catch((e) => { if (!e?.obsoleta) toast(e.message, true); return { rows: [] }; })
        : Promise.resolve({ rows: [] }),
    ]);
    const todas = dentro?.items || [];
    const sitioDe = (x) => [x.municipality || x.city, x.province].filter(Boolean).join(', ');
    const sitios = [...new Set(todas.map(sitioDe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    if (sitio && !sitios.includes(sitio)) sitio = '';
    const items = sitio ? todas.filter((x) => sitioDe(x) === sitio) : todas;
    const ya = new Set(todas.map((x) => x.offer_id));
    const candidatas = (fuera?.rows || []).filter((o) => !ya.has(o.id));
    const qAntes = $('#q', v);
    const escribiendo = qAntes && document.activeElement === qAntes;
    const cursor = escribiendo ? qAntes.selectionStart : null;
    if (qAntes) busqueda = qAntes.value;
    v.innerHTML = `
      <div class="page-head"><a class="btn sm ghost" href="/guias">← ${esc(biG('Guías', 'Guides'))}</a>
        <h1>${esc(tituloGuia(g))}</h1></div>
      <p class="muted">${esc([g.scope_name || biG('Toda España', 'All of Spain'), `${diaGuia(g.starts_on)} → ${diaGuia(g.ends_on)}`].join(' · '))}</p>
      <div class="card"><h2>${esc(biG('En la guía', 'In the guide'))}</h2>
        ${sitios.length > 1 ? `<label class="f"><span>${esc(biG('Sitio', 'Place'))}</span><select id="guSitio"><option value="">${esc(biG(`Todos (${todas.length})`, `All (${todas.length})`))}</option>${sitios.map((x) => `<option value="${esc(x)}"${x === sitio ? ' selected' : ''}>${esc(x)} (${todas.filter((y) => sitioDe(y) === x).length})</option>`).join('')}</select></label>` : ''}
        ${table({
        cols: [
          { h: biG('Publicación', 'Publication'), r: (x) => `<span class="title">${esc(x.title)}<span class="sub">${esc(x.business_name || '')}${sitioDe(x) ? ` · ${esc(sitioDe(x))}` : ''}</span></span>` },
          { h: biG('Cuándo', 'When'), r: (x) => `<span class="small nowrap">${esc(fmtDay(x.starts_at))}</span>` },
          { h: biG('La puso', 'Added by'), r: (x) => esc(x.source === 'business' ? biG('El negocio', 'The business') : biG('Klendar', 'Klendar')) },
          { h: biG('Se ve', 'Showing'), r: (x) => (x.visible ? `<span class="tag ok">${esc(biG('sí', 'yes'))}</span>` : `<span class="muted">${esc(biG('ahora no', 'not now'))}</span>`) },
          { h: '', r: (x) => `<button class="btn sm bad ghost" data-out="${esc(x.offer_id)}">${esc(biG('Quitar', 'Remove'))}</button>` },
        ],
        rows: items,
        empty: biG('Todavía no hay ninguna: los negocios la van llenando al publicar.', 'None yet: businesses fill it as they publish.'),
      })}</div>
      <div class="card"><h2>${esc(biG('Añadir a mano', 'Add by hand'))}</h2>
        <label class="f"><span>${esc(biG('Buscar publicación', 'Search publication'))}</span><input id="q" value="${esc(busqueda)}" placeholder="${esc(biG('Título o negocio…', 'Title or business…'))}"></label>
        ${candidatas.length ? table({
          cols: [
            { h: biG('Publicación', 'Publication'), r: (o) => `<span class="title">${esc(o.title)}<span class="sub">${esc(o.business_name || '')}</span></span>` },
            { h: biG('Estado', 'Status'), r: (o) => `${tag(o.status)} ${modTag(o.moderation_status)}` },
            { h: '', r: (o) => `<button class="btn sm" data-in="${esc(o.id)}">${esc(biG('Añadir', 'Add'))}</button>` },
          ],
          rows: candidatas,
        }) : `<p class="muted">${esc(busqueda.trim().length >= 2 ? biG('Nada con ese nombre.', 'Nothing with that name.') : biG('Escribe al menos dos letras.', 'Type at least two letters.'))}</p>`}
        <p class="muted small">${esc(biG('Solo sale lo que ven todos y cae dentro de las fechas de la guía.', 'Only what everyone can see and falls within the guide dates shows.'))}</p>
      </div>`;
    const q = $('#q', v);
    if (escribiendo) { q.focus(); q.setSelectionRange(cursor, cursor); }
    q.oninput = debounce(() => { busqueda = q.value; dibuja(); });
    const filtro = $('#guSitio', v);
    if (filtro) filtro.onchange = () => { sitio = filtro.value; dibuja(); };
    const accion = (b, trabajo) => esperando(b, async () => {
      try { await trabajo(); await dibuja(); } catch (e) { toast(e.message, true); }
    });
    $$('[data-in]', v).forEach((b) => { b.onclick = () => accion(b, () => rpc('admin_collection_add', { p_collection: g.id, p_offer: b.dataset.in })); });
    $$('[data-out]', v).forEach((b) => { b.onclick = () => accion(b, () => rpc('admin_collection_remove', { p_collection: g.id, p_offer: b.dataset.out })); });
  };
  await dibuja();
}
