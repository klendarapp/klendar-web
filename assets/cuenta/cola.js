/* «Tu cuenta»: la cola virtual (tanda C, migración 20261207100000).
 *
 * - `/cuenta/cola/<código>`: el turno en vivo, lo mismo que `/cola/<código>` en la
 *   app. Sin número: cuánta gente espera, la espera aproximada, «¿Cuántos
 *   sois?» y «Coger número» (sin sesión, «Entrar para coger número»). Con
 *   número: «Tu número», cuántos tienes delante, la espera y «Salir de la
 *   cola». Al avisarte, «¡Te toca!» con la hora límite y la cuenta atrás, y
 *   si la página está abierta suena, vibra y, si lo has permitido, sale un
 *   aviso del navegador. Se vuelve a pedir cada 10 s.
 * - En «Tus códigos» y en Planes, arriba: la tarjeta «Tu turno en {negocio}»
 *   (`colaTarjetasHtml`), que abre la pantalla de la cola.
 *
 * La página pública del cartel (`/cola/<código>`, assets/cola.js) trae aquí
 * a quien ya tiene sesión. Va después de app.js y usa lo suyo (`RUTAS`,
 * `llamar`, `pinta`, `t`, `esc`, `ic`, `fecha`, `zonasDe`, `confirma`,
 * `ocupado`, `alSalir`, `pantallaVacia`…). Comparten ámbito: los nombres de
 * aquí empiezan por `cola`.
 */
'use strict';

/** Los errores de la cola, en palabras (los mismos que la app). */
const COLA_ERR = {
  rate_limited: 'Demasiados intentos. Espera un minuto.',
  queue_full: 'La cola está llena. Prueba dentro de un rato.',
  queue_closed: 'La cola está cerrada.',
  queue_not_open: 'Hoy no hay cola virtual.',
  already_used: 'Hoy ya cogiste número en esta cola.',
  team: 'Eres del equipo de este local.',
  adults_only: 'Solo para mayores de 18 años.',
  bad_code: 'Este cartel ya no funciona.',
  unavailable: 'La cola no está disponible',
};
const colaError = (e) => (COLA_ERR[e?.clave] ? t(COLA_ERR[e.clave]) : (e?.message || amable('')));

/** El icono de la cola (format_list_numbered), en SVG: no está en la
 * fuente recortada de «Tu cuenta». */
const COLA_SVG = '<svg class="ms-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>';

/** La campana de «¡Te toca!» (notifications_active), como la app. */
const COLA_CAMPANA = '<svg class="ms-svg" viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path fill="currentColor" d="M7.58 4.08 6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2a8.445 8.445 0 0 1 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43a8.495 8.495 0 0 1 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z"/></svg>';

const colaNumero = (n) => (EN ? `No. ${n}` : t(`Nº ${n}`));
/** «1 persona» / «3 personas» (lo de «¿Cuántos sois?»). */
const colaGente = (n) => (EN ? (n === 1 ? '1 person' : `${n} people`) : (n === 1 ? '1 persona' : `${n} personas`));
const colaEsperando = (n) => (EN
  ? (n === 0 ? 'Nobody is waiting' : n === 1 ? '1 person waiting' : `${n} people waiting`)
  : (n === 0 ? 'No hay nadie esperando' : n === 1 ? '1 persona esperando' : `${n} personas esperando`));
const colaDelante = (n) => (EN
  ? (n === 0 ? "You're next" : n === 1 ? 'There is 1 person ahead of you' : `There are ${n} people ahead of you`)
  : (n === 0 ? 'Eres el siguiente' : n === 1 ? 'Tienes 1 persona delante' : `Tienes ${n} personas delante`));
/** Los minutos de espera redondeados como la app (`roundWait`): tal cual por
 * debajo de 15 y, desde ahí, de 5 en 5. */
const colaRedondea = (m) => (m < 15 ? m : Math.floor((m + 2) / 5) * 5);
// «1 min», nunca «unos 1 min» (como la app).
const colaEspera = (m) => (m == null ? t('La espera aproximada sale cuando avancen los primeros')
  : colaRedondea(m) <= 1 ? (EN ? 'Approximate wait: 1 min' : t('Espera aproximada: 1 min'))
    : (EN ? `Approximate wait: about ${colaRedondea(m)} min` : `Espera aproximada: unos ${colaRedondea(m)} min`));
/** Personas, no grupos: lo que dice la base (`waiting_people`, `ahead_people`;
 * una base de antes, los turnos). «Eres el siguiente» va por turnos. */
const colaPersonasEsperando = (q) => Number(q?.waiting_people ?? q?.waiting) || 0;
const colaPersonasDelante = (me) => (Number(me?.ahead) ? Number(me.ahead_people ?? me.ahead) || 0 : 0);
/** Lo que va la hora del servidor por delante de la de este dispositivo (`now`
 * de cada respuesta): la cuenta atrás se cuenta con la del servidor. */
let COLA_DESFASE = 0;
const colaDesfase = (d) => {
  const s = Date.parse(d?.now || '');
  if (Number.isFinite(s)) COLA_DESFASE = s - Date.now();
};
const colaAyuda = (x) => (EN ? `We'll let you know on your phone when it's your turn. You'll have ${x} minutes to get there.`
  : `Te avisamos en el móvil cuando te toque. Tendrás ${x} minutos para presentarte.`);

/** «20:40» en la hora del local. */
const colaHora = (iso, tz) => fecha(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, tz);
/** «antes de las 20:40» («antes de la 01:10»). */
const colaAntesDe = (iso, tz) => {
  const h = colaHora(iso, tz);
  return EN ? `before ${h}` : `antes de ${h.startsWith('01:') ? 'la' : 'las'} ${h}`;
};
/** «3:12» que quedan hasta `iso` (0:00 si ya ha pasado). */
const colaQueda = (iso) => {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - (Date.now() + COLA_DESFASE)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const colaFicha = (b) => `${pre}/b/${encodeURIComponent(b?.slug || b?.id || '')}`;

// ── Sonido, vibración y aviso del navegador ───────────────────────────────
// El navegador solo deja sonar y vibrar a una página que ya se ha tocado: el
// sonido se prepara en el primer toque (`colaPreparaSonido`).
let COLA_AUDIO = null;
function colaPreparaSonido() {
  try {
    if (!COLA_AUDIO) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      COLA_AUDIO = new C();
    }
    if (COLA_AUDIO.state === 'suspended') COLA_AUDIO.resume().catch(() => {});
  } catch { COLA_AUDIO = null; }
  return COLA_AUDIO;
}
/** Tres pitidos cortos, subiendo. */
function colaSuena() {
  const ac = colaPreparaSonido();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + 0.05;
    [[0, 880], [0.32, 880], [0.64, 1175]].forEach(([d, f]) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.45, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.3);
    });
  } catch { /* sin sonido */ }
}
/** «¡Te toca!»: suena, vibra y, si se ha permitido, aviso del navegador. */
function colaAvisa(negocio, numero, limite) {
  try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]); } catch { /* sin vibración */ }
  colaSuena();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(t('¡Te toca!'), {
        body: `${negocio} · ${colaNumero(numero)} · ${limite}`,
        tag: 'klendar-cola', icon: '/assets/icon-192.png',
      });
    }
  } catch { /* Android Chrome no deja crear avisos sin service worker: suena y vibra */ }
}

// ── La pantalla ──────────────────────────────────────────────────────────
/** El código del cartel ya no vale. */
const colaCartelMalo = () => pinta(pantallaVacia({
  icono: 'qr_code_2', h: 'h1',
  titulo: t('Este cartel ya no funciona'),
  texto: t('Puede que el local lo haya cambiado. Pide el nuevo en la puerta.'),
  // Como la página pública y la app: a ver qué hay cerca.
  botones: `<a class="pill accent" href="${PUB_EN ? '/en/discover' : '/descubre'}">${esc(t('Ver qué hay cerca'))}</a>`,
}));

RUTAS.cola = async ([code]) => {
  const codigo = /^[A-Za-z0-9_-]{16}$/.test(code || '') ? code : '';
  if (!codigo) { colaCartelMalo(); return; }
  let info;
  try {
    info = await llamar('queue_info', { p_code: codigo });
  } catch (e) {
    if (e.clave === 'bad_code') { colaCartelMalo(); return; }
    throw e;
  }
  const zona = await zonasDe([{ business_id: info.business?.id }]);
  const tz = zona({ business_id: info.business?.id });
  let party = 1;
  let firma = '';
  let mirando = false;

  // Lo que se ve de cada estado. `firma`: si no cambia, no se repinta (no
  // se pierde el foco ni lo elegido en «¿Cuántos sois?»).
  const firmaDe = (d) => JSON.stringify([d.team, d.unavailable, d.ended_today,
    d.queue && [d.queue.status, d.queue.waiting, d.queue.waiting_people, d.queue.full, d.queue.wait_minutes, d.queue.call_minutes],
    d.me && [d.me.id, d.me.status, d.me.ahead, d.me.ahead_people, d.me.wait_minutes, d.me.call_deadline]]);

  // Como la app: el logo, el nombre y la dirección corta del local (se llega
  // por el cartel, no desde «Tus códigos»).
  const cabecera = (b) => {
    const dir = [String(b.address || '').split(',')[0].trim(), String(b.city || '').trim()].filter(Boolean).join(', ');
    return `<header class="cola-cab">
      ${b.logo_url && /^https:\/\//.test(b.logo_url) ? `<img class="cola-logo" src="${esc(b.logo_url)}" alt="" width="56" height="56">` : ''}
      <div><p class="cola-kicker">${esc(t('Cola virtual'))}</p>
        <h1 class="cola-h1">${esc(b.name || '')}</h1>
        ${dir ? `<p class="muted">${esc(dir)}</p>` : ''}</div>
    </header>`;
  };

  const pintaCola = (d) => {
    firma = firmaDe(d);
    colaDesfase(d);
    const b = d.business || {};
    const q = d.queue;
    const me = d.me;
    document.title = `${me?.status === 'called' ? `${t('¡Te toca!')} · ` : ''}${t('Cola virtual')} · Klendar`;
    // El cartel es bueno, pero el local ahora no sale (bloqueado por el pago,
    // sin verificar o cerrado): no es que el cartel no funcione.
    if (d.unavailable) {
      pinta(pantallaVacia({
        icono: 'block', h: 'h1',
        titulo: t('La cola no está disponible'),
        texto: EN ? `${b.name} doesn't have the virtual queue right now. Ask at the door.`
          : `Ahora mismo ${b.name} no tiene la cola virtual. Pregunta en la puerta.`,
        botones: `<a class="pill accent" href="${PUB_EN ? '/en/discover' : '/descubre'}">${esc(t('Ver qué hay cerca'))}</a>`,
      }));
      return;
    }
    // Del equipo: la cola se lleva desde el panel.
    if (d.team && !me) {
      pinta(pantallaVacia({
        icono: 'storefront', h: 'h1',
        titulo: EN ? `You're on the ${b.name} team` : `Eres del equipo de ${b.name}`,
        texto: t('La cola se lleva desde Mi negocio.'),
        botones: `<a class="pill accent" href="/panel#/cola?biz=${esc(b.id)}">${esc(t('Ir a la cola'))}</a>`,
      }));
      return;
    }
    if (me && (me.status === 'waiting' || me.status === 'called')) {
      const llamado = me.status === 'called';
      const avisos = !llamado && typeof Notification !== 'undefined' && Notification.permission === 'default';
      pinta(`${cabecera(b)}
        <section class="cola-turno${llamado ? ' llamado' : ''}" aria-live="polite">
          ${llamado ? `
            <p class="cola-campana">${COLA_CAMPANA}</p>
            <p class="cola-toca">${esc(t('¡Te toca!'))}</p>
            <p class="cola-linea"><b>${esc(EN ? `Get to the door ${colaAntesDe(me.call_deadline, tz)}` : `Preséntate en la puerta ${colaAntesDe(me.call_deadline, tz)}`)}</b></p>
            <p class="cola-cuenta" id="cola-cuenta" aria-live="off">${esc(EN ? `You have ${colaQueda(me.call_deadline)} left` : `Te quedan ${colaQueda(me.call_deadline)}`)}</p>` : ''}
          <p class="cola-tu">${esc(t('Tu número'))}</p>
          <p class="cola-numero">${esc(colaNumero(me.number))}</p>
          ${me.party_size ? `<p class="muted">${esc(EN ? (me.party_size === 1 ? '1 person' : `${me.party_size} people`) : (me.party_size === 1 ? '1 persona' : `${me.party_size} personas`))}</p>` : ''}
          ${llamado ? '' : `
            <p class="cola-linea"><b>${esc(colaDelante(colaPersonasDelante(me)))}</b></p>
            <p class="muted">${esc(colaEspera(me.wait_minutes))}</p>`}
        </section>
        ${llamado ? '' : `<p class="muted cola-nota">${esc(t('Deja esta página abierta: sonará y vibrará cuando te toque.'))}</p>`}
        <div class="cola-botones">
          ${avisos ? `<button type="button" class="pill" id="cola-avisos">${esc(t('Activar avisos'))}</button>` : ''}
          <button type="button" class="pill" id="cola-salir">${esc(t('Salir de la cola'))}</button>
        </div>`);
      $('#cola-avisos')?.addEventListener('click', async (ev) => {
        colaPreparaSonido();
        try { await Notification.requestPermission(); } catch { /* navegador viejo */ }
        ev.currentTarget.remove();
      });
      $('#cola-salir').onclick = async (ev) => {
        const boton = ev.currentTarget;
        const ok = await confirma({
          titulo: t('¿Salir de la cola?'),
          texto: t('Perderás tu número y hoy no podrás volver a cogerlo.'),
          aceptar: t('Salir'), cancelar: t('Seguir en la cola'), peligro: true,
        });
        if (!ok) return;
        await ocupado(boton, async () => {
          await llamar('leave_queue', { p_entry: me.id });
          await mira(true);
        });
      };
      return;
    }
    if (me) {
      // Ya ha pasado: atendido, no vino, se salió o se le quitó.
      const fin = {
        served: ['', 'Ya te han atendido', '¡Que lo disfrutes!'],
        no_show: ['', 'Se ha pasado tu turno', 'No llegaste a tiempo. Si estás en la puerta, pregunta.'],
        left: ['logout', 'Saliste de la cola', 'Si ha sido sin querer, pregunta en la puerta: pueden apuntarte.'],
        removed: ['block', 'Ya no estás en la cola', 'El local te ha quitado de la cola. Si es un error, pregunta en la puerta.'],
      }[me.status] || ['block', 'Ya no estás en la cola', 'El local te ha quitado de la cola. Si es un error, pregunta en la puerta.'];
      pinta(pantallaVacia({
        icono: fin[0], h: 'h1', titulo: t(fin[1]), texto: t(fin[2]),
        botones: `<a class="pill accent" href="${esc(colaFicha(b))}">${esc(t('Ver el local'))}</a>`,
      }).replace('<section class="vacio">', `<section class="vacio"><p class="cola-kicker">${esc(b.name || '')} · ${esc(colaNumero(me.number))}</p>`));
      return;
    }
    if (!q && d.ended_today) {
      // Terminada hoy («Terminar por hoy»): no es que no la haya abierto.
      pinta(pantallaVacia({
        icono: 'storefront', h: 'h1',
        titulo: t('La cola de hoy ha terminado'),
        texto: EN ? `${b.name} isn't calling anyone else from the queue today. Ask at the door.`
          : `${b.name} ya no atiende a nadie más de la cola hoy. Pregunta en la puerta.`,
        botones: `<a class="pill accent" href="${esc(colaFicha(b))}">${esc(t('Ver el local'))}</a>`,
      }));
      return;
    }
    if (!q) {
      pinta(pantallaVacia({
        icono: 'storefront', h: 'h1',
        titulo: t('Hoy no hay cola virtual'),
        texto: EN ? `${b.name} hasn't opened the queue. Ask at the door.` : `${b.name} no ha abierto la cola. Pregunta en la puerta.`,
        botones: `<a class="pill accent" href="${esc(colaFicha(b))}">${esc(t('Ver el local'))}</a>`,
      }));
      return;
    }
    const n = colaPersonasEsperando(q);
    if (q.status !== 'open' || q.full) {
      const cerrada = q.status !== 'open';
      pinta(`${cabecera(b)}
        <section class="cola-turno">
          <h2>${esc(t(cerrada ? 'La cola está cerrada' : 'La cola está llena'))}</h2>
          <p>${esc(t(cerrada ? 'Ahora no se apunta nadie más.' : 'Prueba dentro de un rato.'))}</p>
          <p class="muted">${esc(colaEsperando(n))}</p>
        </section>
        <div class="cola-botones"><a class="pill" href="${esc(colaFicha(b))}">${esc(t('Ver el local'))}</a></div>`);
      return;
    }
    pinta(`${cabecera(b)}
      <section class="cola-turno">
        <p class="cola-cuantos">${esc(colaEsperando(n))}</p>
        <p class="muted">${esc(colaEspera(q.wait_minutes))}</p>
        ${b.adults_only ? `<p class="cola-mayores">${esc(t('Solo para mayores de 18 años.'))}</p>` : ''}
        ${YO ? `<form class="formu cola-form" id="f-cola" novalidate>
          <p class="cola-paso-t" id="cola-paso-t">${esc(t('¿Cuántos sois?'))}</p>
          <div class="cola-paso" role="group" aria-labelledby="cola-paso-t">
            <button type="button" class="cola-paso-b" data-paso="-1" aria-label="${esc(t('Menos'))}"${party <= 1 ? ' disabled' : ''}>−</button>
            <output class="cola-paso-v" name="party_txt" aria-live="polite">${esc(colaGente(party))}</output>
            <button type="button" class="cola-paso-b" data-paso="1" aria-label="${esc(t('Más'))}"${party >= 20 ? ' disabled' : ''}>+</button>
          </div>
          <input type="hidden" name="party" value="${party}">
          <button class="pill accent" type="submit">${esc(t('Coger número'))}</button>
        </form>` : `<div class="cola-botones"><a class="pill accent" href="/cuenta/entrar?siguiente=${encodeURIComponent(`cola/${codigo}`)}">${esc(t('Entrar para coger número'))}</a></div>`}
        <p class="muted cola-ayuda">${esc(colaAyuda(q.call_minutes || 5))}</p>
      </section>`);
    const f = $('#f-cola');
    if (!f) return;
    // «¿Cuántos sois?» con − y +, como la app («1 persona»).
    f.querySelectorAll('[data-paso]').forEach((bt) => {
      bt.onclick = () => {
        party = Math.min(20, Math.max(1, party + Number(bt.dataset.paso)));
        f.party.value = String(party);
        f.party_txt.value = colaGente(party);
        f.querySelector('[data-paso="-1"]').disabled = party <= 1;
        f.querySelector('[data-paso="1"]').disabled = party >= 20;
        I18N.translate(f);
      };
    });
    f.onsubmit = (ev) => {
      ev.preventDefault();
      colaPreparaSonido();
      ocupado(f.querySelector('button[type=submit]'), async () => {
        try {
          await llamar('join_queue', { p_code: codigo, p_party: Number(f.party.value) || 1 });
        } catch (e) {
          toast(colaError(e), true);
        }
        await mira(true);
      });
    };
  };

  /** Vuelve a pedir la cola; si te acaban de avisar, suena y vibra. */
  const mira = async (forzar = false) => {
    if (mirando || (!forzar && document.visibilityState === 'hidden')) return;
    mirando = true;
    try {
      const d = await llamar('queue_info', { p_code: codigo });
      const antes = info.me;
      info = d;
      if (antes?.status === 'waiting' && d.me?.id === antes.id && d.me.status === 'called') {
        colaAvisa(d.business?.name || '', d.me.number, colaAntesDe(d.me.call_deadline, tz));
      }
      if (forzar || firmaDe(d) !== firma) { pintaCola(d); I18N.translate(view); }
    } catch (e) {
      if (e.clave === 'bad_code') { colaCartelMalo(); clearInterval(reloj); }
    } finally { mirando = false; }
  };

  pintaCola(info);
  // Cada 10 s, y al volver a la pestaña. La cuenta atrás, cada segundo.
  const reloj = setInterval(() => mira(), 10000);
  const segundos = setInterval(() => {
    const c = $('#cola-cuenta');
    if (!c || info.me?.status !== 'called') return;
    c.textContent = EN ? `You have ${colaQueda(info.me.call_deadline)} left` : `Te quedan ${colaQueda(info.me.call_deadline)}`;
    // Se acabó el tiempo: la base dirá «No vino» (o que ya te atendieron).
    if (new Date(info.me.call_deadline).getTime() <= Date.now() + COLA_DESFASE - 2000 && !mirando) mira(true);
  }, 1000);
  const alVolver = () => { if (document.visibilityState === 'visible') mira(); };
  document.addEventListener('visibilitychange', alVolver);
  document.addEventListener('pointerdown', colaPreparaSonido, { once: true, capture: true });
  alSalir(() => {
    clearInterval(reloj);
    clearInterval(segundos);
    document.removeEventListener('visibilitychange', alVolver);
    document.removeEventListener('pointerdown', colaPreparaSonido, { capture: true });
    document.title = `${t('Tu cuenta')} · Klendar`;
  });
};

// ── «Tu turno en {negocio}» en «Tus códigos» y en Planes ──────────────────
/** Las tarjetas de los turnos vivos (`my_queue_turns`), o ''. */
async function colaTarjetasHtml(turnos) {
  const lista = (Array.isArray(turnos) ? turnos : []).filter((x) => x && (x.status === 'waiting' || x.status === 'called'));
  if (!lista.length) return '';
  const zona = await zonasDe(lista.map((x) => ({ business_id: x.business?.id })));
  return `<div class="olist cola-tarjetas">${lista.map((x) => {
    const b = x.business || {};
    const tz = zona({ business_id: b.id });
    const linea = x.status === 'called'
      ? `${t('¡Te toca!')} ${EN ? `Before ${colaHora(x.call_deadline, tz)}` : t(`Antes de las ${colaHora(x.call_deadline, tz)}`)}`
      : [colaNumero(x.number),
        // Cada trozo por el diccionario: unidos con « · » ya no casan con él.
        // Personas, no grupos (como la app).
        x.ahead ? (EN ? `${colaPersonasDelante(x)} ahead` : t(`${colaPersonasDelante(x)} delante`)) : (EN ? "You're next" : t('Eres el siguiente')),
        x.wait_minutes != null ? (colaRedondea(x.wait_minutes) <= 1 ? '1 min'
          : (EN ? `about ${colaRedondea(x.wait_minutes)} min` : t(`unos ${colaRedondea(x.wait_minutes)} min`))) : ''].filter(Boolean).join(' · ');
    return `<a class="ocard cola-tarjeta${x.status === 'called' ? ' llamado' : ''}" href="/cuenta/cola/${esc(x.code)}">
        ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" loading="lazy">` : `<span class="ph">${COLA_SVG}</span>`}
        <span class="ocard-body"><b>${esc(EN ? `Your turn at ${b.name || ''}` : t(`Tu turno en ${b.name || ''}`))}</b>
          <span class="${x.status === 'called' ? 'cola-toca-linea' : 'muted'}">${esc(linea)}</span>
        </span>
        ${ic('chevron_right')}
      </a>`;
  }).join('')}</div>`;
}
