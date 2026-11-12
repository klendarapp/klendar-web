/* «Rellenar desde…» un enlace o un texto en el panel, igual que en la app (GLOSARIO; RUNBOOK §4zl de la app).
 *
 * Al crear una oferta o un evento: «Rellenar desde…» abre tres opciones (una foto, un enlace, un texto). La foto es la
 * de siempre (panel/foto.js). El enlace lo lee el servidor (Edge Function `link-fill`, con sus frenos: solo https, nada
 * interno, robots.txt…) y el texto se manda tal cual; lo lee la IA y vuelve para llenar el formulario. Con varios
 * eventos sale una lista con casillas y se revisan uno a uno en el formulario. Nunca publica ni guarda sola: lo hace la
 * persona con el botón de siempre. Si el enlace no se lee, se propone una captura (la foto).
 *
 * Apagado (`app_config.ai.uses.link_fill.enabled`), o sin poder: solo la foto, como siempre.
 * Va después de foto.js y usa lo del panel (`rpc`, `sb`, `BIZ`, `modal`, `esc`, `toast`, `I18N`, `KFotos`, `GUARDA`…).
 */
'use strict';

window.KEnlaceRellena = (() => {
  const t = (s) => I18N.t(s);
  const MAX_TEXTO = 20000;

  class ErrorEnlace extends Error {
    constructor(code, detail) { super(code); this.code = code; this.detail = detail; }
  }

  const MENSAJES = {
    nothing: 'No hemos encontrado ningún evento ni oferta. Prueba con otro enlace o con una foto, o escríbelo a mano.',
    offline: 'Sin conexión no se puede leer. Escríbelo a mano: lo que tenías sigue aquí.',
    cap: 'Este mes no se puede leer más. Escríbelo a mano: lo que tenías sigue aquí.',
    daily: 'Hoy ya se ha leído todo lo que se puede. Mañana, más. Mientras, a mano: lo que tenías sigue aquí.',
    off: 'Ahora no se puede leer. Escríbelo a mano: lo que tenías sigue aquí.',
    bad_link: 'Ese enlace no vale: tiene que empezar por https:// y ser una página pública.',
    bad_text: 'Pega un texto un poco más largo (y de menos de 20.000 letras).',
    bad_image: 'No hemos podido traer la imagen. Súbela tú desde «Fotos».',
    failed: 'No hemos podido leerlo. Prueba otra vez o escríbelo a mano: lo que tenías sigue aquí.',
  };
  MENSAJES.person = MENSAJES.daily;
  MENSAJES.forbidden = MENSAJES.off;
  MENSAJES.no_consent = MENSAJES.off;
  const mensaje = (code) => t(MENSAJES[code] || MENSAJES.failed);

  const estado = async () => {
    try { return await rpc('link_fill_status', { p_business: BIZ.id }); } catch { return null; }
  };

  // El permiso, antes de mandar nada: una casilla clara, sin marcar, distinta de la de la foto.
  const permiso = async (st) => {
    if (st.consent) return true;
    const r = await modal({
      title: t('¿Lo leemos con IA?'),
      intro: `${esc(t('Para rellenarlo, el texto que pegues, o el de la página que enlaces (la leemos nosotros), se envía a Claude, la IA de Anthropic, una empresa de Estados Unidos, que lo lee y nos lo devuelve. Antes quitamos correos y teléfonos. Klendar no guarda el enlace, el texto ni lo leído. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Sin esto, escribes a mano como siempre, y puedes cambiarlo en Ajustes.'))}
        <a class="link" href="/privacidad" target="_blank" rel="noopener">${esc(t('Más información'))}</a>`,
      html: `<label class="f foto-permiso"><input type="checkbox" name="enlace_permiso" required><span>${esc(t('Acepto que lo que pegue o enlace se envíe a Claude (Anthropic, Estados Unidos) para leerlo'))}</span></label>`,
      submit: t('Continuar'),
      cancel: t('Ahora no, lo escribo a mano'),
    });
    if (!r) return false;
    try {
      await rpc('set_ai_consent', { p_granted: true, p_use: 'link_fill' });
      st.consent = true;
      return true;
    } catch (e) {
      toast(friendly(e.message), true);
      return false;
    }
  };

  const llama = async (body) => {
    if (navigator.onLine === false) throw new ErrorEnlace('offline');
    let res;
    try {
      res = await sb.functions.invoke('link-fill', { body: { business_id: BIZ.id, ...body } });
    } catch { throw new ErrorEnlace('offline'); }
    if (res.error) throw new ErrorEnlace(res.error.name === 'FunctionsFetchError' ? 'offline' : 'failed');
    return res.data || {};
  };
  const leer = async (body) => {
    const d = await llama(body);
    if (!d.ok || !d.read) throw new ErrorEnlace(d.why || 'failed', d.detail);
    if (!d.read.events?.length) throw new ErrorEnlace('nothing');
    return { ...d.read, truncated: d.truncated === true };
  };

  /** «Usar la imagen de la página»: la trae la función (solo una firmada en la lectura) y se reduce como una foto. */
  const traeImagen = async (r) => {
    const d = await llama({ image_url: r.image_url, image_token: r.image_token });
    if (!d.ok || !d.image) throw Object.assign(new Error('bad_image'), { mensaje: MENSAJES.bad_image });
    const bytes = Uint8Array.from(atob(d.image), (c) => c.charCodeAt(0));
    const original = new File([bytes], 'pagina', { type: d.mime });
    return KFotoRellena.reducir(original, { lado: 1600, calidad: 0.8 });
  };

  // ── Varios eventos: la lista y la cola ──────────────────────────────────
  // Solo en memoria: lo elegido se abre uno a uno en el formulario. Nada se guarda ni se publica sin pulsar en cada uno.
  let cola = null; // { origen, items, total }

  const fecha = (r) => {
    if (!r.start) return t('Sin fecha: la pones tú');
    const loc = I18N.lang === 'es' ? 'es-ES' : I18N.lang;
    const d = new Date(`${r.start}:00`);
    return new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
  };
  const linea = (r) => [fecha(r), r.price_cents != null ? `${(r.price_cents / 100).toFixed(2).replace('.', ',')} €` : '', r.venue_name || '']
    .filter(Boolean).join(' · ') + (r.doubts?.length ? ` · ${t('Hay cosas que mirar')}` : '');

  /** «N eventos encontrados»: casillas marcadas; devuelve los elegidos (o null). */
  const lista = async (leido) => {
    const n = leido.events.length;
    const avisos = [
      leido.injection ? t('Lo leído llevaba instrucciones para una IA. No les hemos hecho caso: míralo todo bien.') : '',
      leido.more ? I18N.t(`Había más: hemos leído los ${n} primeros. Para el resto, pega otro enlace o el texto que falte.`) : '',
      leido.truncated ? t('La página era muy larga y solo hemos leído el principio.') : '',
    ].filter(Boolean);
    const r = await modal({
      title: I18N.t(`${n} eventos encontrados`),
      intro: esc(t('Quita los que no quieras. Se abren uno a uno en el formulario: no se publica nada hasta que lo revises y pulses Publicar en cada uno.'))
        + avisos.map((a) => `<br><span class="hint">${esc(a)}</span>`).join(''),
      fields: leido.events.map((e, i) => ({ name: `e${i}`, type: 'checkbox', value: true, label: `${e.title} — ${linea(e)}` })),
      submit: t('Revisar uno a uno'),
      cancel: t('Cancelar'),
    });
    if (!r) return null;
    return leido.events.filter((_, i) => r[`e${i}`]);
  };

  const rutaDe = (r, pos) => `#/publicaciones/${r.kind === 'future_event' ? 'nuevo-evento' : 'nueva-flash'}?cola=${pos}`;

  /** Después de publicar o guardar: la dirección del siguiente de la cola, o null si no queda ninguno. */
  const siguiente = () => {
    if (!cola) return null;
    cola.items.shift();
    if (!cola.items.length) { cola = null; return null; }
    return rutaDe(cola.items[0], cola.total - cola.items.length + 1);
  };
  const salta = () => {
    GUARDA = null;
    location.hash = siguiente() || '#/publicaciones';
  };

  // ── La tarjeta del formulario ───────────────────────────────────────────
  const oferta = async (caja, api) => {
    if (!caja) return;
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    // El siguiente de una agenda: ya relleno, con su paso. Si se llega aquí de otra manera, la cola se olvida.
    if (cola && q.get('cola') && cola.items.length) {
      const r = cola.items[0];
      const pos = cola.total - cola.items.length + 1;
      KFotoRellena.rellena(caja, api, r, {
        origen: cola.origen, traeImagen: cola.origen === 'enlace' ? traeImagen : null,
        paso: I18N.t(`Evento ${pos} de ${cola.total}`), alSaltar: cola.items.length > 1 ? salta : null,
        alDeshacer: () => { caja.innerHTML = ''; },
      });
      return;
    }
    cola = null;
    const st = await estado();
    if (!caja.isConnected) return;
    // Apagado: la foto de siempre.
    if (!st?.available) { KFotoRellena?.oferta(caja, api); return; }
    const foto = await KFotoRellena?.estado();
    if (!caja.isConnected) return;

    const pinta = (leyendo = '') => {
      caja.innerHTML = `<div class="foto-caja">
        <button type="button" class="foto-cta${leyendo ? ' mov-ocupado' : ''}" id="enlaceCta" ${leyendo ? 'disabled aria-busy="true"' : ''}><span class="ms" aria-hidden="true">edit</span>
          <span><b>${esc(leyendo || t('Rellenar desde…'))}</b><small>${esc(t('Una foto de tu cartel, el enlace de tu web o un texto. Lo escribimos por ti; tú lo revisas y publicas.'))}</small></span></button></div>`;
      const b = $('#enlaceCta', caja);
      if (!leyendo) b.onclick = elige;
    };

    const elige = async () => {
      const opciones = [
        ...(foto?.available ? [['foto', t('Una foto') + ' — ' + t('El cartel o el flyer')]] : []),
        ['enlace', t('Un enlace') + ' — ' + t('La página del evento en tu web, o una publicación pública')],
        ['texto', t('Un texto') + ' — ' + t('Pega el mensaje de WhatsApp o cualquier texto')],
      ];
      const r = await modal({
        title: t('Rellenar desde…'),
        fields: [{ name: 'de', label: t('¿Desde dónde?'), type: 'select', value: opciones[0][0], options: opciones }],
        submit: t('Continuar'),
      });
      if (!r) return;
      if (r.de === 'foto') return usaFoto();
      if (!await permiso(st)) return;
      if (r.de === 'enlace') {
        const e = await modal({
          title: t('Pega el enlace'),
          intro: esc(t('La página de tu evento o de tu agenda. Si es de Instagram o Facebook y no se puede leer, te proponemos una captura.')),
          fields: [{ name: 'url', label: t('Enlace (https://…)'), type: 'url', required: true, maxlength: 2000, placeholder: 'https://' }],
          submit: t('Leer'),
        });
        if (!e?.url) return;
        await ejecuta('enlace', { source: 'link', url: e.url }, t('Leyendo el enlace…'));
      } else {
        const e = await modal({
          title: t('Pega el texto'),
          intro: esc(t('Puede llevar varios eventos: los verás en una lista. Quitamos teléfonos y correos antes de leerlo.')),
          fields: [{ name: 'text', label: t('El mensaje o el texto con tus planes'), type: 'textarea', rows: 8, required: true, maxlength: MAX_TEXTO }],
          submit: t('Leer'),
        });
        if (!e?.text) return;
        await ejecuta('texto', { source: 'text', text: e.text }, t('Leyendo el texto…'));
      }
    };

    const usaFoto = () => KFotoRellena.oferta(caja, api, { abrir: true, alDeshacer: () => pinta() });

    const ejecuta = async (origen, body, leyendo) => {
      pinta(leyendo);
      let leido;
      try {
        leido = await leer(body);
      } catch (e) {
        if (!caja.isConnected) return;
        pinta();
        if (e.code === 'unreadable_link') return noSeLee();
        toast(mensaje(e.code), true);
        return;
      }
      if (!caja.isConnected) return;
      pinta();
      const opciones = { origen, traeImagen: origen === 'enlace' ? traeImagen : null, alDeshacer: () => pinta() };
      if (leido.events.length === 1) {
        KFotoRellena.rellena(caja, api, { ...leido.events[0], injection: leido.injection }, opciones);
        return;
      }
      const elegidos = await lista(leido);
      if (!elegidos?.length || !caja.isConnected) return;
      cola = { origen, items: elegidos.map((x) => ({ ...x, injection: leido.injection })), total: elegidos.length };
      const pos = 1;
      KFotoRellena.rellena(caja, api, cola.items[0], {
        ...opciones,
        paso: cola.total > 1 ? I18N.t(`Evento ${pos} de ${cola.total}`) : null,
        alSaltar: cola.total > 1 ? salta : null,
      });
    };

    // «No hemos podido leer este enlace; prueba con una captura».
    const noSeLee = async () => {
      if (!foto?.available) {
        toast(`${t('No hemos podido leer este enlace')}. ${mensaje('off')}`, true);
        return;
      }
      const si = await modal({
        title: t('No hemos podido leer este enlace'),
        intro: esc(t('Prueba con una captura de la página o del cartel: la leemos igual. Lo que tenías sigue aquí.')),
        submit: t('Usar una captura'),
        cancel: t('Lo escribo a mano'),
      });
      if (si) usaFoto();
    };

    pinta();
  };

  /** Lo que queda de una agenda (para no salir sin avisar). */
  const pendientes = () => (cola ? cola.items.length - 1 : 0);

  return { estado, oferta, siguiente, pendientes };
})();
