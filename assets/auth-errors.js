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
  const TEXTOS = {
    es: {
      credenciales: 'Correo o contraseña incorrectos',
      sinConfirmar: 'Confirma tu correo antes de entrar (mira tu bandeja)',
      yaExiste: 'Ya existe una cuenta con ese correo',
      demasiados: 'Demasiados intentos. Espera un momento.',
      debil: 'Esa contraseña es muy fácil de adivinar. Usa al menos 8 caracteres y mezcla letras y números.',
      igual: 'La nueva contraseña tiene que ser distinta de la anterior.',
      codigo: 'Ese código no vale o ha caducado.',
      noDisponible: 'Este método de acceso no está disponible todavía',
      suspendida: 'Tu cuenta está suspendida. Si crees que es un error, escríbenos a info@klendar.app.',
      correoMal: 'Ese correo no parece válido',
      sms: 'No hemos podido mandar el SMS. Revisa el número y vuelve a probar.',
      telefono: 'Escribe un número válido',
      sesion: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
      sinRed: 'Revisa tu conexión a internet e inténtalo de nuevo.',
      generico: 'Algo ha fallado. Inténtalo de nuevo.',
    },
    en: {
      credenciales: 'Wrong email or password',
      sinConfirmar: 'Confirm your email before logging in (check your inbox)',
      yaExiste: "There's already an account with that email",
      demasiados: 'Too many attempts. Give it a moment.',
      debil: 'That password is too easy to guess. Use at least 8 characters with letters and numbers.',
      igual: 'Your new password has to be different from the old one.',
      codigo: "That code isn't valid or has expired.",
      noDisponible: "This sign-in method isn't available yet",
      suspendida: 'Your account is suspended. If you think this is a mistake, write to info@klendar.app.',
      correoMal: "That email doesn't look valid",
      sms: "We couldn't send the text. Check the number and try again.",
      telefono: 'Enter a valid number',
      sesion: 'Your session has expired. Log in again to continue.',
      sinRed: 'Check your internet connection and try again.',
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
    if (es(['weak_password'], ['password should be'])) return 'debil';
    if (es(['same_password'], ['should be different'])) return 'igual';
    if (es(['otp_expired'], ['token has expired', 'otp has expired'])) return 'codigo';
    if (es(['provider_disabled', 'email_provider_disabled', 'phone_provider_disabled', 'signup_disabled', 'otp_disabled'],
      ['provider is not enabled', 'unsupported provider', 'signups not allowed'])) return 'noDisponible';
    if (es(['user_banned'], ['banned'])) return 'suspendida';
    if (es(['email_address_invalid'])) return 'correoMal';
    if (es(['sms_send_failed'])) return 'sms';
    if (es(['validation_failed'], ['invalid phone'])) return m.includes('phone') ? 'telefono' : 'generico';
    if (es(['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'])) return 'sesion';
    if (m) console.warn('auth:', error);
    return 'generico';
  }

  window.KL_AUTH_ERROR = (error, lang) => TEXTOS[lang === 'en' ? 'en' : 'es'][clave(error)];
  window.KL_AUTH_TEXT = (k, lang) => TEXTOS[lang === 'en' ? 'en' : 'es'][k];
})();

/* El error de un campo, debajo de él, como en la app (y en «Tu cuenta»). Lo
 * usan el panel y el admin, que no comparten código con «Tu cuenta». */
(function () {
  const MSG = {
    es: { obligatorio: 'Obligatorio', correo: 'Ese correo no parece válido', minimo: 'Mínimo 8 caracteres', noCoinciden: 'Las contraseñas no coinciden' },
    en: { obligatorio: 'Required', correo: "That email doesn't look valid", minimo: 'At least 8 characters', noCoinciden: "Passwords don't match" },
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
    const m = MSG[lang === 'en' ? 'en' : 'es'];
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
