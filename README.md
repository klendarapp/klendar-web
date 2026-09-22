# klendar.app

Web pública de Klendar: landing, páginas legales y páginas de enlace (`/o/<id>`, `/b/<id>`, `/r/<código>`) que abren la app.

- Sitio estático servido por **GitHub Pages** con el dominio `klendar.app` (`CNAME`).
- `404.html` atiende los enlaces `/o`, `/b`, `/r` (GitHub Pages no tiene rutas dinámicas): intenta abrir la app y ofrece descargarla.
- `.well-known/assetlinks.json` — App Links de Android. Contiene las huellas del certificado de **debug** y del de **release** (`android/keys/klendar-release.jks` en el repo de la app, fuera de git).
- `.well-known/apple-app-site-association` — Universal Links de iOS. Sustituir `TEAMID` por el Team ID de Apple Developer.
- Las páginas legales se generan con `python build_legal.py` a partir de los textos en ese archivo (no editar los `index.html` a mano). Los datos marcados en amarillo (titular, NIF, domicilio) están pendientes de la forma jurídica.

## Generar las páginas

- `python build_site.py` → landing ES (`index.html`), EN (`en/index.html`) y soporte EN (`en/support/`). Textos en el dict `T` del script.
- `python build_legal.py` → páginas legales en ES (idioma que prevalece) y su traducción informativa en `/en/{legal-notice,privacy,terms,business-terms,cookies,community-guidelines,delete-account}/` con aviso de cortesía; el mapa de rutas ES↔EN está en `ALT` (`build_site.py`) y alimenta hreflang y el selector de idioma.
- Capturas de la app en `assets/screens/*.webp` (540 px de ancho, sacadas del emulador en español).
- Idioma: `/` es ES; en la primera visita, si el navegador está en inglés, redirige a `/en/` y se recuerda la elección del selector ES/EN (`localStorage.klendar_lang`). `hreflang` en todas las páginas.

## Hosting

Desde 2026-09-16 la web se sirve con **Cloudflare Pages** (proyecto `klendar-web`,
cuenta dev@klendar.app), conectado a este repo: cada push a `main` despliega.
El DNS de klendar.app también está en Cloudflare (nameservers `chase`/`nelly`);
el dominio y el correo siguen en IONOS. GitHub Pages quedó desactivado (su
certificado nunca se emitió). `_redirects` manda www → apex; `_headers` añade
cabeceras de seguridad y `noindex` en `/admin/`.

## Panel de administración (`/admin/`)

SPA estática (`admin/index.html` + `admin.css` + `admin.js`, sin build) con
supabase-js que llama a las RPC `admin_*` del proyecto (migraciones
`20260916100000_admin.sql` y `20260922100000_admin_v2.sql` en el repo de la
app). Solo funciona para cuentas dadas de alta en `public.admin_users`; el primer
administrador se crea por SQL y los siguientes desde el propio panel
(Administradores):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'tu@email';
```

Secciones: Resumen (KPIs, pendientes, series de 30 días), Negocios (ficha
completa: verificar, rechazar, editar, equipo, plan, pagos, aviso), Publicaciones
(moderación, estado, boost, canjeos), Canjeos, Usuarios (consentimientos RGPD,
suspender, premium, borrar cuenta), Reseñas y posts, Denuncias (DSA), Planes y
pagos, Avisos y push, Categorías, Configuración, Administradores, Registro de
actividad y Ayuda. Todo listado se exporta a CSV y toda acción queda en
`admin_audit_log`. La clave embebida es la *publishable* (pública); la seguridad
la ponen `is_admin()` y RLS. Al cambiar `admin.js`/`admin.css`, sube el `?v=` en
`admin/index.html` para saltar la caché.
- `python tools/build_kit.py` → kit para negocios en `assets/kit/` (guía de 1 página y cartel A4 con QR; reportlab + qrcode; fuentes Sora y Manrope en `tools/fonts/`, copiadas de la app).
- `python tools/build_brand.py` → símbolo, favicon, apple-touch-icon, icon-512 y `og.png` a partir del símbolo «Pulso» (misma geometría que `tool/brand/make_brand.py` de la app).
