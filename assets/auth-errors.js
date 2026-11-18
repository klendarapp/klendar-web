/* Klendar — los errores de acceso (entrar, crear cuenta, códigos, contraseña)
 * dichos igual en toda la web: «Tu cuenta», el panel de negocios y el admin.
 *
 * Es la misma tabla que la app (AuthForm.message en
 * lib/features/auth/presentation/auth_form_utils.dart), con los mismos textos.
 * Se decide por el código de Supabase Auth (`error.code`) y, si no viene, por
 * el texto. Nunca se enseña el mensaje crudo del servidor.
 *
 * Uso: KL_AUTH_ERROR(error, 'es' | 'en') → frase lista para enseñar.
 */
(function () {
  // «Tu cuenta» y el panel, en un idioma sin tabla propia (catalán, francés…):
  // la española, pasada por el diccionario que ha cargado /assets/i18n.js.
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);
  const klLoc = (lang) => (globalThis.KL_LOCALE ? globalThis.KL_LOCALE(lang) : lang === 'en' ? 'en-GB' : 'es-ES');
  const TEXTOS = {
    es: {
      credenciales: 'Correo o contraseña incorrectos',
      sinConfirmar: 'Confirma tu correo antes de entrar (mira tu bandeja)',
      yaExiste: 'Ya existe una cuenta con ese correo',
      demasiados: 'Demasiados intentos. Espera un momento.',
      debil: 'Esa contraseña es muy fácil de adivinar. Usa al menos 8 caracteres.',
      filtrada: 'Esa contraseña ha salido en filtraciones de otras webs; elige otra',
      igual: 'La nueva contraseña tiene que ser distinta de la anterior.',
      codigo: 'Ese código no vale o ha caducado.',
      noDisponible: 'Este método de acceso no está disponible todavía',
      suspendida: 'Tu cuenta está suspendida. Si crees que es un error, escríbenos a info@klendar.app.',
      correoMal: 'Ese correo no parece válido',
      sms: 'No hemos podido mandar el SMS. Revisa el número y vuelve a probar.',
      telefono: 'Escribe un número válido',
      sesion: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
      dosPasos: 'Tu cuenta tiene verificación en dos pasos. Para cambiar el correo o la contraseña, entra en klendar.app/cuenta desde un navegador: te pedirá el código de 6 cifras de tu app de verificación.',
      sinRed: 'Revisa tu conexión a internet e inténtalo de nuevo.',
      robot: 'No hemos podido comprobar que no eres un robot. Vuelve a probar.',
      generico: 'Algo ha fallado. Inténtalo de nuevo.',
    },
    en: {
      credenciales: 'Wrong email or password',
      sinConfirmar: 'Confirm your email before logging in (check your inbox)',
      yaExiste: "There's already an account with that email",
      demasiados: 'Too many attempts. Give it a moment.',
      debil: 'That password is too easy to guess. Use at least 8 characters.',
      filtrada: 'That password has turned up in data leaks from other websites; choose another one',
      igual: 'Your new password has to be different from the old one.',
      codigo: "That code isn't valid or has expired.",
      noDisponible: "This sign-in method isn't available yet",
      suspendida: 'Your account is suspended. If you think this is a mistake, email info@klendar.app.',
      correoMal: "That email doesn't look valid",
      sms: "We couldn't send the text. Check the number and try again.",
      telefono: 'Enter a valid number',
      sesion: 'Your session has expired. Log in again to continue.',
      dosPasos: "Your account uses two-step verification. To change your email or password, log in at klendar.app/cuenta in a browser: it'll ask for the 6-digit code from your authenticator app.",
      sinRed: 'Check your internet connection and try again.',
      robot: "We couldn't check that you're not a robot. Please try again.",
      generico: 'Something went wrong. Please try again.',
    },
  };

  function clave(error) {
    const code = String(error?.code || '');
    const status = String(error?.status || '');
    const m = String(error?.message ?? error ?? '').toLowerCase();
    const es = (codes, textos = []) => codes.includes(code) || textos.some((t) => m.includes(t));

    if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/.test(m)) return 'sinRed';
    if (es(['invalid_credentials'], ['invalid login credentials'])) return 'credenciales';
    if (es(['email_not_confirmed'], ['email not confirmed'])) return 'sinConfirmar';
    if (es(['user_already_exists', 'email_exists', 'phone_exists'], ['already registered', 'already exists'])) return 'yaExiste';
    if (status === '429' || es(['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'],
      ['rate limit', 'too many', 'for security purposes'])) return 'demasiados';
    // Contraseña filtrada (Leaked Password Protection de Supabase, en prod
    // desde el 2-11-2026): `weak_password` con la razón `pwned`. Lo demás de
    // `weak_password` (`length`, `characters`): la regla de verdad, mínimo 8.
    const razones = Array.isArray(error?.reasons) ? error.reasons : [];
    if (razones.includes('pwned') || (code === 'weak_password' && m.includes('pwned')) || m.includes('known to be weak')) return 'filtrada';
    // Antes que «débil»: el texto de `same_password` («New password should be
    // different…») también contiene «password should be».
    if (es(['same_password'], ['should be different'])) return 'igual';
    if (es(['weak_password'], ['password should be'])) return 'debil';
    if (es(['otp_expired', 'mfa_verification_failed', 'mfa_challenge_expired'], ['token has expired', 'otp has expired', 'invalid totp'])) return 'codigo';
    // Cuenta con 2FA y sesión aal1: Supabase no deja cambiar correo ni
    // contraseña (401). «Tu cuenta» pide antes el código; esto es por si acaso.
    if (es(['insufficient_aal'], ['aal2 session'])) return 'dosPasos';
    if (es(['provider_disabled', 'email_provider_disabled', 'phone_provider_disabled', 'signup_disabled', 'otp_disabled'],
      ['provider is not enabled', 'unsupported provider', 'signups not allowed'])) return 'noDisponible';
    if (es(['user_banned'], ['banned'])) return 'suspendida';
    if (es(['captcha_failed', 'captcha_unavailable'], ['captcha'])) return 'robot';
    if (es(['email_address_invalid'])) return 'correoMal';
    if (es(['sms_send_failed'])) return 'sms';
    if (es(['validation_failed'], ['invalid phone'])) return m.includes('phone') ? 'telefono' : 'generico';
    if (es(['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'])) return 'sesion';
    if (m) console.warn('auth:', error);
    return 'generico';
  }

  window.KL_AUTH_ERROR = (error, lang) => klBi(TEXTOS, lang)[clave(error)];
  window.KL_AUTH_TEXT = (k, lang) => klBi(TEXTOS, lang)[k];
})();

/* El error de un campo, debajo de él, como en la app (y en «Tu cuenta»). Lo
 * usan el panel y el admin, que no comparten código con «Tu cuenta». */
(function () {
  // «Tu cuenta» y el panel, en un idioma sin tabla propia (catalán, francés…):
  // la española, pasada por el diccionario que ha cargado /assets/i18n.js.
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);
  const klLoc = (lang) => (globalThis.KL_LOCALE ? globalThis.KL_LOCALE(lang) : lang === 'en' ? 'en-GB' : 'es-ES');
  const MSG = {
    es: { obligatorio: 'Obligatorio', correo: 'Ese correo no parece válido', minimo: 'Mínimo 8 caracteres' },
    en: { obligatorio: 'Required', correo: "That email doesn't look valid", minimo: 'At least 8 characters' },
  };
  const CORREO_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  function campo(el, msg) {
    const label = el.closest('label') || el.parentElement;
    const id = `err-${el.id || el.name}`;
    let s = document.getElementById(id);
    label.classList.toggle('con-error', Boolean(msg));
    if (!msg) { s?.remove(); el.removeAttribute('aria-invalid'); return; }
    if (!s) {
      s = document.createElement('small');
      s.className = 'err-campo';
      s.id = id;
      label.appendChild(s);
      el.addEventListener('input', () => campo(el, null), { once: true });
    }
    s.textContent = msg;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', id);
  }

  /** Valida un correo (y, si se pasa, una contraseña) y marca cada campo. */
  function correoYClave(lang, email, clave) {
    const m = klBi(MSG, lang);
    const v = email.value.trim();
    const e1 = !v ? m.obligatorio : CORREO_OK.test(v) ? null : m.correo;
    campo(email, e1);
    let e2 = null;
    if (clave) { e2 = clave.value ? null : m.obligatorio; campo(clave, e2); }
    (e1 ? email : e2 ? clave : null)?.focus();
    return !e1 && !e2;
  }

  window.KL_CAMPO = campo;
  window.KL_VALIDA = { correoYClave, MSG };
})();

/* La comprobación anti-robots (Cloudflare Turnstile) antes de entrar, crear
 * la cuenta, pedir un código o recuperar la contraseña. Supabase la exige en
 * cuanto se activa en Authentication → Attack Protection; aquí solo se pide
 * si el entorno tiene clave (`KLENDAR_ENV.turnstile`, producción). Casi
 * siempre se resuelve sola; si Cloudflare duda, aparece un recuadro para
 * marcar JUNTO AL FORMULARIO que lo pide. La app hace lo mismo con
 * klendar.app/captcha/.
 *
 * Dónde: el formulario lleva un hueco `<div class="kl-captcha-sitio"
 * style="position:absolute"></div>` (`KL_CAPTCHA.HUECO`, justo encima de su
 * botón principal) o se le pasa el sitio a mano
 * (`KL_CAPTCHA.pre(el)`, `KL_CAPTCHA(el)`). Sin sitio, el primer hueco que
 * se vea; si no hay ninguno, dentro del diálogo abierto o, como último
 * recurso, fijo abajo de la página (Iván, 18-11: en el admin se quedaba
 * colgado abajo en la pantalla del código de 6 cifras). Vacío no ocupa nada
 * (`interaction-only`). El recuadro se quita (`turnstile.remove`) en cuanto
 * su hueco sale de la página (cambio de vista) o con `KL_CAPTCHA.quita()`
 * (vistas que solo se esconden, como el acceso del admin al pasar al 2FA);
 * al volver al formulario se prepara otra vez.
 *
 * Por adelantado: el formulario llama a `KL_CAPTCHA.pre()` al pintarse y el
 * widget se resuelve mientras la persona escribe, así que al pulsar el token
 * suele estar ya listo. Los tokens son de un solo uso y valen 300 s: al
 * gastar uno se pide el siguiente y uno viejo no se usa; uno sin gastar se
 * renueva antes de caducar, así que al pulsar siempre hay uno fresco. Si
 * Cloudflare da error o no contesta en ESPERA_MS, se reintenta solo una vez;
 * si vuelve a fallar, error (el de «no eres un robot»), y volver a pulsar lo
 * reintenta. La app hace lo mismo.
 *
 * Uso: `options: { captchaToken: await KL_CAPTCHA() }` (undefined sin clave). */
(function () {
  const VALE_MS = 270 * 1000;  // margen sobre los 300 s del token
  const ESPERA_MS = 20 * 1000;  // sin respuesta de Cloudflare (ni recuadro); la app, igual
  let cargando = null;
  function carga() {
    if (window.turnstile) return Promise.resolve();
    if (!cargando) {
      cargando = new Promise((ok, mal) => {
        const s = document.createElement('script');
        const no = () => { cargando = null; mal(fallo('captcha_unavailable')); };
        // Si Cloudflare ni contesta, no esperar para siempre (el script puede
        // llegar luego: la próxima vez ya estará).
        const t = setTimeout(no, ESPERA_MS);
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => { clearTimeout(t); ok(); };
        s.onerror = () => { clearTimeout(t); no(); };
        document.head.appendChild(s);
      });
    }
    return cargando;
  }
  function fallo(code) { return Object.assign(new Error('captcha'), { code }); }
  const clave = () => window.KLENDAR_ENV && window.KLENDAR_ENV.turnstile;

  // Un solo widget por página, en el hueco del formulario que lo pide.
  let caja = null;
  let id = null;
  let listo = null;          // { token, en }: resuelto y sin gastar
  let estado = 'nada';       // 'pidiendo' | 'listo' | 'mirando' (recuadro a la vista) | 'error'
  let esperan = [];          // quienes han pulsado y esperan un token
  let renueva = null;        // temporizador: el token sin gastar, antes de caducar
  let reintentado = false;   // ya se ha reintentado solo tras un error
  let vigia = null;          // MutationObserver: el hueco ya no está en la página

  function siguiente() {
    clearTimeout(renueva);
    listo = null;
    estado = 'pidiendo';
    try { window.turnstile.reset(id); } catch (e) { /* ya no está */ }
  }
  /** Se ve (ni él ni nada de lo de fuera con `display:none` o `hidden`). */
  const seVe = (el) => !!(el && el.isConnected && el.getClientRects().length);
  /** El hueco: el que se pasa, o el primero que se vea. */
  function hueco(sitio) {
    if (typeof sitio === 'string') sitio = document.querySelector(sitio);
    if (sitio && sitio.nodeType === 1) return sitio;
    const todos = document.querySelectorAll('.kl-captcha-sitio');
    for (let i = 0; i < todos.length; i++) if (seVe(todos[i])) return todos[i];
    return null;
  }
  /** Último recurso: dentro del diálogo abierto (encima de todo) o fijo abajo. */
  function ultimoRecurso() {
    const dialogos = document.querySelectorAll('dialog[open]');
    const d = dialogos[dialogos.length - 1];
    return seVe(d) ? d : null;
  }
  /** Fuera el widget (y quien esperaba su token: su formulario ya no está). */
  function quita() {
    if (vigia) { vigia.disconnect(); vigia = null; }
    clearTimeout(renueva);
    if (id !== null) { try { window.turnstile.remove(id); } catch (e) { /* ya no está */ } }
    if (caja && caja.parentNode) caja.parentNode.removeChild(caja);
    caja = null; id = null; listo = null; estado = 'nada'; reintentado = false;
    const todos = esperan;
    esperan = [];
    todos.forEach((q) => q.mal(fallo('captcha_failed')));
  }
  function pinta(dentro, enDialogo) {
    caja = document.createElement('div');
    caja.id = 'kl-captcha';
    caja.className = 'kl-captcha';
    // Vacío no ocupa nada; con el recuadro a la vista, centrado y con aire
    // (data-mirando, más abajo). Fijo abajo solo si no hay dónde ponerlo.
    caja.style.cssText = dentro
      ? 'display:block;width:100%;max-width:100%;overflow:hidden'
      : 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1000;max-width:calc(100vw - 32px)';
    (dentro || document.body).appendChild(caja);
    if (vigia) { vigia.disconnect(); vigia = null; }
    if (dentro && !enDialogo && typeof MutationObserver === 'function') {
      // Cambio de vista: el hueco sale de la página y el widget con él.
      vigia = new MutationObserver(() => { if (caja && !caja.isConnected) quita(); });
      vigia.observe(document.body, { childList: true, subtree: true });
    } else if (dentro && enDialogo) {
      dentro.addEventListener('close', () => { if (caja && caja.parentNode === dentro) quita(); }, { once: true });
    }
  }
  const mirando = (si) => {
    if (!caja) return;
    if (si) caja.setAttribute('data-mirando', '');
    else caja.removeAttribute('data-mirando');
    if (caja.style.position === 'fixed') return;
    // El hueco va con `position:absolute` (HUECO de abajo): así, vacío, no es
    // una fila más del formulario (ni su `gap`). Con el recuadro a la vista,
    // en su sitio y con algo de aire.
    const h = caja.parentNode;
    if (h && h.classList && h.classList.contains('kl-captcha-sitio')) {
      h.style.position = si ? 'static' : 'absolute';
      caja.style.margin = si ? '4px 0' : '';
    } else caja.style.margin = si ? '12px 0 0' : '';
  };
  const tema = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || t === 'light' ? t : 'auto';
  };
  /** `previo`: por adelantado (`pre`); sin hueco a la vista no se pinta nada
   * (al pulsar ya se verá dónde). */
  function prepara(sitio, previo) {
    if (!clave()) return Promise.resolve();
    // El que hay vale si está en ese hueco o, sin hueco, si se ve.
    const vale = (h) => id !== null && caja && caja.isConnected
      && (h ? caja.parentNode === h : (seVe(caja) || caja.style.position === 'fixed'));
    const donde = () => { const h = hueco(sitio); return h && h.isConnected ? h : null; };
    if (vale(donde())) return Promise.resolve();
    if (previo && !donde()) return Promise.resolve();
    return carga().then(() => {
      const aqui = donde();
      if (vale(aqui)) return;
      if (previo && !aqui) return;
      if (id !== null) { try { window.turnstile.remove(id); } catch (e) { /* ya no está */ } }
      if (caja && caja.parentNode) caja.parentNode.removeChild(caja);
      clearTimeout(renueva);
      const dialogo = aqui ? null : ultimoRecurso();
      pinta(aqui || dialogo, !!dialogo && !aqui);
      const dentroDe = !!aqui;
      estado = 'pidiendo';
      listo = null;
      id = window.turnstile.render(caja, {
        sitekey: clave(),
        appearance: 'interaction-only',
        // Del ancho del formulario, como sus campos y su botón (mínimo 300 px).
        size: dentroDe ? 'flexible' : 'normal',
        'refresh-expired': 'auto',
        // Turnstile habla francés, alemán e italiano; catalán, gallego y euskera, no: español.
        language: /^(en|fr|de|it)$/.test(document.documentElement.lang) ? document.documentElement.lang : 'es',
        theme: tema(),
        callback: (token) => {
          reintentado = false;
          const quien = esperan.shift();
          if (quien) { quien.ok(token); setTimeout(siguiente, 0); return; }
          listo = { token, en: Date.now() };
          estado = 'listo';
          clearTimeout(renueva);
          renueva = setTimeout(() => { if (listo && listo.token === token) siguiente(); }, VALE_MS);
        },
        'error-callback': () => {
          listo = null;
          // La primera vez, otra vez desde el principio sin decir nada.
          if (!reintentado) {
            reintentado = true;
            setTimeout(siguiente, 0);
            return true;
          }
          estado = 'error';
          const todos = esperan;
          esperan = [];
          todos.forEach((q) => q.mal(fallo('captcha_failed')));
          return true;
        },
        'expired-callback': () => { listo = null; estado = 'pidiendo'; },
        'before-interactive-callback': () => { estado = 'mirando'; mirando(true); },
        'after-interactive-callback': () => { if (estado === 'mirando') estado = 'pidiendo'; mirando(false); },
      });
    });
  }

  window.KL_CAPTCHA = async function (sitio) {
    if (!clave()) return undefined;
    // Uno fresco y sin gastar vale esté donde esté (p. ej. el de un diálogo
    // que se acaba de cerrar al pulsar «Seguir»).
    if (!(listo && id !== null && Date.now() - listo.en < VALE_MS)) await prepara(sitio);
    if (listo && Date.now() - listo.en < VALE_MS) {
      const token = listo.token;
      siguiente();
      return token;
    }
    if (estado === 'error') reintentado = false;
    if (listo || estado === 'error') siguiente();
    return new Promise((ok, mal) => {
      const quien = { ok, mal };
      esperan.push(quien);
      let otraVez = true;
      // Mientras el recuadro está a la vista, la persona tiene el tiempo que
      // necesite. Sin respuesta, se reintenta solo una vez antes del error.
      const vigila = () => {
        if (!esperan.includes(quien)) return;
        if (estado === 'mirando') { setTimeout(vigila, ESPERA_MS); return; }
        if (otraVez) { otraVez = false; siguiente(); setTimeout(vigila, ESPERA_MS); return; }
        esperan = esperan.filter((q) => q !== quien);
        siguiente();
        mal(fallo('captcha_failed'));
      };
      setTimeout(vigila, ESPERA_MS);
    });
  };
  /** Al pintar un formulario que la va a pedir: se resuelve mientras se
   * escribe. `sitio`: su hueco (si no, el primer `.kl-captcha-sitio` que se vea). */
  window.KL_CAPTCHA.pre = function (sitio) { prepara(sitio, true).catch(() => { /* al pulsar se vuelve a probar */ }); };
  /** Al dejar un formulario que solo se esconde (no sale de la página). */
  window.KL_CAPTCHA.quita = quita;
  /** El hueco para poner encima del botón principal de un formulario. */
  window.KL_CAPTCHA.HUECO = '<div class="kl-captcha-sitio" style="position:absolute"></div>';
})();
