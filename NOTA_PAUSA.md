# Pausa — direcciones limpias del admin (§4zzz-adminlimpio), 24-11

Rama `klw-adminlimpio` (worktree `../klw-adminlimpio`). **Nada subido a main.**
La app (`../kl-adminlimpio`, rama `kl-adminlimpio`) está creada pero sin tocar.

## Hecho (commit «Admin: direcciones limpias sin #…», sin probar en navegador)
- `functions/_lib/admin.js`: `SECCIONES_ADMIN` (los `PAGES.x` menos el Resumen) y
  `esPantallaAdmin`. En admin.klendar.app, `/`, `/<apartado>` y lo que cuelga
  (`/negocios/<id>`…) sirven `admin.html`; barra final → 301 sin ella;
  `/resumen` → 301 a `/`. `/carta`, `/admin…` (404) y lo demás (301 a
  klendar.app), como antes. Middleware y `tools/serve_dev.mjs`: solo comentarios.
- `admin/admin.js`: `currentRoute` lee `location.pathname`, `params` lee
  `location.search`, `rutaDe('resumen') = '/'`, `go(h, reemplaza)` con
  `pushState` + `route()`, `popstate` pinta, `#` se quita de la barra al cargar y
  en `hashchange` (no salta a ningún apartado), clic en enlaces a pantallas del
  admin sin recargar (sin tocar Ctrl/Mayús/target). `ponUrl`, COLAS («al
  siguiente pendiente»), `alPanel` (→ `/`) adaptados.
- Todos los `#/x` del admin → `/x` (admin.js, bandeja, crecer, festivos, guias,
  medios, piloto, sorteos); logos del menú y nav del Resumen → `/`; «Cerrar
  sesión» `href="/"`; FAQ del asistente a `${WEB}/preguntas#…`.
- `assets/cuenta/app.js`: tras la contraseña nueva, `destino=/admin` →
  `https://admin.klendar.app` (sin barra).

## Por dónde seguir
1. `tools/admin_dominio_check.mjs`: el parche (casos de rutas nuevas, 301 con
   barra, `/resumen`, SECCIONES_ADMIN = PAGES, sin `#/` en el admin, logos a `/`,
   «Tu cuenta» sin barra, tras entrar en `/` sin `#`) falló al aplicarse por las
   comillas del heredoc: rehacerlo con un .py en el scratchpad. Añadir la parte
   de navegador: cada apartado del menú sin `#`, atrás/adelante, recargar en un
   apartado y en una ficha con filtros, `/#/x` → raíz.
2. `tools/_supabase_simulado.mjs` `enSuHost`: `/admin#/x?q` → `/x?q` (y `#/resumen` → `/`);
   luego `bandeja_check`, `propadmin_check`, `csp_check`, `captcha_sitio_check`,
   `tablet`, `a11y`, `titulos`, `dos_pasos`, `festivos`, `piloto`… (buscan
   `location.hash`, `#/`, `hashchange`).
3. `tools/rutas_check.py`: en admin/ comprobar `'/x'` contra PAGES y prohibir `#/`.
4. App: `_shared/plantilla.ts` `ADMIN_WEB = 'https://admin.klendar.app'`, enlaces
   `${ADMIN_WEB}/<apartado>` en admin-alerts, web-errors-alert, holidays,
   send-auth-email, migraciones/tool/docs (`grep -rn "admin.klendar.app\|#/"`);
   tests `_tests/avisos_admin.test.ts`, `cuenta_enlaces.test.ts`; desplegar solo
   en DEV. RUNBOOK §4zzz-adminlimpio.
5. Pre-push entero, `subir_main.sh`, y comprobar en prod solo leyendo:
   `/semanas` 200, `/semanas/` 301, `/admin` 404.
