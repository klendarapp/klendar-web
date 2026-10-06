/* RRPP (relaciones públicas) del negocio, como «RRPP» en «Mi negocio» de la
 * app (migraciones 20261110100000…03 de la app).
 *
 * Un RRPP trae gente con su enlace o su QR (klendar.app/rp/<código>) y solo
 * ve su lista; no es del equipo ni cambia nada del negocio. Aquí:
 *
 * - #/rrpp: los RRPP y las invitaciones pendientes, «Invitar a un RRPP» y
 *   las cifras de todos (7, 30 o 90 días) con «Exportar CSV».
 * - #/rrpp/<id>: la ficha de uno: estado (pausar, reanudar, quitar), sus
 *   enlaces con QR, sus cifras por noche y la lista de una noche.
 * - «Validar códigos»: «Buscar en las listas de esta noche» (`rrppPuerta`) y
 *   «Lista de …» en lo validado (`rrppListaDe`).
 * - El formulario de publicación: «Solo con el enlace de un RRPP»
 *   (`rrppFormulario…`).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `TZ`, `KZ`,
 * `modal`, `confirmDlg`, `table`, `toast`, `bi`, `esc`, `downloadCsv`…).
 * Comparten ámbito: todo lo de aquí empieza por `rrpp` / `RRPP`.
 * Propietario y encargado (la base lo hace cumplir: `is_business_manager`);
 * la puerta, cualquiera del equipo.
 */
'use strict';

/** Lo que la base devuelve con `{ ok: false, error }`, como error. */
function rrppOk(r) {
  if (r && r.ok === false) throw Object.assign(new Error(r.error || 'error'), { clave: r.error || '' });
  return r;
}
const RRPP_ERRORES = {
  self: () => bi('Ese correo es el tuyo.', "That's your own email."),
  already_promoter: () => bi('Esa persona ya es RRPP de tu negocio.', 'That person is already one of your promoters.'),
  adult_required: () => bi('Tu negocio es +18 y esa persona no tiene 18 años (o no tiene la fecha de nacimiento en su perfil).',
    'Your business is 18+ and that person is under 18 (or has no date of birth in their profile).'),
  label_too_long: () => bi('El nombre del enlace cabe en 40 caracteres.', 'The link name can be up to 40 characters.'),
  expires_in_past: () => bi('La caducidad tiene que ser una fecha futura.', 'The expiry has to be a future date.'),
  not_active: () => bi('Esa persona ya no es RRPP de tu negocio.', 'That person is no longer one of your promoters.'),
  not_on_list: () => bi('Ese código no está en las listas de esta noche.', "That code isn't on tonight's lists."),
  invalid_schedule: () => bi('Elige al menos un día y las dos horas.', 'Choose at least one day and both times.'),
  invalid_quota: () => bi('Las plazas por RRPP van de 1 a 10.000 (o vacío para el general).', 'Places per promoter go from 1 to 10,000 (or empty for the general one).'),
};
/** El error dicho para el negocio. `enlaces`: «too_many» habla de enlaces. */
function rrppError(e, enlaces = false) {
  const k = e?.clave || e?.message || '';
  if (k === 'too_many') {
    return enlaces ? bi('Ya tiene 20 enlaces, el máximo. Quita alguno para crear otro.', 'They already have 20 links, the maximum. Remove one to create another.')
      : bi('Tienes 200 RRPP e invitaciones, el máximo.', 'You have 200 promoters and invitations, the maximum.');
  }
  if (RRPP_ERRORES[k]) return RRPP_ERRORES[k]();
  return I18N.t(friendly(e?.message || k));
}

/** Sin nombre en el perfil: «Usuario de Klendar» (nunca el correo). */
const rrppNombre = (p) => (p && String(p.name || '').trim()) || I18N.t('Usuario de Klendar');
/** La foto o la inicial (redonda), para la primera columna de una tabla. */
const rrppAvatar = (p) => (/^https:\/\//.test(p?.avatar || '')
  ? `<img class="thumb rrpp-av" src="${esc(p.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
  : `<span class="ph rrpp-av" aria-hidden="true">${esc(rrppNombre(p).charAt(0).toUpperCase() || '·')}</span>`);

// ── Las noches: cada sesión del local (de la hora de abrir a la de cerrar;
// sin horario, la de la oferta o el día), con la fecha del día en que abre.
// La base la da (`tonight`); esto es solo por si no llega.
/** La noche de ahora, aproximada. */
const rrppNocheHoy = () => KZ.dia(Date.now() - 6 * 36e5, TZ);
const rrppMenos = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};
/** «Esta noche» o «vie, 3 oct». */
const rrppNocheTxt = (iso, hoy) => (iso === hoy ? bi('Esta noche', 'Tonight')
  : new Intl.DateTimeFormat(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)));
const rrppPct = (a, b) => (!b ? '—' : `${Math.round((a * 100) / b)} %`);
const rrppDia = (iso) => KZ.fmt(iso, TZ, LOC(), { day: 'numeric', month: 'long' });

// ── Enlaces y QR ────────────────────────────────────────────────────────────
/** klendar.app/rp/<código> (en local, el servidor de pruebas). */
const rrppUrl = (code) => `${location.origin.replace('://www.', '://')}/rp/${code}`;
function rrppQr(url) {
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr;
}
/** El QR en PNG (blanco, con margen), para imprimirlo o subirlo a redes. Se
 * dibuja aquí mismo, sin mandar el enlace a ningún sitio. */
function rrppDescargaQr(url, nombre) {
  const qr = rrppQr(url);
  const n = qr.getModuleCount();
  const celda = 20;
  const margen = celda * 4;
  const lado = n * celda + margen * 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado; lienzo.height = lado;
  const g = lienzo.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, lado, lado);
  g.fillStyle = '#000000';
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) g.fillRect(margen + c * celda, margen + f * celda, celda, celda);
  lienzo.toBlob((b) => {
    if (!b) { toast(bi('No se ha podido descargar.', "Couldn't download it."), true); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${nombre}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}
async function rrppCopia(texto) {
  try { await navigator.clipboard.writeText(texto); toast(bi('Enlace copiado', 'Link copied')); } catch { toast(bi('No se ha podido copiar', "Couldn't copy it"), true); }
}

/** Estado de un RRPP (o de una invitación) en una etiqueta. */
function rrppEstado(p) {
  if (p.status === 'invited') {
    return `<span class="tag dim">${esc(p.invite_expires_at
      ? bi(`Invitación pendiente · caduca el ${rrppDia(p.invite_expires_at)}`, `Pending invitation · expires on ${rrppDia(p.invite_expires_at)}`)
      : bi('Invitación pendiente', 'Pending invitation'))}</span>`;
  }
  const base = p.status === 'removed' ? `<span class="tag dim">${esc(bi('Ya no es RRPP', 'No longer a promoter'))}</span>`
    : p.status === 'paused' ? `<span class="tag warn">${esc(bi('En pausa', 'Paused'))}</span>`
      : `<span class="tag ok">${esc(bi('Activo', 'Active'))}</span>`;
  return base + (p.suspended ? ` <span class="tag bad">${esc(bi('Cuenta suspendida', 'Account suspended'))}</span>` : '');
}

/** «Lista de Marta · fuera de su oferta» (lo validado, asistentes, puerta).
 * Vacío si el código no cuenta para ningún RRPP. */
function rrppListaDe(r, sinNombre = false) {
  if (!r || (!r.promoter_name && !r.promoter_id && !sinNombre)) return '';
  const n = r.promoter_name || I18N.t('Usuario de Klendar');
  return `<span class="tag rrpp-tag">${esc(bi(`Lista de ${n}`, `${n}'s list`))}</span>${r.promoter_off_offer
    ? ` <span class="tag dim">${esc(bi('fuera de su oferta', 'outside their offer'))}</span>` : ''}`;
}
/** En qué está un código de una lista: dentro (a qué hora), sin usar o caducado. */
function rrppEstadoCodigo(status, at) {
  if (status === 'validated') return `<span class="tag ok">${esc(at ? bi(`Dentro a las ${fmtHora(at)}`, `In at ${fmtHora(at)}`) : bi('Dentro', 'In'))}</span>`;
  if (status === 'expired') return `<span class="tag dim">${esc(bi('Caducado', 'Expired'))}</span>`;
  return `<span class="tag warn">${esc(bi('Aún no ha entrado', 'Not in yet'))}</span>`;
}
const RRPP_NOTA = () => bi('Solo cuenta como asistencia lo validado en la puerta. Lo que pagues a tus RRPP lo gestionas fuera de Klendar; tú eres responsable de tus RRPP.',
  "Only codes validated at the door count as attendance. Anything you pay your promoters is handled outside Klendar; you're responsible for your promoters.");

// ── #/rrpp: la lista y las cifras de todos ───────────────────────────────────
let RRPP_DIAS = 30;

PAGES.rrpp = async (v, param) => {
  if (param) { await rrppFicha(v, param); return; }
  const hoy = rrppNocheHoy();
  const desde = rrppMenos(hoy, RRPP_DIAS);
  const [lista, informe, ofertas] = await Promise.all([
    rpc('business_promoters_list', { p_business: BIZ.id }),
    rpc('promoter_report', { p_business: BIZ.id, p_from: desde, p_to: hoy }).then(rrppOk),
    rpc('business_promoter_offers', { p_business: BIZ.id }).then(rrppOk).catch(() => ({ offers: [] })),
  ]);
  const filas = lista || [];
  const cifras = informe?.promoters || [];
  const tot = cifras.reduce((a, p) => ({
    signed: a.signed + (p.signed || 0), entered: a.entered + (p.entered || 0), off: a.off + (p.off_offer || 0),
  }), { signed: 0, entered: 0, off: 0 });

  v.innerHTML = `
    <div class="page-head"><h1>RRPP</h1><span class="spacer"></span>
      <button class="btn sm primary" type="button" id="rrppInvitar">${esc(bi('Invitar a un RRPP', 'Invite a promoter'))}</button></div>
    <p class="muted">${esc(bi('Tus RRPP traen gente con su enlace o su QR. No pueden cambiar nada de tu negocio: solo ven su lista.',
      "Your promoters bring people in with their link or QR code. They can't change anything about your business: they only see their own list."))}</p>
    <div class="card">${table({
      cols: [
        { h: bi('RRPP', 'Promoter'), r: (p) => (p.status === 'invited'
          ? `<b class="title">${esc(p.email || '')}</b><span class="sub">${rrppEstado(p)}</span>`
          : `${rrppAvatar(p)}<a class="title" href="#/rrpp/${esc(p.id)}"><b>${esc(rrppNombre(p))}</b></a><span class="sub">${rrppEstado(p)}</span>`) },
        { h: bi('Apuntados', 'Signed up'), num: true, r: (p) => (p.status === 'invited' ? '—' : fmtNum(p.signed_30)) },
        { h: bi('Han entrado', 'Got in'), num: true, r: (p) => (p.status === 'invited' ? '—' : fmtNum(p.entered_30)) },
        { h: bi('Enlaces', 'Links'), num: true, r: (p) => (p.status === 'invited' ? '—' : fmtNum(p.links)) },
        { h: '', r: (p) => (p.status === 'invited'
          ? `<div class="actions"><button class="btn sm ghost" type="button" data-rrpp-cancela="${esc(p.id)}">${esc(bi('Cancelar la invitación', 'Cancel the invitation'))}</button></div>`
          : `<div class="actions"><a class="btn sm" href="#/rrpp/${esc(p.id)}">${esc(bi('Abrir', 'Open'))}</a></div>`) },
      ],
      rows: filas,
      empty: bi('Aún no tienes RRPP. Invita al primero con su correo.', "You don't have any promoters yet. Invite your first one with their email."),
    })}
    ${filas.some((p) => p.status !== 'invited') ? `<p class="muted small" style="margin:10px 0 0">${esc(bi('Apuntados y han entrado: últimos 30 días.', 'Signed up and got in: last 30 days.'))}</p>` : ''}</div>

    <div class="card">
      <div class="rrpp-cab-card"><h2>${esc(bi('Ofertas para tus RRPP', 'Offers for your promoters'))}</h2><span class="spacer"></span>
        <a class="btn sm primary" href="#/publicaciones/nueva-flash?rrpp=1">${esc(bi('Nueva oferta para RRPP', 'New offer for promoters'))}</a></div>
      ${rrppOfertasHtml(ofertas?.offers || [], bi('Aún no tienes ofertas para tus RRPP. Solo se ven con el enlace de uno de tus RRPP.',
        "You don't have any offers for your promoters yet. They can only be seen through one of your promoters' links."))}
    </div>

    <div id="rrppListas">${RRPP_LISTAS_VACIA()}</div>

    <div class="card">
      <div class="rrpp-cab-card"><h2>${esc(bi('Cifras', 'Stats'))}</h2><span class="spacer"></span>
        ${[7, 30, 90].map((d) => `<button class="btn sm ${d === RRPP_DIAS ? '' : 'ghost'}" type="button" data-rrpp-dias="${d}" aria-pressed="${d === RRPP_DIAS}">${esc(bi(`${d} días`, `${d} days`))}</button>`).join(' ')}
        <button class="btn sm ghost" type="button" id="rrppCsv">${esc(bi('Exportar CSV', 'Export CSV'))}</button></div>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(tot.signed)}</b><span>${esc(bi('Apuntados', 'Signed up'))}</span></div>
        <div class="kpi"><b>${fmtNum(tot.entered)}</b><span>${esc(bi('Han entrado', 'Got in'))}</span></div>
        <div class="kpi"><b>${rrppPct(tot.entered, tot.signed)}</b><span>${esc(bi('Conversión', 'Conversion'))}</span></div>
        <div class="kpi"><b>${fmtNum(tot.off)}</b><span>${esc(bi('Fuera de su oferta', 'Outside their offer'))}</span></div>
      </div>
      ${cifras.length ? `<div style="margin-top:12px">${table({
        cols: [
          { h: bi('RRPP', 'Promoter'), r: (p) => `${rrppAvatar(p)}<a class="title" href="#/rrpp/${esc(p.id)}"><b>${esc(rrppNombre(p))}</b></a>${p.status !== 'active' ? `<span class="sub">${rrppEstado(p)}</span>` : ''}` },
          { h: bi('Apuntados', 'Signed up'), num: true, r: (p) => fmtNum(p.signed) },
          { h: bi('Han entrado', 'Got in'), num: true, r: (p) => fmtNum(p.entered) },
          { h: bi('Conversión', 'Conversion'), num: true, r: (p) => rrppPct(p.entered, p.signed) },
          { h: bi('Fuera de su oferta', 'Outside their offer'), num: true, r: (p) => fmtNum(p.off_offer) },
        ],
        rows: cifras,
      })}</div>` : ''}
      <p class="muted small" style="margin:12px 0 0">${esc(RRPP_NOTA())}</p>
    </div>`;

  // Las listas de esta noche: buscar y validar (como en «Validar códigos»).
  const cajaListas = $('#rrppListas', v);
  rrppPuerta(cajaListas, (res) => {
    toast(res.ok ? bi('Validado', 'Validated') : rrppError({ clave: res.error }), !res.ok);
  }).then(() => { if (!cajaListas.innerHTML.trim()) cajaListas.innerHTML = RRPP_LISTAS_VACIA(); });

  $('#rrppInvitar', v).onclick = async () => {
    const r = await modal({
      title: bi('Invitar a un RRPP', 'Invite a promoter'),
      intro: esc(bi('Le llegará una invitación para aceptar. Necesita una cuenta de Klendar.', "They'll get an invitation to accept. They need a Klendar account.")),
      fields: [{ name: 'email', type: 'email', label: bi('Correo', 'Email'), required: true }],
      submit: bi('Invitar', 'Invite'),
    });
    if (!r || !r.email) return;
    try {
      rrppOk(await rpc('invite_promoter', { p_business: BIZ.id, p_email: r.email }));
      toast(bi('Invitación enviada', 'Invitation sent'));
      PAGES.rrpp(v);
    } catch (e) { toast(rrppError(e), true); }
  };
  $$('[data-rrpp-cancela]', v).forEach((b) => {
    b.onclick = async () => {
      const p = filas.find((x) => x.id === b.dataset.rrppCancela) || {};
      if (!await confirmDlg(bi('Cancelar la invitación', 'Cancel the invitation'),
        esc(bi(`${p.email || ''} ya no podrá aceptarla.`, `${p.email || ''} won't be able to accept it.`)),
        { danger: true, submit: bi('Cancelar la invitación', 'Cancel the invitation') })) return;
      try {
        rrppOk(await rpc('set_promoter_status', { p_promoter: p.id, p_status: 'removed' }));
        toast(bi('Invitación cancelada', 'Invitation cancelled'));
        PAGES.rrpp(v);
      } catch (e) { toast(rrppError(e), true); }
    };
  });
  $$('[data-rrpp-dias]', v).forEach((b) => {
    b.onclick = () => { RRPP_DIAS = Number(b.dataset.rrppDias) || 30; PAGES.rrpp(v).catch((e) => toast(rrppError(e), true)); };
  });
  $('#rrppCsv', v).onclick = async () => {
    try {
      const filasCsv = await rpc('promoter_export', { p_business: BIZ.id, p_from: desde, p_to: hoy });
      if (!(filasCsv || []).length) { toast(bi('No hay nada que exportar en este periodo.', "There's nothing to export for this period.")); return; }
      const si = bi('sí', 'yes');
      const hora = (iso) => (iso ? `${KZ.dia(iso, TZ)} ${fmtHora(iso)}` : '');
      const estado = { validated: bi('dentro', 'in'), expired: bi('caducado', 'expired'), pending: bi('aún no ha entrado', 'not in yet') };
      downloadCsv(`rrpp-${BIZ.name}`, filasCsv, [
        ['night', bi('Noche', 'Night')],
        [(x) => x.promoter_name || I18N.t('Usuario de Klendar'), bi('RRPP', 'Promoter')],
        [(x) => x.person_name || I18N.t('Usuario de Klendar'), bi('Persona', 'Person')],
        ['offer_title', bi('Publicación', 'Publication')],
        [(x) => (x.promoter_offer ? si : ''), bi('Oferta de RRPP', 'Promoter offer')],
        [(x) => (x.off_offer ? si : ''), bi('Fuera de su oferta', 'Outside their offer')],
        ['seats', bi('Plazas', 'Places')],
        [(x) => estado[x.status] || x.status, bi('Estado', 'Status')],
        [(x) => hora(x.joined_at), bi('Se apuntó', 'Signed up')],
        [(x) => hora(x.entered_at), bi('Entró', 'Got in')],
        ['link_label', bi('Enlace', 'Link')],
        ['link_code', bi('Código del enlace', 'Link code')],
      ]);
    } catch (e) { toast(rrppError(e), true); }
  };
};

// ── #/rrpp/<id>: la ficha de un RRPP ─────────────────────────────────────────
// ── Cuándo funciona la lista ────────────────────────────────────────────────
// Como el horario del local: {"5": [["22:00", "03:00"]], …} (lunes = 1). Aquí
// se elige un tramo, el mismo en los días marcados. null = el de serie
// (cuando el local está abierto; en un enlace, como su RRPP).
const rrppDiaSem = (d, forma = 'long') => new Intl.DateTimeFormat(LOC(), { weekday: forma, timeZone: 'UTC' })
  .format(new Date(Date.UTC(2024, 0, d)));
const rrppHoraCorta = (hhmm) => String(hhmm || '').replace(/^0(\d):/, '$1:');
/** «Viernes y sábado, de 22:00 a 3:00». */
function rrppHorarioTxt(s) {
  const grupos = new Map();
  for (const d of Object.keys(s || {}).map(Number).sort()) {
    for (const t of s[d] || []) {
      const k = `${t[0]}|${t[1]}`;
      grupos.set(k, [...(grupos.get(k) || []), d]);
    }
  }
  const y = bi(' y ', ' and ');
  return [...grupos.entries()].map(([k, dias]) => {
    const [a, b] = k.split('|');
    const nombres = dias.map((d) => rrppDiaSem(d));
    let txt = dias.length === 7 ? bi('Todos los días', 'Every day')
      : nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')}${y}${nombres[nombres.length - 1]}`;
    txt = txt.charAt(0).toUpperCase() + txt.slice(1);
    return bi(`${txt}, de ${rrppHoraCorta(a)} a ${rrppHoraCorta(b)}`, `${txt}, ${rrppHoraCorta(a)} to ${rrppHoraCorta(b)}`);
  }).join(' · ');
}
/** «Esta lista abre hoy a las 22:00» / «el viernes a las 22:00». */
function rrppAbreTxt(iso) {
  if (!iso) return bi('Esta lista está cerrada ahora.', 'This list is closed right now.');
  const hoy = KZ.hoy(TZ);
  const dia = KZ.dia(new Date(iso).getTime(), TZ);
  const hora = fmtHora(iso);
  const a = Number(String(hora).split(':')[0]) === 1 ? 'a la' : 'a las';
  if (dia === hoy) return bi(`Esta lista abre hoy ${a} ${hora}`, `This list opens today at ${hora}`);
  if (dia === rrppMenos(hoy, -1)) return bi(`Esta lista abre mañana ${a} ${hora}`, `This list opens tomorrow at ${hora}`);
  const nombre = KZ.fmt(iso, TZ, LOC(), { weekday: 'long', day: 'numeric', month: 'short' });
  return bi(`Esta lista abre el ${nombre} ${a} ${hora}`, `This list opens on ${nombre} at ${hora}`);
}
/** Pide el horario. `deSerie`: el texto de la opción de serie. Devuelve
 * `{ schedule }` (null = el de serie) o null si se cancela. */
async function rrppHorarioModal(actual, deSerie) {
  const tramo = actual ? Object.values(actual)[0]?.[0] : null;
  const f = await modal({
    title: bi('Cuándo funciona la lista', 'When the list is open'),
    intro: esc(bi('Fuera de este horario, el enlace dice cuándo abre la lista, no cuenta para el RRPP y su oferta no se puede conseguir.',
      "Outside these hours the link says when the list opens, it doesn't count for the promoter and the offers on the list aren't available.")),
    fields: [
      { name: 'modo', type: 'select', label: bi('Horario', 'Hours'), value: actual ? 'propio' : 'serie',
        options: [['serie', deSerie], ['propio', bi('Días y horas propios', 'Set days and times')]] },
      ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({ name: `d${d}`, type: 'checkbox',
        label: rrppDiaSem(d).charAt(0).toUpperCase() + rrppDiaSem(d).slice(1),
        value: actual ? !!actual[d] : d >= 5 && d <= 6 })),
      { name: 'desde', type: 'time', label: bi('Desde', 'From'), value: tramo?.[0] || '22:00' },
      { name: 'hasta', type: 'time', label: bi('Hasta', 'Until'), value: tramo?.[1] || '03:00' },
    ],
    submit: bi('Guardar', 'Save'),
  });
  if (!f) return null;
  if (f.modo !== 'propio') return { schedule: null };
  const dias = [1, 2, 3, 4, 5, 6, 7].filter((d) => f[`d${d}`]);
  if (!dias.length || !/^\d{2}:\d{2}$/.test(f.desde) || !/^\d{2}:\d{2}$/.test(f.hasta)) {
    toast(RRPP_ERRORES.invalid_schedule(), true);
    return null;
  }
  return { schedule: Object.fromEntries(dias.map((d) => [String(d), [[f.desde, f.hasta]]])) };
}

/** «Listas de esta noche» sin nadie apuntado todavía. */
const RRPP_LISTAS_VACIA = () => `<div class="card"><h2>${esc(bi('Listas de esta noche', "Tonight's lists"))}</h2>
  <p class="muted" style="margin:0">${esc(bi('Nadie se ha apuntado aún esta noche. Cuando haya alguien, aquí lo buscas y le validas en la puerta.',
    "Nobody has signed up tonight yet. When someone does, you can find them here and validate them at the door."))}</p></div>`;

// ── Las ofertas de RRPP ─────────────────────────────────────────────────────
/** «Sábado 12, de 23:00 a 6:00». */
function rrppCuando(ini, fin) {
  if (!ini) return '';
  const dia = KZ.fmt(ini, TZ, LOC(), { weekday: 'long', day: 'numeric' });
  const d = dia.charAt(0).toUpperCase() + dia.slice(1);
  const a = rrppHoraCorta(fmtHora(ini));
  if (!fin) return bi(`${d}, a partir de las ${a}`, `${d}, from ${a}`);
  const b = rrppHoraCorta(fmtHora(fin));
  return bi(`${d}, de ${a} a ${b}`, `${d}, ${a} to ${b}`);
}
/** Hasta cuándo vale el código, en una frase. */
function rrppValidezTxt(until, hours) {
  if (until) {
    const h = rrppHoraCorta(until);
    return bi(`El código vale ${h.startsWith('1:') ? 'hasta la' : 'hasta las'} ${h}`, `The code is valid until ${until}`);
  }
  if (hours) return bi(`El código vale ${hours === 1 ? '1 hora' : `${hours} horas`} desde que lo consigues`, `The code is valid for ${hours === 1 ? '1 hour' : `${hours} hours`} after you get it`);
  return bi('El código vale hasta que termine el evento o la oferta.', 'The code is valid until the event or the offer ends.');
}
/** Las ofertas de RRPP: cuándo, hasta cuándo vale el código y el cupo que
 * le queda a cada RRPP. Abrir una la edita. */
function rrppOfertasHtml(lista, vacio) {
  if (!lista.length) return `<p class="muted" style="margin:0">${esc(vacio)}</p>`;
  return table({
    cols: [
      { h: bi('Oferta', 'Offer'), r: (o) => `<b class="title">${esc(o.title || '')}</b><span class="sub">${esc([rrppCuando(o.starts_at, o.ends_at), o.live ? '' : bi('Terminada', 'Ended')].filter(Boolean).join(' · '))}</span>` },
      { h: bi('Validez', 'Valid'), r: (o) => esc(rrppValidezTxt(o.code_until, o.code_hours)) },
      // El cupo de cada RRPP: tocarlo lo cambia para él («Marta: 80») o lo
      // devuelve al general (migración 20261115100002).
      { h: bi('Cupo', 'Places'), r: (o) => ((o.promoters || []).length ? (o.promoters || []).map((p) => {
        const cupo = p.quota !== undefined ? p.quota : o.quota;
        const txt = cupo != null && p.left != null
          ? bi(`${rrppNombre(p)}: quedan ${p.left} de ${cupo}`, `${rrppNombre(p)}: ${p.left} of ${cupo} left`)
          : bi(`${rrppNombre(p)}: ${p.used} ${p.used === 1 ? 'apuntado' : 'apuntados'} · sin límite`, `${rrppNombre(p)}: ${p.used} signed up · no limit`);
        const propio = p.custom ? bi(' (propio)', ' (own limit)') : '';
        return `<button type="button" class="linkbtn rrpp-cupo" data-cupo-oferta="${esc(o.id)}" data-cupo-rrpp="${esc(p.id)}" data-cupo-nombre="${esc(rrppNombre(p))}"
          data-cupo-general="${o.quota ?? ''}" data-cupo-propio="${p.custom ? esc(cupo ?? '') : ''}" title="${esc(bi('Cambiar el cupo', 'Change the limit'))}">${esc(txt + propio)}</button>`;
      }).join('<br>')
        : esc(bi('Ningún RRPP la tiene todavía', 'No promoter has it yet'))) },
      { h: '', r: (o) => `<div class="actions"><a class="btn sm" href="#/publicaciones/${esc(o.id)}">${esc(bi('Abrir', 'Open'))}</a></div>` },
    ],
    rows: lista,
  });
}

/** «Cupo de Marta»: lo que puede apuntar un RRPP en una oferta. Vacío vuelve
 * al general. Vale para «Ofertas para tus RRPP» y la ficha del RRPP. */
document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('[data-cupo-rrpp]');
  if (!b) return;
  e.preventDefault();
  const general = b.dataset.cupoGeneral;
  const r = await modal({
    title: bi(`Cupo de ${b.dataset.cupoNombre}`, `${b.dataset.cupoNombre}'s limit`),
    fields: [{ name: 'cupo', label: bi('Personas que puede apuntar', 'People they can sign up'), type: 'number', min: 1, max: 10000,
      value: b.dataset.cupoPropio, placeholder: general || bi('Sin límite', 'No limit'),
      help: general ? bi(`Vacío: el general (${general}).`, `Empty: the general one (${general}).`) : bi('Vacío: sin límite, como el resto.', 'Empty: no limit, like the rest.') }],
    submit: bi('Guardar', 'Save'),
  });
  if (!r) return;
  const n = r.cupo === '' ? null : Number(r.cupo);
  if (n !== null && (!Number.isInteger(n) || n < 1 || n > 10000)) {
    toast(bi('Las plazas por RRPP van de 1 a 10.000 (o vacío para el general).', 'Places per promoter go from 1 to 10,000 (or empty for the general one).'), true);
    return;
  }
  try {
    rrppOk(await rpc('set_offer_promoter_quota', { p_offer: b.dataset.cupoOferta, p_promoter: b.dataset.cupoRrpp, p_quota: n }));
    toast(bi('Cupo guardado', 'Limit saved'));
    route();
  } catch (err) { toast(rrppError(err), true); }
});

// ── La ficha de un RRPP ─────────────────────────────────────────────────────
async function rrppFicha(v, id, noche = null) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { location.hash = '#/rrpp'; return; }
  let r;
  try {
    r = rrppOk(await rpc('promoter_report', { p_business: BIZ.id, p_from: null, p_to: null, p_promoter: id, p_night: noche }));
  } catch (e) {
    if (e.clave === 'not_found' || e.clave === 'not_authorized') { location.hash = '#/rrpp'; return; }
    throw e;
  }
  const p = r.promoter || {};
  const nombre = rrppNombre(p);
  const hoy = r.tonight || rrppNocheHoy();
  const vigente = p.status === 'active' || p.status === 'paused';
  const noches = r.nights || [];
  // Las noches para elegir: esta y las que tienen algo, de la más reciente.
  const opciones = [...new Set([hoy, r.night, ...noches.map((x) => x.night)].filter(Boolean))].sort().reverse();
  const deEsa = noches.find((x) => x.night === r.night);
  const lista = r.list || [];
  const apuntados = deEsa ? deEsa.signed : lista.length;
  const dentro = deEsa ? deEsa.entered : lista.filter((x) => x.status === 'validated').length;

  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/rrpp">${esc(bi('← RRPP', '← Promoters'))}</a><h1>${esc(nombre)}</h1></div>
    <div class="card rrpp-ficha-cab">
      ${rrppAvatar(p)}
      <div class="rrpp-ficha-t">
        <p style="margin:0">${rrppEstado(p)}${p.accepted_at ? ` <span class="muted small">${esc(bi(`RRPP desde el ${rrppDia(p.accepted_at)}`, `Promoter since ${rrppDia(p.accepted_at)}`))}</span>` : ''}</p>
        ${vigente ? `<div class="actions" style="margin-top:10px">
          ${p.status === 'paused'
            ? `<button class="btn sm" type="button" data-rrpp-estado="active">${esc(bi('Reanudar', 'Resume'))}</button>`
            : `<button class="btn sm ghost" type="button" data-rrpp-estado="paused">${esc(bi('Pausar', 'Pause'))}</button>`}
          <button class="btn sm bad ghost" type="button" data-rrpp-estado="removed">${esc(bi('Quitar', 'Remove'))}</button></div>` : ''}
      </div>
    </div>

    ${vigente ? `<div class="card">
      <div class="rrpp-cab-card"><h2>${esc(bi('Cuándo funciona la lista', 'When the list is open'))}</h2><span class="spacer"></span>
        <button class="btn sm ghost" type="button" id="rrppHorario">${esc(bi('Cambiar', 'Change'))}</button></div>
      <p style="margin:0">${esc(p.schedule ? rrppHorarioTxt(p.schedule)
        : p.business_has_hours === false ? bi('Siempre (tu local no tiene horario)', 'Always (your venue has no opening hours)')
          : bi('Cuando el local está abierto', 'When the venue is open'))}</p>
      <p class="muted small" style="margin:6px 0 0">${esc(bi('Fuera de este horario, el enlace dice cuándo abre la lista, no cuenta para el RRPP y su oferta no se puede conseguir. Cada enlace puede tener el suyo.',
        "Outside these hours the link says when the list opens, it doesn't count for the promoter and the offers on the list aren't available. Each link can have its own."))}</p>
    </div>` : ''}

    <div class="card"><h2>${esc(bi('Sus ofertas', 'Their offers'))}</h2>
      ${rrppOfertasHtml(r.offers || [], bi('No tiene ofertas de RRPP. En «Nueva oferta para RRPP», elige «Todos» o márcalo en «Solo algunos».',
        'They have no promoter offers. In “New offer for promoters”, choose “All” or tick them under “Only some”.'))}
    </div>

    ${vigente ? `<div class="card">
      <div class="rrpp-cab-card"><h2>${esc(bi('Enlaces y QR', 'Links and QR codes'))}</h2><span class="spacer"></span>
        <button class="btn sm primary" type="button" id="rrppNuevo">${esc(bi('Nuevo enlace', 'New link'))}</button></div>
      <div class="rrpp-enlaces">${(r.links || []).map(rrppEnlaceHtml).join('')
        || `<p class="muted" style="margin:0">${esc(bi('No tiene enlaces. Crea uno con «Nuevo enlace».', 'They have no links. Create one with “New link”.'))}</p>`}</div>
    </div>` : ''}

    <div class="card"><h2>${esc(bi('Por noche', 'By night'))}</h2>
      ${table({
        cols: [
          { h: bi('Noche', 'Night'), r: (x) => `<b class="title">${esc(rrppNocheTxt(x.night, hoy))}</b>` },
          { h: bi('Apuntados', 'Signed up'), num: true, r: (x) => fmtNum(x.signed) },
          { h: bi('Han entrado', 'Got in'), num: true, r: (x) => fmtNum(x.entered) },
          { h: bi('Conversión', 'Conversion'), num: true, r: (x) => rrppPct(x.entered, x.signed) },
          { h: bi('Fuera de su oferta', 'Outside their offer'), num: true, r: (x) => fmtNum(x.off_offer) },
          { h: '', r: (x) => `<div class="actions"><button class="btn sm ghost" type="button" data-rrpp-noche="${esc(x.night)}">${esc(bi('Ver la lista', 'See the list'))}</button></div>` },
        ],
        rows: noches,
        empty: bi('Nadie se ha apuntado con sus enlaces en los últimos 30 días.', 'Nobody has signed up through their links in the last 30 days.'),
      })}
    </div>

    <div class="card" id="rrppLista">
      <div class="rrpp-cab-card"><h2>${esc(bi(`Lista de ${nombre}`, `${nombre}'s list`))}</h2><span class="spacer"></span>
        <select id="rrppNoche" aria-label="${esc(bi('Noche', 'Night'))}">${opciones.map((n) => `<option value="${esc(n)}" ${n === r.night ? 'selected' : ''}>${esc(rrppNocheTxt(n, hoy))}</option>`).join('')}</select></div>
      <p class="muted" style="margin:0 0 10px">${esc(bi(`${fmtNum(apuntados)} ${apuntados === 1 ? 'apuntado' : 'apuntados'} · ${fmtNum(dentro)} dentro`, `${fmtNum(apuntados)} signed up · ${fmtNum(dentro)} got in`))}</p>
      ${table({
        cols: [
          { h: bi('Persona', 'Person'), r: (x) => `${rrppAvatar(x)}<b class="title">${esc(rrppNombre(x))}</b><span class="sub">${esc(bi(`Se apuntó a las ${fmtHora(x.joined_at)}`, `Signed up at ${fmtHora(x.joined_at)}`))}</span>` },
          { h: bi('Publicación', 'Publication'), r: (x) => `${esc(x.offer_title || '')}${x.promoter_offer ? ` <span class="tag rrpp-tag">${esc(bi('Oferta de RRPP', 'Promoter offer'))}</span>` : ''}${x.off_offer ? ` <span class="tag dim">${esc(bi('fuera de su oferta', 'outside their offer'))}</span>` : ''}` },
          { h: bi('Plazas', 'Places'), num: true, r: (x) => fmtNum(x.seats || 1) },
          { h: bi('Estado', 'Status'), r: (x) => rrppEstadoCodigo(x.status, x.entered_at) },
        ],
        rows: lista,
        empty: bi('Nadie en la lista esta noche.', 'Nobody on the list this night.'),
      })}
    </div>
    <p class="muted small">${esc(RRPP_NOTA())}</p>`;

  // QR de cada enlace, dibujado aquí.
  $$('[data-rrpp-qrsvg]', v).forEach((el) => { el.innerHTML = rrppQr(el.dataset.rrppQrsvg).createSvgTag({ cellSize: 4, margin: 0, scalable: true }); });
  const repinta = (n = r.night === hoy ? null : r.night) => rrppFicha(v, id, n).catch((e) => toast(rrppError(e), true));
  $('#rrppNoche', v).onchange = (ev) => repinta(ev.target.value === hoy ? null : ev.target.value);
  $$('[data-rrpp-noche]', v).forEach((b) => {
    b.onclick = async () => {
      await rrppFicha(v, id, b.dataset.rrppNoche === hoy ? null : b.dataset.rrppNoche);
      $('#rrppLista', v)?.scrollIntoView({ block: 'start' });
    };
  });

  // Pausar, reanudar o quitar (con confirmación).
  $$('[data-rrpp-estado]', v).forEach((b) => {
    b.onclick = async () => {
      const nuevo = b.dataset.rrppEstado;
      const T = {
        paused: [bi(`¿Pausar a ${nombre}?`, `Pause ${nombre}?`),
          bi('Mientras esté en pausa, sus enlaces no funcionan y nadie cuenta para su lista. Le avisamos.',
            "While they're paused, their links don't work and nobody counts towards their list. We'll let them know."),
          bi('Pausar', 'Pause'), false],
        active: [bi(`¿Reanudar a ${nombre}?`, `Resume ${nombre}?`),
          bi('Sus enlaces vuelven a funcionar. Le avisamos.', "Their links work again. We'll let them know."),
          bi('Reanudar', 'Resume'), false],
        removed: [bi(`¿Quitar a ${nombre}?`, `Remove ${nombre}?`),
          bi(`${nombre} dejará de ser RRPP de ${BIZ.name} y sus enlaces dejarán de funcionar. Sus cifras se quedan.`,
            `${nombre} will stop being a promoter for ${BIZ.name} and their links will stop working. Their stats stay.`),
          bi('Quitar', 'Remove'), true],
      }[nuevo];
      if (!T || !await confirmDlg(T[0], esc(T[1]), { danger: T[3], submit: T[2] })) return;
      try {
        rrppOk(await rpc('set_promoter_status', { p_promoter: id, p_status: nuevo }));
        toast(bi('Hecho', 'Done'));
        if (nuevo === 'removed') { location.hash = '#/rrpp'; return; }
        repinta();
      } catch (e) { toast(rrppError(e), true); }
    };
  });

  // Cuándo funciona su lista (y la de cada enlace).
  const horarioBtn = $('#rrppHorario', v);
  if (horarioBtn) {
    horarioBtn.onclick = async () => {
      const r2 = await rrppHorarioModal(p.schedule || null, p.business_has_hours === false
        ? bi('Siempre (tu local no tiene horario)', 'Always (your venue has no opening hours)')
        : bi('Cuando el local está abierto', 'When the venue is open'));
      if (!r2) return;
      try {
        rrppOk(await rpc('set_promoter_schedule', { p_promoter: id, p_schedule: r2.schedule }));
        toast(bi('Guardado', 'Saved'));
        repinta();
      } catch (e) { toast(rrppError(e), true); }
    };
  }
  $$('[data-rrpp-horario-enlace]', v).forEach((b) => {
    b.onclick = async () => {
      const l = (r.links || []).find((x) => x.id === b.dataset.id);
      const r2 = await rrppHorarioModal(l?.schedule || null, bi('Como el RRPP', 'Same as the promoter'));
      if (!r2) return;
      try {
        rrppOk(await rpc('set_promoter_link_schedule', { p_link: b.dataset.id, p_schedule: r2.schedule }));
        toast(bi('Guardado', 'Saved'));
        repinta();
      } catch (e) { toast(rrppError(e, true), true); }
    };
  });

  // Enlaces: nuevo, copiar, QR, pausar y quitar.
  const nuevoBtn = $('#rrppNuevo', v);
  if (nuevoBtn) {
    nuevoBtn.onclick = async () => {
      const f = await modal({
        title: bi('Nuevo enlace', 'New link'),
        intro: esc(bi('Cada enlace lleva su QR y sus visitas: uno para Instagram, otro para el grupo de WhatsApp…',
          'Each link has its own QR code and visits: one for Instagram, another for the WhatsApp group…')),
        fields: [
          { name: 'label', label: bi('Nombre (opcional)', 'Name (optional)'), maxlength: 40, placeholder: bi('Ej.: Instagram', 'E.g. Instagram') },
          { name: 'caduca', type: 'datetime-local', label: bi('Caducidad', 'Expiry'), help: bi('Vacía: sin caducidad.', 'Empty: no expiry.') },
        ],
        submit: bi('Crear el enlace', 'Create the link'),
      });
      if (!f) return;
      try {
        rrppOk(await rpc('create_promoter_link', { p_promoter: id, p_label: f.label || null, p_expires_at: f.caduca ? fromLocalInput(f.caduca) : null }));
        toast(bi('Enlace creado', 'Link created'));
        repinta();
      } catch (e) { toast(rrppError(e, true), true); }
    };
  }
  $$('[data-rrpp-copiar]', v).forEach((b) => { b.onclick = () => rrppCopia(b.dataset.rrppCopiar); });
  $$('[data-rrpp-qr]', v).forEach((b) => { b.onclick = () => rrppDescargaQr(rrppUrl(b.dataset.rrppQr), `qr-rrpp-${b.dataset.rrppQr}`); });
  $$('[data-rrpp-pausa]', v).forEach((b) => {
    b.onclick = async () => {
      try {
        rrppOk(await rpc('update_promoter_link', { p_link: b.dataset.id, p_paused: b.dataset.rrppPausa === '1' }));
        toast(b.dataset.rrppPausa === '1' ? bi('Enlace en pausa', 'Link paused') : bi('El enlace vuelve a funcionar', 'The link works again'));
        repinta();
      } catch (e) { toast(rrppError(e, true), true); }
    };
  });
  $$('[data-rrpp-quita-enlace]', v).forEach((b) => {
    b.onclick = async () => {
      if (!await confirmDlg(bi('Quitar el enlace', 'Remove the link'),
        esc(bi('Dejará de funcionar para siempre (también su QR). Lo que trajo se queda en sus cifras.',
          'It will stop working for good (its QR code too). What it brought in stays in their stats.')),
        { danger: true, submit: bi('Quitar el enlace', 'Remove the link') })) return;
      try {
        rrppOk(await rpc('retire_promoter_link', { p_link: b.dataset.id }));
        toast(bi('Enlace quitado', 'Link removed'));
        repinta();
      } catch (e) { toast(rrppError(e, true), true); }
    };
  });
}

/** Un enlace: su QR, su nombre, cómo está, sus visitas y lo que se hace con él. */
function rrppEnlaceHtml(l) {
  const url = rrppUrl(l.code);
  const estado = l.state === 'paused' ? `<span class="tag warn">${esc(bi('En pausa', 'Paused'))}</span>`
    : l.state === 'expired' ? `<span class="tag dim">${esc(bi('Caducado', 'Expired'))}</span>`
      : l.state === 'inactive' ? `<span class="tag bad">${esc(bi('No funciona', "Doesn't work"))}</span>`
        : l.state === 'closed' ? `<span class="tag dim">${esc(bi('Fuera de horario', 'Outside its hours'))}</span>` : '';
  const caduca = !l.expires_at ? bi('Sin caducidad', 'No expiry')
    : l.state === 'expired' ? '' : bi(`Caduca el ${fmtDate(l.expires_at)}`, `Expires on ${fmtDate(l.expires_at)}`);
  const n = Number(l.opens) || 0;
  const visitas = bi(n === 1 ? '1 visita' : `${fmtNum(n)} visitas`, n === 1 ? '1 visit' : `${fmtNum(n)} visits`);
  return `<div class="rrpp-enlace">
    <div class="rrpp-qr" role="img" aria-label="${esc(`QR ${url}`)}" data-rrpp-qrsvg="${esc(url)}"></div>
    <div class="rrpp-enlace-t">
      <p style="margin:0"><b>${esc(l.label || l.code)}</b> ${estado}</p>
      <p class="rrpp-url">${esc(url.replace(/^https?:\/\//, ''))}</p>
      <p class="muted small" style="margin:0">${esc([caduca, l.schedule ? rrppHorarioTxt(l.schedule) : '', visitas].filter(Boolean).join(' · '))}</p>
      ${l.state === 'closed' ? `<p class="muted small" style="margin:2px 0 0">${esc(rrppAbreTxt(l.opens_at))}</p>` : ''}
      <div class="actions" style="margin-top:10px">
        <button class="btn sm" type="button" data-rrpp-copiar="${esc(url)}">${esc(bi('Copiar enlace', 'Copy link'))}</button>
        <button class="btn sm ghost" type="button" data-rrpp-qr="${esc(l.code)}">${esc(bi('Descargar QR', 'Download QR code'))}</button>
        <button class="btn sm ghost" type="button" data-rrpp-horario-enlace data-id="${esc(l.id)}">${esc(bi('Horario', 'Hours'))}</button>
        <button class="btn sm ghost" type="button" data-rrpp-pausa="${l.paused ? '0' : '1'}" data-id="${esc(l.id)}">${esc(l.paused ? bi('Reanudar el enlace', 'Resume the link') : bi('Pausar el enlace', 'Pause the link'))}</button>
        <button class="btn sm bad ghost" type="button" data-rrpp-quita-enlace data-id="${esc(l.id)}">${esc(bi('Quitar el enlace', 'Remove the link'))}</button>
      </div>
    </div>
  </div>`;
}

// ── En «Validar códigos»: buscar en las listas de esta noche ─────────────────
/** Pinta en `caja` el buscador de las listas de esta noche (solo si hay
 * alguien apuntado con un RRPP). «Validar» pregunta antes y le pasa el
 * resultado a `alValidar` (el mismo que el escáner). */
async function rrppPuerta(caja, alValidar) {
  if (!caja) return;
  let primera;
  try { primera = rrppOk(await rpc('door_list', { p_business: BIZ.id, p_query: null })); } catch { caja.innerHTML = ''; return; }
  if (!caja.isConnected) return;
  if (!(primera?.items || []).length) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<div class="card" style="margin-top:18px"><h2>${esc(bi('Buscar en las listas de esta noche', "Search tonight's lists"))}</h2>
    <div class="toolbar"><input id="rrppBusca" class="grow" type="search" autocomplete="off"
      placeholder="${esc(bi('Nombre de la persona o del RRPP', "Person's or promoter's name"))}" aria-label="${esc(bi('Buscar en las listas de esta noche', "Search tonight's lists"))}"></div>
    <div id="rrppPuertaLista"></div></div>`;
  let items = primera.items;
  const pinta = () => {
    const lugar = $('#rrppPuertaLista', caja);
    if (!lugar) return;
    lugar.innerHTML = table({
      cols: [
        { h: bi('Persona', 'Person'), r: (x) => `${rrppAvatar({ name: x.name, avatar: x.avatar })}<b class="title">${esc(x.name || I18N.t('Usuario de Klendar'))}</b><span class="sub">${rrppListaDe(x, true)}</span>` },
        { h: bi('Publicación', 'Publication'), r: (x) => `${esc(x.offer_title || '')}${x.promoter_offer ? ` <span class="tag rrpp-tag">${esc(bi('Oferta de RRPP', 'Promoter offer'))}</span>` : ''}` },
        { h: bi('Plazas', 'Places'), num: true, r: (x) => fmtNum(x.seats || 1) },
        { h: bi('Estado', 'Status'), r: (x) => rrppEstadoCodigo(x.status, x.validated_at) },
        { h: '', r: (x) => (x.status === 'pending' ? `<div class="actions"><button class="btn sm primary" type="button" data-rrpp-valida="${esc(x.id)}">${esc(bi('Validar', 'Validate'))}</button></div>` : '') },
      ],
      rows: items,
      empty: bi('Nadie con ese nombre en las listas de esta noche', "Nobody with that name on tonight's lists"),
    });
    $$('[data-rrpp-valida]', lugar).forEach((b) => {
      b.onclick = async () => {
        const x = items.find((i) => i.id === b.dataset.rrppValida) || {};
        const persona = x.name || I18N.t('Usuario de Klendar');
        if (!await confirmDlg(bi(`¿Validar el código de ${persona}?`, `Validate ${persona}'s code?`), '', { submit: bi('Validar', 'Validate') })) return;
        b.disabled = true;
        try {
          const res = await rpc('door_validate', { p_redemption: x.id });
          alValidar(res || { ok: false, error: 'invalid_code' });
          await busca();
        } catch (e) { toast(rrppError(e), true); b.disabled = false; }
      };
    });
  };
  let reloj = null;
  let pedida = 0;
  const busca = async () => {
    const n = ++pedida;
    const q = ($('#rrppBusca', caja)?.value || '').trim();
    try {
      const r = rrppOk(await rpc('door_list', { p_business: BIZ.id, p_query: q || null }));
      if (n !== pedida) return; // ya hay otra búsqueda más nueva
      items = r.items || [];
      pinta();
    } catch (e) { toast(rrppError(e), true); }
  };
  $('#rrppBusca', caja).addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(busca, 300); });
  pinta();
}

// ── El formulario de publicación: «Solo con el enlace de un RRPP» ───────────
/** Lo que el formulario necesita: los RRPP del negocio (para «Solo
 * algunos») y los que ya tiene la publicación (`origen`: la que se edita o
 * de la que se copia). */
async function rrppFormularioCarga(origen, o) {
  const [lista, elegidos] = await Promise.all([
    rpc('business_promoters_list', { p_business: BIZ.id }).catch(() => []),
    origen && o?.promoter_scope === 'some' ? rpc('offer_promoter_ids', { p_offer: origen }).catch(() => []) : Promise.resolve([]),
  ]);
  return {
    promotores: (lista || []).filter((p) => p.status === 'active' || p.status === 'paused'),
    elegidos: new Set(elegidos || []),
  };
}

/** Las opciones de RRPP del formulario de publicación, en tres trozos (se
 * ven solo con «Solo con el enlace de un RRPP»): `quien` (para qué RRPP, en
 * «Más opciones» › «Quién la ve»), `codigo` (plazas por RRPP y hasta cuándo
 * vale el código, en «Plazas y código»: la única caducidad del código en una
 * de RRPP) y `resumen` («Cómo funcionará», debajo de los bloques). */
function rrppFormularioHtml(o, datos) {
  const aud = o.audience || 'all';
  const scope = o.promoter_scope === 'some' ? 'some' : 'all';
  const hasta = (o.promoter_code_until || '').slice(0, 5);
  // De serie, «Mientras dure la publicación» (no «hasta la 1:00»).
  const validez = hasta ? 'hasta' : o.promoter_code_hours ? 'horas' : 'siempre';
  const ps = datos?.promotores || [];
  const oculto = aud === 'promoters' ? '' : 'hidden';
  const quien = `<div id="rrppOpc" class="rrpp-opc" ${oculto}>
    <p class="hint">${esc(bi('Solo la ve quien entra por el enlace o el QR de un RRPP.',
      "Only people who come in through a promoter's link or QR see it."))}</p>
    <p class="rrpp-preg">${esc(bi('¿Para qué RRPP?', 'Which promoters?'))}</p>
    <label class="opcion"><input type="radio" name="promoter_scope" value="all" ${scope === 'all' ? 'checked' : ''}><span>${esc(bi('Todos', 'All'))}</span></label>
    <label class="opcion"><input type="radio" name="promoter_scope" value="some" ${scope === 'some' ? 'checked' : ''}><span>${esc(bi('Solo algunos', 'Only some'))}</span></label>
    <div id="rrppAlgunos" class="rrpp-algunos" ${scope === 'some' ? '' : 'hidden'}>
      ${ps.length ? ps.map((p) => `<label class="opcion"><input type="checkbox" name="rrpp_elegido" value="${esc(p.id)}" ${datos.elegidos.has(p.id) ? 'checked' : ''}><span>${esc(rrppNombre(p))}${p.status === 'paused' ? ` <small class="muted">· ${esc(bi('En pausa', 'Paused'))}</small>` : ''}</span></label>`).join('')
        : `<p class="hint">${esc(bi('Aún no tienes RRPP: invítalos en «RRPP».', 'You have no promoters yet: invite them in “Promoters”.'))}</p>`}
    </div>
  </div>`;
  const codigo = `<div id="rrppCod" class="rrpp-opc bl-fila" ${oculto}>
    <p class="rrpp-preg">${esc(bi('Plazas por RRPP', 'Places per promoter'))}</p>
    <div class="rrpp-fila">
      <label class="opcion"><input type="checkbox" name="rrpp_sin_limite" ${o.promoter_quota ? '' : 'checked'}><span>${esc(bi('Sin límite', 'No limit'))}</span></label>
      <input type="number" name="promoter_quota" min="1" max="10000" step="1" value="${esc(o.promoter_quota ?? '')}" aria-label="${esc(bi('Plazas por RRPP', 'Places per promoter'))}" ${o.promoter_quota ? '' : 'disabled'}>
    </div>
    <p class="hint">${esc(bi('Los códigos anulados o caducados devuelven la plaza. Puedes cambiarlo para un RRPP concreto en «RRPP».', 'Cancelled or expired codes give the place back. You can change it for a particular promoter in “Promoters”.'))}</p>
    <p class="rrpp-preg">${esc(bi('¿Hasta cuándo vale el código?', 'How long is the code valid?'))}</p>
    <label class="opcion"><input type="radio" name="rrpp_validez" value="siempre" ${validez === 'siempre' ? 'checked' : ''}><span>${esc(bi('Mientras dure la publicación', 'While the publication lasts'))}</span></label>
    <p class="hint" style="margin:0 0 6px 28px">${esc(bi('El código vale hasta que termine el evento o la oferta.', 'The code is valid until the event or the offer ends.'))}</p>
    <div class="rrpp-fila">
      <label class="opcion"><input type="radio" name="rrpp_validez" value="hasta" ${validez === 'hasta' ? 'checked' : ''}><span>${esc(bi('Hasta una hora fija', 'Until a set time'))}</span></label>
      <input type="time" name="promoter_code_until" value="${esc(hasta || '01:00')}" aria-label="${esc(bi('Hasta una hora fija', 'Until a set time'))}">
    </div>
    <div class="rrpp-fila">
      <label class="opcion"><input type="radio" name="rrpp_validez" value="horas" ${validez === 'horas' ? 'checked' : ''}><span>${esc(bi('Durante', 'For'))}</span></label>
      <input type="number" name="promoter_code_hours" min="1" max="24" step="1" value="${esc(o.promoter_code_hours || 3)}" aria-label="${esc(bi('Horas', 'Hours'))}">
      <span>${esc(bi('horas desde que se apunta', 'hours after signing up'))}</span>
    </div>
    <p class="hint" style="margin:6px 0 0">${esc(bi('Nunca pasa del final de la publicación.', 'It never goes past the end of the publication.'))}</p>
  </div>`;
  const resumen = `<div class="card rrpp-resumen" id="rrppRes" style="margin:14px 0 0;padding:12px 14px" aria-live="polite" ${oculto}>
      <p class="rrpp-preg" style="margin:0 0 4px">${esc(bi('Cómo funcionará', 'How it will work'))}</p>
      <p id="rrppResumen" style="margin:0"></p></div>`;
  return { quien, codigo, resumen };
}

/** Enseña u oculta las opciones según «Quién la ve» y «¿Para qué RRPP?». */
function rrppFormularioEngancha(v) {
  const sync = () => {
    const aud = $('[name=audience]:checked', v)?.value || 'all';
    for (const sel of ['#rrppOpc', '#rrppCod', '#rrppRes']) { const el = $(sel, v); if (el) el.hidden = aud !== 'promoters'; }
    // En una de RRPP manda «¿Hasta cuándo vale el código?», no los minutos
    // de «¿Cuánto vale el código?» (pensados para enseñarlo en el local).
    const ttl = $('#ttlRow', v);
    if (ttl && aud === 'promoters') ttl.hidden = true;
    $('#rrppAlgunos', v).hidden = ($('[name=promoter_scope]:checked', v)?.value || 'all') !== 'some';
    const sin = $('[name=rrpp_sin_limite]', v).checked;
    $('[name=promoter_quota]', v).disabled = sin;
  };
  $$('[name=audience], [name=promoter_scope], [name=rrpp_sin_limite]', v).forEach((el) => el.addEventListener('change', sync));
  // «Cómo funcionará», en lenguaje normal: cuándo, hasta cuándo vale y a
  // cuántas personas puede apuntar cada RRPP.
  const resumen = () => {
    const el = $('#rrppResumen', v);
    if (!el) return;
    const ini = $('[name=start]', v)?.value ? fromLocalInput($('[name=start]', v).value) : null;
    const fin = $('[name=end]', v)?.value ? fromLocalInput($('[name=end]', v).value) : null;
    const validez = $('[name=rrpp_validez]:checked', v)?.value || 'siempre';
    const h = $('[name=promoter_code_until]', v)?.value || '';
    const n = Number($('[name=promoter_code_hours]', v)?.value) || 0;
    const sin = $('[name=rrpp_sin_limite]', v)?.checked;
    const cupo = Number($('[name=promoter_quota]', v)?.value) || 0;
    const algunos = ($('[name=promoter_scope]:checked', v)?.value || 'all') === 'some';
    const elegidos = $$('[name=rrpp_elegido]:checked', v).map((x) => x.closest('label')?.querySelector('span')?.firstChild?.textContent?.trim()).filter(Boolean);
    const partes = [
      rrppCuando(ini, fin),
      rrppValidezTxt(validez === 'hasta' ? h : null, validez === 'horas' ? n : null),
      sin || !cupo ? bi('Sin límite de personas por RRPP', 'No limit on people per promoter')
        : algunos && elegidos.length === 1 ? bi(`${elegidos[0]} puede apuntar a ${cupo === 1 ? '1 persona' : `${cupo} personas`}`, `${elegidos[0]} can sign up ${cupo === 1 ? '1 person' : `${cupo} people`}`)
          : bi(`Cada RRPP puede apuntar a ${cupo === 1 ? '1 persona' : `${cupo} personas`}`, `Each promoter can sign up ${cupo === 1 ? '1 person' : `${cupo} people`}`),
      bi('Las listas funcionan cuando el local está abierto (o en el horario de cada RRPP)', "The lists work while the venue is open (or during each promoter's hours)"),
    ].filter(Boolean);
    el.textContent = partes.map((x) => (x.endsWith('.') ? x : `${x}.`)).join(' ');
  };
  v.addEventListener('input', resumen);
  v.addEventListener('change', resumen);
  resumen();
  // Escribir una hora o unas horas ya elige esa opción.
  $('[name=promoter_code_until]', v).addEventListener('input', () => { $('[name=rrpp_validez][value=hasta]', v).checked = true; });
  $('[name=promoter_code_hours]', v).addEventListener('input', () => { $('[name=rrpp_validez][value=horas]', v).checked = true; });
  sync();
}

/** Las columnas `promoter_*` de lo que hay escrito, o `{ error }`. `ids`:
 * los RRPP elegidos si es «Solo algunos». */
function rrppFormularioLee(v) {
  const scope = $('[name=promoter_scope]:checked', v)?.value === 'some' ? 'some' : 'all';
  const ids = $$('[name=rrpp_elegido]:checked', v).map((el) => el.value);
  if (scope === 'some' && !ids.length) return { error: bi('Marca al menos un RRPP o elige «Todos».', 'Tick at least one promoter or choose “All”.'), el: $('[name=promoter_scope][value=some]', v) };
  let quota = null;
  if (!$('[name=rrpp_sin_limite]', v).checked) {
    quota = Number($('[name=promoter_quota]', v).value);
    if (!Number.isInteger(quota) || quota < 1 || quota > 10000) return { error: bi('Las plazas por RRPP van de 1 a 10.000 (o «Sin límite»).', 'Places per promoter go from 1 to 10,000 (or “No limit”).'), el: $('[name=promoter_quota]', v) };
  }
  const validez = $('[name=rrpp_validez]:checked', v)?.value || 'siempre';
  let until = null;
  let hours = null;
  if (validez === 'hasta') {
    until = String($('[name=promoter_code_until]', v).value || '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(until)) return { error: bi('Elige hasta qué hora vale el código.', 'Choose the time the code is valid until.'), el: $('[name=promoter_code_until]', v) };
  } else if (validez === 'horas') {
    hours = Number($('[name=promoter_code_hours]', v).value);
    if (!Number.isInteger(hours) || hours < 1 || hours > 24) return { error: bi('El código puede valer de 1 a 24 horas.', 'The code can be valid for 1 to 24 hours.'), el: $('[name=promoter_code_hours]', v) };
  }
  return {
    cols: { promoter_scope: scope, promoter_quota: quota, promoter_code_until: until, promoter_code_hours: hours },
    ids,
  };
}
/** Lo que se escribe al dejar de ser de RRPP: lo de siempre. */
const RRPP_COLUMNAS_FUERA = { promoter_scope: 'all', promoter_quota: null, promoter_code_until: null, promoter_code_hours: null };

/** Después de guardar: para qué RRPP es («Solo algunos»). */
async function rrppGuardaElegidos(offerId, ids) {
  rrppOk(await rpc('set_offer_promoters', { p_offer: offerId, p_promoters: ids }));
}
