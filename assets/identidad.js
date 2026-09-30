/* Klendar — «Confirma que eres tú» antes de lo delicado (cambiar la
 * contraseña, eliminar la cuenta), igual que la app
 * (lib/features/auth/data/identity_check.dart). Aquí solo va la lógica; cada
 * página pinta su diálogo («Tu cuenta» en app.js, el admin en admin.js).
 *
 * Con la contraseña actual o con un código de 6 cifras al correo se abre una
 * sesión APARTE, recién hecha, sin tocar la del navegador:
 *
 * - Al confirmar, esa sesión llama a `confirm_identity` con el id de la del
 *   navegador: la base la da por confirmada 10 minutos y deja eliminar la
 *   cuenta (`delete_my_account` y `admin_delete_user` lo exigen).
 * - La contraseña nueva se guarda con la sesión aparte (Supabase, con
 *   «Secure password change», pide una sesión de menos de 24 horas) y
 *   Supabase cierra las demás: el navegador se queda con la aparte.
 *
 * Uso:
 *   const id = await KL_IDENTIDAD(sb);         // null si la cuenta no tiene correo
 *   await id.conClave(clave) | await id.mandarCodigo(); await id.conCodigo('123456');
 *   await id.cambiarClave(nueva);              // opcional
 *   await id.cerrar();                         // siempre, al acabar o cancelar
 *
 *   KL_IDENTIDAD.reciente(sb, ['otp'], 600)    // ¿se entró así hace poco?
 */
(function () {
  function datosDe(token) {
    try {
      const p = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)));
    } catch { return null; }
  }

  async function crear(sb) {
    const { data } = await sb.auth.getSession();
    const email = data.session?.user?.email;
    if (!email) return null;
    const aparte = supabase.createClient(window.KLENDAR_ENV.url, window.KLENDAR_ENV.key, {
      // Sin guardar nada ni refrescar sola: vive lo que dura el diálogo. Un
      // nombre y un cerrojo propios de cada vez: con el cerrojo del navegador
      // compartido, una comprobación a medias (pestaña en segundo plano)
      // dejaba esperando a la siguiente y su sesión sin cerrar.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
        storageKey: `klendar-identidad-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        flowType: 'implicit', lock: async (_nombre, _espera, fn) => fn() },
    });
    let clave = null;
    let verificada = false;
    let adoptada = false;
    const robot = async () => window.KL_CAPTCHA?.();
    const falla = (error) => { if (error) throw error; };

    async function confirmada() {
      const { data: d } = await sb.auth.getSession();
      const sid = datosDe(d.session?.access_token)?.session_id;
      if (sid) falla((await aparte.rpc('confirm_identity', { p_session: sid })).error);
      verificada = true;
    }

    return {
      email,
      get verificada() { return verificada; },
      async conClave(c) {
        falla((await aparte.auth.signInWithPassword({ email, password: c, options: { captchaToken: await robot() } })).error);
        clave = c;
        await confirmada();
      },
      async mandarCodigo() {
        // `reauth=1`: la función de correo lo escribe como «Confirma que eres
        // tú», sin botón de entrar.
        falla((await aparte.auth.signInWithOtp({ email, options: {
          shouldCreateUser: false, emailRedirectTo: `${location.origin}/app/?reauth=1`, captchaToken: await robot(),
        } })).error);
      },
      async conCodigo(codigo) {
        falla((await aparte.auth.verifyOtp({ email, token: String(codigo).trim(), type: 'email' })).error);
        await confirmada();
      },
      /** La contraseña nueva; el navegador se queda con la sesión aparte. */
      async cambiarClave(nueva) {
        // La actual también, por si se enciende en Supabase «pedir la
        // contraseña actual al cambiarla».
        falla((await aparte.auth.updateUser({ password: nueva, ...(clave ? { current_password: clave } : {}) })).error);
        const { data: s } = await aparte.auth.getSession();
        if (s.session) {
          falla((await sb.auth.setSession({ access_token: s.session.access_token, refresh_token: s.session.refresh_token })).error);
          adoptada = true;
        }
      },
      async cerrar() {
        if (adoptada) return;
        try { await aparte.auth.signOut({ scope: 'local' }); } catch { /* sin red o cuenta eliminada */ }
      },
    };
  }

  /** ¿La sesión del navegador se abrió con alguno de esos métodos hace menos
   * de `segundos`? (p. ej. el enlace de «¿Has olvidado la contraseña?»). */
  async function reciente(sb, metodos, segundos = 600) {
    const { data } = await sb.auth.getSession();
    const amr = datosDe(data.session?.access_token)?.amr;
    const ahora = Date.now() / 1000;
    return Array.isArray(amr) && amr.some((e) => metodos.includes(e?.method) && ahora - Number(e?.timestamp) < segundos);
  }

  window.KL_IDENTIDAD = crear;
  window.KL_IDENTIDAD.reciente = reciente;
})();
