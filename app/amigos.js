/* «Tu cuenta»: planes con amigos.
 *
 * Tu enlace de amigo (con su QR) y tu lista (#/amigos), el enlace de otra
 * persona abierto (#/amigo/<código>), marcar «Voy» (#/voy/<id>) e invitar a
 * amigos a una publicación (#/invitar/<id>). Lo mismo que la app y contra
 * las mismas funciones de la base. No hay buscador de personas: solo te
 * encuentra quien tiene tu enlace o escanea tu QR.
 *
 * Va después de app.js y cuenta.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`,
 * `t`, `esc`, `ic`, `confirma`, `ocupado`, `hecho`, `toast`…). Comparten
 * ámbito: los nombres de aquí no se repiten allí.
 */
'use strict';

Object.assign(ERRORES, {
  not_available: 'Esta publicación ya no está disponible.',
  daily_limit: 'Ya has mandado 20 invitaciones hoy. Mañana podrás mandar más.',
  needs_code: 'Para ir, consigue el código o reserva plaza: eso ya cuenta como que vas.',
});

const CODIGO_AMIGO = /^[A-Za-z0-9_-]{16}$/;
const UUID_AMIGOS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tu enlace para compartir: klendar.app/amigo/<código> (en local, el
 * servidor de pruebas, para poder abrirlo). */
const enlaceDeAmigo = (code) => `${location.origin.replace('://www.', '://')}/amigo/${code}`;

/** Sin nombre en el perfil: «Usuario de Klendar» (nunca el correo). */
const nombreDeAmigo = (p) => (p && p.name) || t('Usuario de Klendar');

/** La foto de alguien, o su inicial si no tiene. `clase`: tamaño. */
function avatarDeAmigo(p, clase = '') {
  const nombre = nombreDeAmigo(p);
  const foto = p && /^https:\/\//.test(p.avatar || '') ? p.avatar : '';
  return `<span class="av-amigo${clase ? ` ${clase}` : ''}" aria-hidden="true">${foto
    ? `<img src="${esc(foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : esc(nombre.trim().charAt(0).toUpperCase() || '·')}</span>`;
}

/** Hasta tres avatares solapados. */
const pilaDeAmigos = (lista) => `<span class="av-pila">${(lista || []).slice(0, 3).map((p) => avatarDeAmigo(p)).join('')}</span>`;

/** «Ana va» · «Ana y Bea van» · «Ana y 3 amigos más van». Solo amigos. */
function fraseQuienVa(lista, total) {
  const n = Math.max(total || 0, (lista || []).length);
  if (!n || !(lista || []).length) return '';
  const a = nombreDeAmigo(lista[0]);
  if (n === 1) return EN ? `${a} is going` : `${a} va`;
  if (n === 2 && lista[1]) {
    const b = nombreDeAmigo(lista[1]);
    return EN ? `${a} and ${b} are going` : `${a} y ${b} van`;
  }
  return EN ? `${a} and ${n - 1} more friends are going` : `${a} y ${n - 1} amigos más van`;
}

/** Compartir un texto con lo que tenga el móvil; si no hay, copiar `copia`. */
async function compartirOCopiar(texto, copia) {
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return; } catch (e) {
      if (e && e.name === 'AbortError') return; // lo ha cerrado quien comparte
    }
  }
  try { await navigator.clipboard.writeText(copia); toast(t('Enlace copiado')); } catch { toast(t('No se ha podido copiar'), true); }
}

// ── Amigos: tu enlace, tu QR y tu lista ───────────────────────────────────
RUTAS.amigos = async () => {
  if (!exigeSesion('amigos')) return;
  const [enlace, lista, cons, miNombre] = await Promise.all([
    llamar('my_friend_link', {}),
    llamar('my_friends', {}),
    llamar('my_consents', {}).catch(() => null),
    nombrePublico(),
  ]);
  const amigos = lista?.friends || [];
  const tope = lista?.limit || 500;
  const comparte = cons?.share_plans !== false;
  const dia = (iso) => fecha(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  const cuantos = (n) => (EN ? `${n} of ${tope}` : `${n} de ${tope}`);

  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Amigos'))}</h1>

    <section class="bloque bloque-amigos">
      <h2>${esc(t('Tu enlace de amigo'))}</h2>
      <div class="enlace-amigo">
        <div class="qr" id="qr-amigo" role="img" aria-label="${esc(t('Tu enlace de amigo'))}"></div>
        <p><button type="button" class="enlace-txt" id="copiar-enlace">${ic('link')} <span id="enlace-url"></span></button></p>
        <p class="muted">${esc(t('Quien lo abra con su cuenta podrá hacerse tu amigo. No hay buscador: solo te encuentra quien tiene tu enlace o escanea tu QR.'))}</p>
        <div class="acciones enlace-acc">
          <button type="button" class="pill accent" id="compartir-enlace">${ic('share')} ${esc(t('Compartir el enlace'))}</button>
          <button type="button" class="pill" id="copiar-enlace-2">${ic('content_copy')} ${esc(t('Copiar'))}</button>
        </div>
        <p><button type="button" class="linkbtn" id="cambiar-enlace">${esc(t('Cambiar el enlace'))}</button></p>
      </div>
      ${miNombre === null ? `<form class="formu nombre-publico" id="f-nombre" novalidate>
        <p class="muted">${esc(t('Quien abra tu enlace verá tu nombre. Sin él, sales como «Usuario de Klendar».'))}</p>
        ${campoNombrePublico()}
        <button class="pill" id="g-nombre">${esc(t('Guardar'))}</button>
      </form>` : ''}
      <p class="muted aviso-planes">${ic(comparte ? 'visibility' : 'visibility_off')}
        <span>${esc(t(comparte
          ? 'Tus amigos ven a qué planes vas. Puedes apagarlo en Ajustes → Privacidad.'
          : 'No compartes tus planes: tus amigos no ven a qué vas. Se cambia en Ajustes → Privacidad.'))}</span></p>
    </section>

    <section class="bloque bloque-amigos">
      <h2 class="con-cuenta"><span>${esc(t('Tus amigos'))}</span> <span id="cuantos-amigos">${esc(cuantos(amigos.length))}</span></h2>
      <div id="lista-amigos">${amigos.length ? `<div class="lista">${amigos.map((a) => `
        <div class="fila amigo-fila" data-id="${esc(a.id)}">
          ${avatarDeAmigo(a, 'av-lista')}
          <span class="fila-t"><b>${esc(nombreDeAmigo(a))}</b>
            <small>${esc(EN ? `Friends since ${dia(a.since)}` : `Amigos desde ${dia(a.since)}`)}</small></span>
          <button type="button" class="icono-btn" data-quitar="${esc(a.id)}" data-nombre="${esc(nombreDeAmigo(a))}"
            aria-label="${esc(t('Quitar de tus amigos'))}" title="${esc(t('Quitar de tus amigos'))}">${ic('person_remove')}</button>
          <button type="button" class="icono-btn" data-bloquear="${esc(a.id)}" data-nombre="${esc(nombreDeAmigo(a))}"
            aria-label="${esc(t('Bloquear'))}" title="${esc(t('Bloquear'))}">${ic('block')}</button>
        </div>`).join('')}</div>` : ''}</div>
      <div class="empty amigos-vacio" id="amigos-vacio"${amigos.length ? ' hidden' : ''}>
        <p><b>${esc(t('Aún no tienes amigos en Klendar'))}</b></p>
        <p>${esc(t('Manda tu enlace o enseña tu QR a quien quieras. Cuando lo acepte, sabrás a qué planes va y podrás invitarle a los tuyos.'))}</p>
      </div>
    </section>`);

  let url = '';
  const pintaEnlace = (code) => {
    url = enlaceDeAmigo(code);
    $('#enlace-url').textContent = url.replace(/^https?:\/\//, '');
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('#qr-amigo').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  };
  pintaEnlace(enlace.code);

  // Sin nombre: se pone aquí mismo, antes de mandar el enlace.
  const fn = $('#f-nombre');
  if (fn) {
    fn.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!fn.nombre.value.trim()) { fn.nombre.focus(); return; }
      ocupado($('#g-nombre'), async () => {
        await guardaNombrePublico(fn.nombre.value);
        fn.remove();
        toast(t('Nombre guardado'));
      });
    });
  }

  const copia = async () => {
    try { await navigator.clipboard.writeText(url); toast(t('Enlace copiado')); } catch { toast(t('No se ha podido copiar'), true); }
  };
  $('#copiar-enlace').onclick = copia;
  $('#copiar-enlace-2').onclick = copia;
  $('#compartir-enlace').onclick = () => compartirOCopiar(
    EN ? `Be my friend on Klendar so we can see which plans we're going to: ${url}`
      : `Hazte mi amigo en Klendar y vemos a qué planes vamos: ${url}`, url);
  $('#cambiar-enlace').onclick = async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('¿Cambiar tu enlace de amigo?'),
      texto: t('El enlace y el QR de ahora dejarán de valer. Tus amigos seguirán siéndolo.'),
      aceptar: t('Cambiar el enlace'),
    }))) return;
    ocupado(boton, async () => {
      try {
        const r = await llamar('rotate_friend_link', {});
        pintaEnlace(r.code);
        toast(t('Enlace cambiado. El anterior ya no vale.'));
      } catch (e) {
        throw e.clave === 'rate_limited' ? new Error(t('Demasiados intentos. Espera un rato y vuelve a probar.')) : e;
      }
    });
  };

  let quedan = amigos.length;
  $$('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    const nombre = b.dataset.nombre;
    if (!(await confirma({
      titulo: EN ? `Remove ${nombre} from your friends?` : `¿Quitar a ${nombre} de tus amigos?`,
      texto: t('Ya no verás a qué planes va ni podrá invitarte. No le avisamos.'),
      aceptar: t('Quitar'),
      peligro: true,
    }))) return;
    b.disabled = true;
    try {
      await llamar('remove_friend', { p_user: b.dataset.quitar });
      toast(EN ? `${nombre} is no longer one of your friends` : `${nombre} ya no está en tus amigos`);
      const filaAmigo = b.closest('.amigo-fila');
      const caja = filaAmigo?.parentElement;
      filaAmigo?.remove();
      if (caja && !caja.children.length) caja.remove();
      quedan -= 1;
      $('#cuantos-amigos').textContent = cuantos(quedan);
      $('#amigos-vacio').hidden = quedan > 0;
    } catch (e) {
      toast(e.message, true);
      if (b.isConnected) b.disabled = false;
    }
  }));
  // Bloquear: deja de ser tu amigo, no sale en tu «quién va» (ni tú en el
  // suyo), no puede invitarte y no ves sus reseñas. No se le avisa.
  $$('[data-bloquear]').forEach((b) => b.addEventListener('click', async () => {
    const nombre = b.dataset.nombre;
    if (!(await confirmaBloqueo(nombre))) return;
    b.disabled = true;
    try {
      await llamar('block_user', { p_user: b.dataset.bloquear });
      toast(EN ? `You've blocked ${nombre}` : `Has bloqueado a ${nombre}`);
      const filaAmigo = b.closest('.amigo-fila');
      const caja = filaAmigo?.parentElement;
      filaAmigo?.remove();
      if (caja && !caja.children.length) caja.remove();
      quedan -= 1;
      $('#cuantos-amigos').textContent = cuantos(quedan);
      $('#amigos-vacio').hidden = quedan > 0;
    } catch (e) {
      toast(e.message, true);
      if (b.isConnected) b.disabled = false;
    }
  }));
};

// ── El enlace de otra persona ─────────────────────────────────────────────
/** Una pantalla del enlace abierto: avatar (si se sabe de quién es), título,
 * explicación y botones. */
function pintaEnlaceAbierto({ quien, titulo, texto, botones }) {
  pinta(`
    <div class="ticket enlace-abierto">
      ${quien ? avatarDeAmigo(quien, 'av-grande') : `<p class="hecho-ic" aria-hidden="true">${ic('group')}</p>`}
      <h1>${esc(titulo)}</h1>
      ${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      <p class="acciones">${botones}</p>
    </div>`);
}
const botonVerAmigos = (principal = true) => `<a class="pill${principal ? ' accent' : ''}" href="#/amigos">${ic('group')} ${esc(t('Ver tus amigos'))}</a>`;

RUTAS.amigo = async ([code]) => {
  const valido = CODIGO_AMIGO.test(code || '');
  if (valido && !exigeSesion(`amigo/${code}`)) return;
  let info = null;
  let fallo = valido ? '' : 'not_found';
  if (valido) {
    try { info = await llamar('friend_link_info', { p_code: code }); } catch (e) {
      if (!['not_found', 'rate_limited', 'blocked'].includes(e.clave)) throw e;
      fallo = e.clave;
    }
  }
  const quien = info?.user || null;
  const nombre = nombreDeAmigo(quien);
  const tope = info?.friends_limit || 500;
  // Lo mismo para lo que diga friend_link_info y para lo que diga al aceptar.
  const estado = (clave) => {
    switch (clave) {
      case 'self': return pintaEnlaceAbierto({
        titulo: t('Este es tu enlace de amigo'),
        texto: t('Mándaselo a quien quieras: cuando lo abra, podrá hacerse tu amigo.'),
        botones: botonVerAmigos(),
      });
      case 'friends': return pintaEnlaceAbierto({
        quien, titulo: EN ? `You and ${nombre} are already friends` : `${nombre} y tú ya sois amigos`, botones: botonVerAmigos(),
      });
      case 'full': return pintaEnlaceAbierto({
        titulo: EN ? `You already have ${tope} friends` : `Ya tienes ${tope} amigos`,
        texto: t('Es el máximo. Quita a alguien de tus amigos para hacer sitio.'),
        botones: botonVerAmigos(),
      });
      case 'their_full': return pintaEnlaceAbierto({
        quien, titulo: EN ? `${nombre} already has ${tope} friends` : `${nombre} ya tiene ${tope} amigos`,
        texto: t('Es el máximo: no puede añadir a nadie más por ahora.'),
        botones: botonVerAmigos(false),
      });
      case 'too_many_today': return pintaEnlaceAbierto({
        quien, titulo: t('Demasiadas amistades nuevas hoy. Vuelve a probar mañana.'), botones: botonVerAmigos(false),
      });
      case 'rate_limited': return pintaEnlaceAbierto({
        titulo: t('Demasiados intentos. Espera un rato y vuelve a probar.'),
        botones: `<a class="pill" href="#/">${esc(t('Tu cuenta'))}</a>`,
      });
      // La tienes bloqueada tú (a quien está bloqueado se le dice que el
      // enlace no vale, como si no existiera).
      case 'blocked': return pintaEnlaceAbierto({
        titulo: t('Tienes bloqueada a esta persona'),
        texto: t('Para ser amigos, desbloquéala en Ajustes → Privacidad y datos → Personas bloqueadas.'),
        botones: `<a class="pill" href="#/ajustes">${esc(t('Ajustes'))}</a>`,
      });
      default: return pintaEnlaceAbierto({
        titulo: t('Este enlace ya no vale'),
        texto: t('Puede que lo haya cambiado. Pídele el nuevo.'),
        botones: `<a class="pill" href="#/">${esc(t('Tu cuenta'))}</a>`,
      });
    }
  };
  if (fallo) { estado(fallo); return; }
  if (info.state !== 'new') { estado(info.state); return; }

  pintaEnlaceAbierto({
    quien,
    titulo: EN ? `${nombre} wants to be your friend on Klendar` : `${nombre} quiere ser tu amigo en Klendar`,
    texto: t('Si aceptas, verás a qué planes va y podrás invitarle a los tuyos (y al revés). Puedes quitarle de tus amigos cuando quieras.'),
    botones: `<button type="button" class="pill accent" id="aceptar-amigo">${esc(t('Aceptar'))}</button>
      <a class="pill" href="#/">${esc(t('Ahora no'))}</a>`,
  });
  $('#aceptar-amigo').onclick = (ev) => ocupado(ev.currentTarget, async () => {
    let r;
    try { r = await llamar('accept_friend_link', { p_code: code }); } catch (e) {
      if (['not_found', 'self', 'full', 'their_full', 'too_many_today', 'rate_limited', 'blocked'].includes(e.clave)) {
        estado(e.clave);
        I18N.translate(view);
        return;
      }
      throw e;
    }
    // Recargar no vuelve a preguntar: la dirección pasa a la lista.
    history.replaceState(null, '', '#/amigos');
    const amigo = r.friend || quien;
    const n = nombreDeAmigo(amigo);
    pintaEnlaceAbierto({
      quien: amigo, titulo: EN ? `${n} is now one of your friends` : `${n} ya está en tus amigos`, botones: botonVerAmigos(),
    });
    I18N.translate(view);
  });
};

// ── «Voy» ─────────────────────────────────────────────────────────────────
/** Desde la ficha pública: marcar o quitar «Voy», como Guardar. Marcar
 * también la guarda en Planes. Quitarlo no anula una plaza ni un código:
 * si hay uno, sigues yendo (y se dice). */
RUTAS.voy = async ([id], params, crudo) => {
  const quitar = params?.get('quitar') === '1';
  if (!UUID_AMIGOS.test(id || '')) { pinta(pantallaVacia({ icono: 'link', titulo: t('Ese enlace no está completo.'), h: 'h1', botones: botonTuCuenta() })); return; }
  if (!exigeSesion(`voy/${id}${quitar ? '?quitar=1' : ''}`)) return;
  // Con código o reserva no hay «Voy» aparte (un solo botón): conseguirlo
  // ya cuenta como que vas. Un enlace viejo o una invitación llevan ahí.
  const fila = await llamar('offer_detail', { p_id: id }).catch(() => null);
  const of = Array.isArray(fila) ? fila[0] : fila;
  if (!quitar && of && (of.kind === 'flash_offer' || of.reservations_enabled)) {
    location.replace(`#/${of.kind === 'flash_offer' ? 'codigo' : 'reservar'}/${encodeURIComponent(id)}`);
    return;
  }
  // Desde fuera (sin pulsar «Voy» aquí) se pregunta antes: tus amigos lo ven.
  if (!(await confirmaEnlace(crudo, {
    titulo: t(quitar ? '¿Quitar tu «Voy»?' : '¿Marcar que vas?'),
    que: of ? [of.title, of.business_name].filter(Boolean).join(' · ') : '',
    texto: quitar ? '' : t('Tus amigos verán que vas y se guardará en tus planes.'),
    boton: t(quitar ? 'Quitar' : 'Voy'), volver: `${pre}/o/${encodeURIComponent(id)}`,
  }))) return;
  const [r, cons] = await Promise.all([
    llamar('set_going', { p_offer: id, p_going: !quitar }),
    quitar ? null : llamar('my_consents', {}).catch(() => null),
  ]);
  const ficha = `${pre}/o/${encodeURIComponent(id)}`;
  if (!quitar) {
    hecho({
      titulo: t(cons?.share_plans === false ? 'Hecho. Está en tus planes.' : '¡Hecho! Tus amigos verán que vas. También está en tus planes.'),
      texto: r.auto === 'reservation' ? t('Vas: tienes plaza reservada') : r.auto === 'code' ? t('Vas: tienes el código') : '',
      volver: ficha, volverTxt: t('Volver a la publicación'),
      lista: '#/planes', listaTxt: t('Ver tus planes'),
      deshacer: r.auto ? '' : `voy/${id}?quitar=1`,
    });
    return;
  }
  if (r.auto) {
    // Sigue yendo: tiene plaza o código. Se deja anular en Tus códigos.
    hecho({
      titulo: t(r.auto === 'reservation' ? 'Vas: tienes plaza reservada' : 'Vas: tienes el código'),
      texto: t('Tienes plaza o código: para dejar de ir, anúlalo en Tus códigos.'),
      volver: ficha, volverTxt: t('Volver a la publicación'),
      lista: '#/codigos', listaTxt: t('Tus códigos'),
    });
    return;
  }
  hecho({
    titulo: t('Ya no marcas «Voy»'),
    volver: ficha, volverTxt: t('Volver a la publicación'),
    lista: '#/planes', listaTxt: t('Ver tus planes'),
    deshacer: `voy/${id}`,
  });
};

// ── Invitar a un amigo ────────────────────────────────────────────────────
RUTAS.invitar = async ([id]) => {
  if (!UUID_AMIGOS.test(id || '')) { pinta(pantallaVacia({ icono: 'link', titulo: t('Ese enlace no está completo.'), h: 'h1', botones: botonTuCuenta() })); return; }
  if (!exigeSesion(`invitar/${id}`)) return;
  const [fila, social, lista] = await Promise.all([
    llamar('offer_detail', { p_id: id }).catch(() => null),
    llamar('offer_friends', { p_offer: id }),
    llamar('my_friends', {}),
  ]);
  const o = Array.isArray(fila) ? fila[0] : fila;
  const ficha = `${pre}/o/${encodeURIComponent(id)}`;
  const migas = `<p class="crumbs"><a href="${esc(ficha)}">${esc(o?.title || t('Volver a la publicación'))}</a></p>`;
  if (!social?.visible) {
    pinta(`${migas}
      <h1>${esc(t('Invitar a un amigo'))}</h1>
      ${pantallaVacia({ icono: 'explore', titulo: t('Esta publicación ya no está disponible.') })}`);
    return;
  }
  const amigos = lista?.friends || [];
  const compartirFicha = () => {
    const url = `${location.origin.replace('://www.', '://')}${ficha}`;
    return compartirOCopiar(o?.title ? `${o.title} · ${url}` : url, url);
  };
  if (!amigos.length) {
    pinta(`${migas}
      <h1>${esc(t('Invitar a un amigo'))}</h1>
      ${pantallaVacia({
        icono: 'group',
        titulo: t('Aún no tienes amigos en Klendar'),
        texto: t('Añádelos con tu enlace de amigo. Mientras, puedes mandar la publicación por cualquier app.'),
        botones: `<a class="pill accent" href="#/amigos">${ic('group_add')} ${esc(t('Añadir amigos'))}</a>
          <button type="button" class="pill" id="compartir-ficha">${ic('share')} ${esc(t('Compartir el enlace'))}</button>`,
      })}`);
    $('#compartir-ficha').onclick = compartirFicha;
    return;
  }
  pintaInvitar({ id, o, migas, social, amigos, compartirFicha });
};

/** La lista para elegir a quién invitar, con cómo está cada uno. `aviso`:
 * lo que ha pasado al mandar (enviadas, saltadas, límite del día). */
function pintaInvitar({ id, o, migas, social, amigos, compartirFicha, aviso = '' }) {
  const van = new Set((social.friends || []).map((f) => f.id));
  const mandadas = new Map((social.sent || []).map((s) => [s.to, s.response]));
  const estadoDe = (a) => {
    if (van.has(a.id) || mandadas.get(a.id) === 'going') return t('Va');
    if (mandadas.get(a.id) === 'declined') return t('No puede');
    if (mandadas.has(a.id)) return t('Invitado');
    return '';
  };
  const quedan = Math.max(0, social.invites_left ?? 0);
  const tope = Math.min(20, quedan);
  const hayQuienVa = (social.friends || []).length > 0;
  pinta(`${migas}
    <h1>${esc(t('Invitar a un amigo'))}</h1>
    ${hayQuienVa ? `<p class="quien-va">${pilaDeAmigos(social.friends)}<span>${esc(fraseQuienVa(social.friends, social.total))}</span></p>` : ''}
    <p class="muted" id="quedan-inv">${esc(EN
      ? `They'll get a notification and can tell you if they're going. You have ${quedan} invitations left today.`
      : `Le llegará una notificación y podrá decirte si va. Te quedan ${quedan} invitaciones hoy.`)}</p>
    ${aviso ? `<p class="aviso-inv" role="status">${esc(aviso)}</p>` : ''}
    ${quedan ? '' : `<p class="aviso-inv">${esc(t('Ya has mandado 20 invitaciones hoy. Mañana podrás mandar más.'))}</p>`}
    <form id="f-invitar" class="formu" novalidate>
      <div class="lista inv-lista">${amigos.map((a) => {
        const estado = estadoDe(a);
        return `<label class="fila inv-fila${estado ? ' hecha' : ''}">
          <input type="checkbox" name="amigo" value="${esc(a.id)}"${estado || !quedan ? ' disabled' : ''}>
          ${avatarDeAmigo(a, 'av-lista')}
          <span class="fila-t"><b>${esc(nombreDeAmigo(a))}</b></span>
          ${estado ? `<span class="estado-inv">${esc(estado)}</span>` : ''}
        </label>`;
      }).join('')}</div>
      <button class="pill accent" type="submit" id="mandar-inv" disabled>${esc(t('Invitar a un amigo'))}</button>
    </form>
    <p class="acciones">
      <a class="pill" href="#/amigos">${ic('group_add')} ${esc(t('Añadir amigos'))}</a>
      <button type="button" class="pill" id="compartir-ficha">${ic('share')} ${esc(t('Compartir el enlace'))}</button>
    </p>`);
  $('#compartir-ficha').onclick = compartirFicha;
  const f = $('#f-invitar');
  const cajas = $$('input[name=amigo]', f);
  const boton = $('#mandar-inv');
  const textoBoton = (n) => (n === 0 ? t('Invitar a un amigo') : n === 1 ? t('Invitar a 1 amigo')
    : (EN ? `Invite ${n} friends` : `Invitar a ${n} amigos`));
  const repasa = () => {
    const elegidas = cajas.filter((c) => c.checked).length;
    // Hasta 20 de una vez y las que queden hoy.
    for (const c of cajas) {
      if (c.closest('.hecha') || !quedan) continue;
      c.disabled = !c.checked && elegidas >= tope;
    }
    boton.disabled = elegidas === 0;
    boton.textContent = textoBoton(elegidas);
  };
  cajas.forEach((c) => c.addEventListener('change', repasa));
  repasa();
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const elegidos = cajas.filter((c) => c.checked).map((c) => c.value);
    if (!elegidos.length) return;
    ocupado(boton, async () => {
      let r;
      try { r = await llamar('invite_friends', { p_offer: id, p_friends: elegidos }); } catch (e) {
        if (e.clave === 'daily_limit') {
          const social2 = await llamar('offer_friends', { p_offer: id });
          pintaInvitar({ id, o, migas, social: social2, amigos, compartirFicha });
          return;
        }
        throw e;
      }
      const partes = [];
      if (r.sent === 1) partes.push(t('Invitación enviada'));
      else if (r.sent > 1) partes.push(EN ? `${r.sent} invitations sent` : `${r.sent} invitaciones enviadas`);
      const saltadas = (r.skipped || []).filter((s) => s.reason !== 'daily_limit').length;
      if (saltadas === 1) partes.push(t('No se ha podido invitar a 1 amigo: no puede verla o tiene las invitaciones apagadas.'));
      else if (saltadas > 1) {
        partes.push(EN ? `${saltadas} friends couldn't be invited: they can't see it or have invitations turned off.`
          : `No se ha podido invitar a ${saltadas} amigos: no pueden verla o tienen las invitaciones apagadas.`);
      }
      if ((r.skipped || []).some((s) => s.reason === 'daily_limit')) partes.push(t('Ya has mandado 20 invitaciones hoy. Mañana podrás mandar más.'));
      if (r.sent) toast(partes[0]);
      const social2 = await llamar('offer_friends', { p_offer: id }).catch(() => ({ ...social, invites_left: r.invites_left }));
      // El aviso de «no hay más hoy» ya sale solo cuando no queda ninguna.
      const aviso = partes.filter((p) => !(social2.invites_left === 0 && p === t('Ya has mandado 20 invitaciones hoy. Mañana podrás mandar más.'))).join(' ');
      pintaInvitar({ id, o, migas, social: social2, amigos, compartirFicha, aviso });
      I18N.translate(view);
    });
  });
}
