# klendar.app

Web pública de Klendar: landing, páginas legales y páginas de enlace (`/o/<id>`, `/b/<id>`, `/r/<código>`) que abren la app.

- Sitio estático servido por **GitHub Pages** con el dominio `klendar.app` (`CNAME`).
- `404.html` atiende los enlaces `/o`, `/b`, `/r` (GitHub Pages no tiene rutas dinámicas): intenta abrir la app y ofrece descargarla.
- `.well-known/assetlinks.json` — App Links de Android. Contiene las huellas del certificado de **debug** y del de **release** (`android/keys/klendar-release.jks` en el repo de la app, fuera de git).
- `.well-known/apple-app-site-association` — Universal Links de iOS. Sustituir `TEAMID` por el Team ID de Apple Developer.
- Las páginas legales se generan con `python build_legal.py` a partir de los textos en ese archivo (no editar los `index.html` a mano). Los datos marcados en amarillo (titular, NIF, domicilio) están pendientes de la forma jurídica.

## Generar las páginas

- `python build_site.py` → landing ES (`index.html`), EN (`en/index.html`) y soporte EN (`en/support/`). Textos en el dict `T` del script.
- `python build_legal.py` → páginas legales (solo ES, idioma que prevalece); usan la misma cabecera/pie.
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

`admin/index.html` es una página estática con supabase-js que llama a las RPC
`admin_*` del proyecto (migración `20260916100000_admin.sql` en el repo de la
app). Solo funciona para cuentas dadas de alta en `public.admin_users`:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'tu@email';
```

Permite: KPIs, verificar/rechazar negocios, moderar publicaciones, resolver
denuncias (retirando o no el contenido) y buscar usuarios. La clave que lleva
embebida es la *publishable* (pública); la seguridad la ponen `is_admin()` y RLS.
