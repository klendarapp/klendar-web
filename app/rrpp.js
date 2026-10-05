/* «Tu cuenta»: RRPP (relaciones públicas).
 *
 * - Entrar por el enlace de un RRPP (klendar.app/rp/<código>) y conseguir el
 *   código desde la ficha (`#/codigo/<id>?rp=<código>`): app.js le pasa el
 *   código a `start_redemption` (`p_rp`) y aquí están los errores nuevos.
 * - Ser RRPP: «Tus listas de RRPP» en la portada (solo si tienes alguna) y
 *   la pantalla de cada una (#/rrpp/<id>): tu enlace con su QR, tus ofertas
 *   con su cupo, tu lista de la noche (se refresca sola cada 30 s mientras
 *   miras «Esta noche») y «Dejar de ser RRPP». Nunca el correo, el teléfono
 *   ni la fecha de nacimiento de nadie (la base no los da).
 * - Las invitaciones para ser RRPP van en «Invitaciones» (cuenta.js).
 *
 * Lo mismo que la app (migraciones 20261110100000…03) y contra las mismas
 * funciones. Va después de app.js, cuenta.js y amigos.js y usa lo suyo
 * (`RUTAS`, `llamar`, `pinta`, `t`, `esc`, `ic`, `fila`, `confirma`,
 * `avatarDeAmigo`, `compartirOCopiar`…). Comparten ámbito: los nombres de
 * aquí empiezan por `rrpp`.
 */
'use strict';

Object.assign(ERRORES, {
  promoter_only: 'Esta oferta es solo con el enlace de un RRPP.',
  promoter_self: 'Es tu propio enlace: no puedes apuntarte a tu lista.',
  promoter_team: 'Eres del equipo de este negocio: no cuentas para ningún RRPP.',
});

const RRPP_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El código del enlace que trae la ruta (`?rp=`), o ''. */
function rrppDeParams(params) {
  const c = String(params?.get?.('rp') || '').trim().toLowerCase();
  return /^[a-z0-9]{8,16}$/.test(c) ? c : '';
}
/** klendar.app/rp/<código> (en local, el servidor de pruebas). */
const rrppEnlace = (code) => `${location.origin.replace('://www.', '://')}/rp/${code}`;
/** Sin nombre en el perfil: «Usuario de Klendar». */
const rrppNombre = (p) => (p && String(p.name || '').trim()) || t('Usuario de Klendar');
/** «la 1:00», «las 2:30» / «01:00». */
function rrppHora(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return String(hhmm || '');
  const h = Number(m[1]);
  return EN ? `${String(h).padStart(2, '0')}:${m[2]}` : `${h === 1 ? 'la' : 'las'} ${h}:${m[2]}`;
}

/** Los errores nuevos de `start_redemption` con un enlace de RRPP: una
 * pantalla que lo cuenta (no un error suelto). Devuelve true si era uno. */
async function rrppErrorCodigo(e, id, rp) {
  const clave = e?.clave || '';
  if (!/^promoter_(only|quota_full|time_over|self|team)$/.test(clave)) return false;
  const d = e.datos || {};
  let nombre = '';
  if (clave === 'promoter_quota_full' && rp) {
    try {
      const fila = await llamar('offer_detail', { p_id: id, p_rp: rp });
      nombre = rrppNombre((Array.isArray(fila) ? fila[0] : fila)?.promoter);
    } catch { nombre = t('Usuario de Klendar'); }
  }
  const titulo = {
    promoter_only: t('Esta oferta es solo con el enlace de un RRPP.'),
    promoter_quota_full: EN ? `There are no places left on ${nombre}'s list.` : `Ya no quedan plazas en la lista de ${nombre}.`,
    promoter_time_over: EN ? `It's too late: it was valid until ${rrppHora(d.until)}.` : `Ya es tarde: valía hasta ${rrppHora(d.until)}.`,
    promoter_self: t('Es tu propio enlace: no puedes apuntarte a tu lista.'),
    promoter_team: t('Eres del equipo de este negocio: no cuentas para ningún RRPP.'),
  }[clave];
  // Sin un enlace que la tenga, su ficha no se abre: al negocio.
  const botones = clave === 'promoter_only'
    ? `${d.business_id ? `<a class="pill accent" href="${pre}/b/${esc(d.business_id)}">${esc(EN ? `See ${d.business_name || ''}` : `Ver ${d.business_name || ''}`)}</a>` : ''}
       ${botonTuCuenta().replace('pill accent', d.business_id ? 'pill' : 'pill accent')}`
    : `<a class="pill accent" href="${pre}/o/${esc(id)}${rp ? `?rp=${esc(rp)}` : ''}">${esc(t('Volver a la publicación'))}</a>
       <a class="pill" href="#/">${esc(t('Tu cuenta'))}</a>`;
  pinta(pantallaVacia({ icono: 'group', titulo, h: 'h1', botones }));
  return true;
}

// ── En la portada: «Tus listas de RRPP» (solo si tienes alguna) ──────────────
function rrppPortadaHtml(roles) {
  if (!Array.isArray(roles) || !roles.length) return '';
  const esta = (n) => (EN ? `Tonight: ${n} signed up` : `Esta noche: ${n} ${n === 1 ? 'apuntado' : 'apuntados'}`);
  return `<h2 class="seccion-t">${esc(t('Tus listas de RRPP'))}</h2>
    <div class="lista">${roles.map((r) => fila({
      href: `#/rrpp/${r.promoter_id}`, icono: 'group', titulo: r.business_name || '',
      detalle: r.status === 'paused' ? t('En pausa') : esta(Number(r.tonight) || 0),
    })).join('')}</div>`;
}

// ── #/rrpp y #/rrpp/<id>: la pantalla del RRPP ───────────────────────────────
RUTAS.rrpp = async ([id], params) => {
  if (!exigeSesion(`rrpp${id ? `/${id}` : ''}`)) return;
  if (!id) {
    // Sin una concreta: la única que tengas, o la lista.
    const roles = await llamar('my_promoter_roles', {}).catch(() => []);
    if ((roles || []).length === 1) { location.replace(`#/rrpp/${roles[0].promoter_id}`); return; }
    pinta(roles?.length
      ? `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p><h1>${esc(t('Tus listas de RRPP'))}</h1>${rrppPortadaHtml(roles).replace(/^<h2[^>]*>.*?<\/h2>/s, '')}`
      : pantallaVacia({ icono: 'group', titulo: t('No eres RRPP de ningún negocio.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  if (!RRPP_UUID.test(id)) {
    pinta(pantallaVacia({ icono: 'group', titulo: t('No eres RRPP de ningún negocio.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  const pedida = /^\d{4}-\d{2}-\d{2}$/.test(params?.get('noche') || '') ? params.get('noche') : null;
  let d;
  try {
    d = await llamar('promoter_home', { p_promoter: id, p_night: pedida });
  } catch (e) {
    if (e.clave === 'not_found') {
      pinta(pantallaVacia({ icono: 'group', titulo: t('Ya no eres RRPP de este negocio.'), h: 'h1', botones: botonTuCuenta() }));
      return;
    }
    throw e;
  }
  const b = d.business || {};
  const tz = (await zonasDe([{ business_id: b.id }]))({ business_id: b.id });
  const noche = (iso) => (iso === d.tonight ? t('Esta noche')
    : new Intl.DateTimeFormat(LOC, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)));
  const hora = (iso) => fecha(iso, { hour: '2-digit', minute: '2-digit' }, tz);
  // Tu enlace: el primero que funciona (si no, el primero).
  const enlaces = d.links || [];
  const principal = enlaces.find((l) => l.state === 'ok') || enlaces[0] || null;
  const otros = enlaces.filter((l) => l !== principal);
  const url = principal ? rrppEnlace(principal.code) : '';
  const estadoEnlace = (l) => (l.state === 'paused' ? t('En pausa') : l.state === 'expired' ? t('Caducado')
    : l.state === 'inactive' ? t('Este enlace ya no funciona.') : '');
  const opciones = [...new Set([d.tonight, d.night, ...(d.nights || []).map((x) => x.night)].filter(Boolean))].sort().reverse();

  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(EN ? `Promoter for ${b.name || ''}` : `RRPP de ${b.name || ''}`)}</h1>
    ${d.status === 'paused' ? `<p class="aviso-error">${esc(EN
      ? `${b.name} has paused your links: in the meantime, people who use them won't count for you.`
      : `${b.name} ha pausado tus enlaces: mientras tanto, quien entre por ellos no cuenta para ti.`)}</p>` : ''}

    <section class="bloque">
      <h2>${esc(t('Tu enlace'))}</h2>
      ${principal ? `<div class="enlace-amigo">
        <div class="qr" id="rrpp-qr" role="img" aria-label="${esc(t('Tu enlace'))}"></div>
        <p><button type="button" class="enlace-txt" id="rrpp-copiar-url">${ic('link')} <span>${esc(url.replace(/^https?:\/\//, ''))}</span></button></p>
        ${principal.label || estadoEnlace(principal) ? `<p class="muted">${esc([principal.label, estadoEnlace(principal)].filter(Boolean).join(' · '))}</p>` : ''}
        <div class="acciones enlace-acc">
          <button type="button" class="pill accent" id="rrpp-compartir">${ic('share')} ${esc(t('Compartir'))}</button>
          <button type="button" class="pill" id="rrpp-copiar">${ic('content_copy')} ${esc(t('Copiar enlace'))}</button>
        </div>
      </div>
      ${otros.length ? `<div class="lista rrpp-otros">${otros.map((l) => `
        <div class="fila">${ic('link')}
          <span class="fila-t"><b>${esc(l.label || l.code)}</b><small>${esc([rrppEnlace(l.code).replace(/^https?:\/\//, ''), estadoEnlace(l)].filter(Boolean).join(' · '))}</small></span>
          <button type="button" class="icono-btn" data-rrpp-copia="${esc(rrppEnlace(l.code))}" aria-label="${esc(t('Copiar enlace'))}" title="${esc(t('Copiar enlace'))}">${ic('content_copy')}</button>
        </div>`).join('')}</div>` : ''}`
        : `<p class="muted">${esc(EN ? `You don't have any links yet. Ask ${b.name} for one.` : `Aún no tienes enlaces. Pídeselos a ${b.name}.`)}</p>`}
    </section>

    ${(d.offers || []).length ? `<section class="bloque">
      <h2>${esc(t('Tus ofertas'))}</h2>
      <div class="lista">${d.offers.map((o) => {
        const cupo = o.quota == null ? t('Sin límite')
          : (EN ? `${o.used} of ${o.quota} places` : `${o.used} de ${o.quota} plazas`);
        const vale = o.code_until ? (EN ? `The code is valid until ${rrppHora(o.code_until)}` : `El código vale hasta ${rrppHora(o.code_until)}`)
          : o.code_hours ? (EN ? `The code is valid for ${o.code_hours} ${o.code_hours === 1 ? 'hour' : 'hours'} after you get it`
            : `El código vale ${o.code_hours} ${o.code_hours === 1 ? 'hora' : 'horas'} desde que lo consigues`) : '';
        const cuando = fecha(o.kind === 'future_event' ? o.event_at : o.redeem_start_at, undefined, tz);
        return `<a class="fila" href="${pre}/o/${esc(o.id)}${principal ? `?rp=${esc(principal.code)}` : ''}">
          ${ic(o.kind === 'future_event' ? 'local_activity' : 'qr_code_2')}
          <span class="fila-t"><b>${esc(o.title || '')}</b><small>${esc([cuando, cupo, vale].filter(Boolean).join(' · '))}</small></span>
          ${ic('chevron_right')}</a>`;
      }).join('')}</div>
    </section>` : ''}

    <section class="bloque">
      <h2>${esc(t('Tu lista'))}</h2>
      <p class="rrpp-noche-p"><select id="rrpp-noche" class="rrpp-noche" aria-label="${esc(t('Noche'))}">${opciones.map((n) => `<option value="${esc(n)}" ${n === d.night ? 'selected' : ''}>${esc(noche(n))}</option>`).join('')}</select></p>
      <div id="rrpp-lista"></div>
      <p class="muted rrpp-pie">${esc(t('Solo ves el nombre y la foto de quien se apunta, qué ha sacado y si ha entrado. Nunca su correo, su teléfono ni su fecha de nacimiento.'))}</p>
    </section>

    <button class="pill ancho peligro" type="button" id="rrpp-dejar">${esc(t('Dejar de ser RRPP'))}</button>`);

  // La lista de la noche (y, en «Esta noche», al día cada 30 s).
  const pintaLista = (x) => {
    const caja = $('#rrpp-lista');
    if (!caja) return;
    const lista = x.list || [];
    const deEsa = (x.nights || []).find((n) => n.night === x.night);
    const apuntados = deEsa ? deEsa.signed : lista.length;
    const dentro = deEsa ? deEsa.entered : lista.filter((r) => r.status === 'validated').length;
    const estado = (r) => (r.status === 'validated' ? (EN ? `In at ${hora(r.entered_at)}` : `Dentro a las ${hora(r.entered_at)}`)
      : r.status === 'expired' ? t('Caducado') : t('Aún no ha entrado'));
    caja.innerHTML = `<p class="muted rrpp-resumen">${esc(EN ? `${apuntados} signed up · ${dentro} got in`
      : `${apuntados} ${apuntados === 1 ? 'apuntado' : 'apuntados'} · ${dentro} dentro`)}</p>
      ${lista.length ? `<div class="lista">${lista.map((r) => `
        <div class="fila rrpp-fila">
          ${avatarDeAmigo({ name: r.name, avatar: r.avatar }, 'av-lista')}
          <span class="fila-t"><b>${esc(rrppNombre(r))}</b>
            <small>${esc([EN ? `Signed up at ${hora(r.joined_at)}` : `Se apuntó a las ${hora(r.joined_at)}`, r.offer_title,
              EN ? `${r.seats} ${r.seats === 1 ? 'place' : 'places'}` : `${r.seats} ${r.seats === 1 ? 'plaza' : 'plazas'}`].filter(Boolean).join(' · '))}</small>
            ${r.off_offer ? `<small class="rrpp-fuera">${esc(t('fuera de tu oferta'))}</small>` : ''}</span>
          <span class="tag rrpp-estado${r.status === 'validated' ? ' rrpp-dentro' : ' off'}">${esc(estado(r))}</span>
        </div>`).join('')}</div>`
        : `<div class="empty"><p>${esc(t('Aún no se ha apuntado nadie.'))}</p></div>`}`;
  };
  pintaLista(d);
  if (d.night === d.tonight) {
    const reloj = setInterval(async () => {
      if (!$('#rrpp-lista')) { clearInterval(reloj); return; }
      try { pintaLista(await llamar('promoter_home', { p_promoter: id, p_night: null })); } catch { /* sin red: la de antes */ }
    }, 30000);
    alSalir(() => clearInterval(reloj));
  }
  $('#rrpp-noche').onchange = (ev) => {
    location.hash = ev.target.value === d.tonight ? `#/rrpp/${id}` : `#/rrpp/${id}?noche=${ev.target.value}`;
  };

  if (principal) {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('#rrpp-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    const copia = async (texto) => {
      try { await navigator.clipboard.writeText(texto); toast(t('Enlace copiado')); } catch { toast(t('No se ha podido copiar'), true); }
    };
    $('#rrpp-copiar').onclick = () => copia(url);
    $('#rrpp-copiar-url').onclick = () => copia(url);
    $('#rrpp-compartir').onclick = () => compartirOCopiar(`${b.name || 'Klendar'}: ${url}`, url);
    $$('[data-rrpp-copia]').forEach((x) => { x.onclick = () => copia(x.dataset.rrppCopia); });
  }

  $('#rrpp-dejar').onclick = async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: EN ? `Stop being a promoter for ${b.name}?` : `¿Dejar de ser RRPP de ${b.name}?`,
      texto: t('Tus enlaces dejarán de funcionar. Se lo diremos al negocio.'),
      aceptar: t('Dejar de ser RRPP'),
      peligro: true,
    }))) return;
    ocupado(boton, async () => {
      await llamar('leave_promoter', { p_promoter: id });
      toast(EN ? `You're no longer a promoter for ${b.name}.` : `Ya no eres RRPP de ${b.name}.`);
      vuelve('');
    });
  };
};

// ── Invitaciones para ser RRPP (en «Invitaciones», cuenta.js) ────────────────
/** Las tarjetas de las invitaciones de RRPP. */
function rrppInvitacionesHtml(lista) {
  const dia = (s) => new Date(s).toLocaleDateString(EN ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  return (lista || []).map((i) => `
      <div class="lista inv-eq">
        <p class="inv-eq-t"><b>${esc(EN ? `${i.business_name} invites you to be a promoter` : `${i.business_name} te invita a ser RRPP`)}</b>
          ${i.business_city ? `<small class="muted">${esc(i.business_city)}</small>` : ''}</p>
        ${i.invited_by_name ? `<p>${esc(EN ? `Invited by ${i.invited_by_name}` : `Te invita ${i.invited_by_name}`)}</p>` : ''}
        <p class="muted">${esc(t('Tendrás tus enlaces y verás tu lista. No podrás cambiar nada del negocio.'))}</p>
        ${i.expires_at ? `<p class="muted">${esc(EN ? `Expires on ${dia(i.expires_at)}` : `Caduca el ${dia(i.expires_at)}`)}</p>` : ''}
        <p class="dos-pills">
          <button class="pill" type="button" data-rp-no="${esc(i.id)}">${esc(t('Rechazar'))}</button>
          <button class="pill accent" type="button" data-rp-si="${esc(i.id)}">${esc(t('Aceptar'))}</button>
        </p>
      </div>`).join('');
}

/** Aceptar o rechazar una (`respond_promoter_invite`). `repinta`: vuelve a
 * pintar «Invitaciones». */
function rrppEnganchaInvitaciones(lista, repinta) {
  const contesta = async (idInv, acepta, boton) => {
    boton.disabled = true;
    const negocio = (lista || []).find((x) => x.id === idInv)?.business_name || '';
    try {
      const r = await llamar('respond_promoter_invite', { p_invite: idInv, p_accept: acepta });
      if (acepta) {
        toast(EN ? `You're now a promoter for ${r.business_name || negocio}.` : `Ya eres RRPP de ${r.business_name || negocio}.`);
        location.hash = `#/rrpp/${r.promoter_id}`;
        return;
      }
      toast(t('Invitación rechazada.'));
    } catch (e) {
      const motivo = {
        expired: t('Esta invitación ha caducado.'),
        not_found: t('Esta invitación ha caducado.'),
        min_age_16: EN ? `To be a promoter for ${negocio} you need to be 16 and have your date of birth in your profile.`
          : `Para ser RRPP de ${negocio} hace falta tener 16 años y la fecha de nacimiento en tu perfil.`,
        adult_required: EN ? `${negocio} is 18+: to be its promoter you need to be 18 and have your date of birth in your profile.`
          : `${negocio} es +18: para ser su RRPP hace falta tener 18 años y la fecha de nacimiento en tu perfil.`,
        account_suspended: t('Tu cuenta está suspendida. Si crees que es un error, escribe a info@klendar.app.'),
      }[e.clave];
      toast(motivo || e.message, true);
    }
    repinta();
  };
  $$('[data-rp-si]').forEach((b) => { b.onclick = () => contesta(b.dataset.rpSi, true, b); });
  $$('[data-rp-no]').forEach((b) => { b.onclick = () => contesta(b.dataset.rpNo, false, b); });
}
