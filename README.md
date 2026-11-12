# klendar.app

Web pública de Klendar: landing, páginas legales y páginas de enlace (`/o/<id>`, `/b/<id>`, `/r/<código>`) que abren la app.

- Sitio estático servido por **GitHub Pages** con el dominio `klendar.app` (`CNAME`).
- `404.html` atiende los enlaces `/o`, `/b`, `/r` (GitHub Pages no tiene rutas dinámicas): intenta abrir la app y ofrece descargarla.
- `.well-known/assetlinks.json` — App Links de Android. Contiene las huellas del certificado de **debug** y del de **release** (`android/keys/klendar-release.jks` en el repo de la app, fuera de git).
- `.well-known/apple-app-site-association` — Universal Links de iOS y autorrelleno de contraseñas, con el Team ID `PJ9F5AMML5` (`tool/apple_ids.py` en el repo de la app).
- Las páginas legales se generan con `python build_legal.py` a partir de los textos en ese archivo (no editar los `.html` a mano). Quién es el titular (hoy la persona física; la SL cuando exista) se rellena solo en el bloque `TITULAR_DATOS` de arriba del script: con `tipo='empresa'` se niega a generar si falta algún dato. `python build_legal.py --vista-previa` genera en `tools/legal_preview/` cómo quedarán con una SL de ejemplo (no se publica). Guía completa: `docs/LEGAL_SL.md` en el repo de la app.

## Generar las páginas

- `python build_site.py` → landing ES (`index.html`), EN (`en.html`) y soporte EN (`en/support.html`). Textos en el dict `T` del script.
- `python build_legal.py` → páginas legales en ES (idioma que prevalece) y su traducción informativa en `/en/{legal-notice,privacy,terms,business-terms,cookies,community-guidelines,delete-account}/` con aviso de cortesía; el mapa de rutas ES↔EN está en `ALT` (`build_site.py`) y alimenta hreflang y el selector de idioma.
- **Novedades** (`/novedades`, `/en/whats-new`): lo nuevo de cada versión de la app, en 3 o 4 puntos por versión. Se escribe solo en `assets/novedades.json` (instrucciones dentro) y `python build_pages.py` pinta las dos páginas. La app descarga ese mismo JSON (Cuenta › Ayuda › Novedades): añadir una versión no pide compilarla. Cómo se publica una versión: `docs/RUNBOOK.md` de la app, §2-bis.
- Capturas de la app en `assets/screens/*.webp` (540 px de ancho, en español, también en `/en`; datos inventados): se rehacen desde la app con `python tool/store_screenshots.py web` (`docs/tiendas/CAPTURAS.md`) y, al cambiarlas, se sube su `?v=`.
- Idioma: `/` es ES; en la primera visita, si el navegador está en inglés, redirige a `/en` y se recuerda la elección del selector ES/EN (`localStorage.klendar_lang`). `hreflang` en todas las páginas.
  Francés, alemán e italiano van también a la versión inglesa y catalán, gallego y euskera a la española (`esOEn`).

- **Precios del plan y fechas del «Gratis de lanzamiento»: un interruptor**, `PRECIOS` en `functions/_lib/chrome.js` (apagado desde el 2026-11-11, hasta que la gestoría aclare el alta de Iván como autónomo). Apagado: sin precio, cuota, IVA, prueba de 30 días ni «gratis hasta…» en la portada, Para negocios, Preguntas, Sobre, la guía PDF del kit y «Tu cuenta»; «Precios» fuera del menú, del pie y del sitemap; `/precios` dice «¿Cuánto cuesta? Te lo explicamos en persona» (noindex). Para encenderlo: `true` y `python build_site.py && python build_pages.py && python build_legal.py && python tools/build_kit.py` (en la app, `python tool/asistente_corpus.py` y desplegar `help-assistant`). No toca los textos legales ni «Tu plan» del panel.

## Direcciones sin barra al final (desde el 2026-11-11)

Iván: todas las direcciones van **sin barra final** (`/privacidad`, `/en/privacy`,
`/para-negocios`, `/cuenta/entrar`, `/panel#/validar`); solo la portada es `/`.

- Cada página es un fichero `x.html` (no `x/index.html`): `privacidad.html`,
  `en/privacy.html`, `panel.html`… Cloudflare Pages sirve `x.html` en `/x`.
- Lo viejo sigue funcionando con **un solo 301** a la buena (con su `?…`; el
  `#…` lo conserva el navegador):
  - páginas estáticas (fuera de las Functions por su dirección exacta en
    `_routes.json`): una línea `/x/ /x 301` en `_redirects` (sin ella, Pages da
    un 308);
  - todo lo demás (`/descubre/`, `/cuenta/`, `/panel/`, `/x.html`,
    `/x/index.html`, `/privacy`, `/terms`, `/en/agenda/…`, `/hoy/`):
    `functions/_middleware.js` con `functions/_lib/direccion.js`.
  - **Excepción**: `/captcha/` se sigue sirviendo tal cual (200, regla `200` de
    `_redirects`): la app hasta la 0.1.7 abre `/captcha/` en una vista web que no
    deja salir de `/captcha/…`; un 301 rompería entrar y crear la cuenta.
- Una página estática nueva: su `x.html`, su dirección exacta en `exclude` de
  `_routes.json` y su `/x/ /x 301` en `_redirects`.
- `python tools/rutas_check.py` (pre-push) avisa de cualquier enlace propio con
  barra final y de lo que falte en `_routes.json`/`_redirects`;
  `python tools/rutas_check.py --vivo https://klendar.app` recorre la web de
  verdad (200 sin barra, canonical, hreflang, og:url y 301 de un salto desde lo viejo).
- Los títulos de la pestaña van todos como «Página · Klendar» (también la
  portada, «Sobre nosotros» y la tele): `tools/titulos_check.mjs`.

## Idiomas de «Tu cuenta» y del panel

«Tu cuenta» (`/cuenta`) y el panel (`/panel`) van en ocho idiomas: español (la
fuente), inglés y catalán, gallego, euskera, francés, alemán e italiano. El
admin y las páginas públicas, solo en español e inglés.

- El motor es `assets/i18n.js`: traduce lo que se ve con un diccionario
  español → idioma. El inglés va dentro de cada herramienta (`assets/cuenta/i18n.js`,
  `panel/i18n.js`); los demás, en `assets/cuenta/i18n/<lang>.js` y `panel/i18n/<lang>.js`,
  que solo se descargan si es el idioma elegido (los escribe el motor con
  `document.write` según `data-dic` de su `<script>`). Las claves admiten huecos
  (`'Quedan {n} plazas'`).
- En el código, `EN ? 'inglés' : 'español'` sigue igual: en un idioma nuevo se
  pinta el español y lo traduce el motor. `LANG`/`I18N.lang` es el idioma real
  (fechas con `Intl`, `profiles.locale`) y `PUB_EN`/`I18N.pub` dice qué versión de
  las páginas públicas enlazar.
- `python tools/i18n_missing.py --lang all` lista lo que falta en cada idioma
  (`--json` para los traductores) y `python tools/i18n_merge.py <cuenta|panel> <lang> <fichero.json>`
  mete las traducciones y sube el `data-dic-v`.

## Hosting

Desde 2026-09-16 la web se sirve con **Cloudflare Pages** (proyecto `klendar-web`,
cuenta dev@klendar.app), conectado a este repo: cada push a `main` despliega.
El DNS de klendar.app también está en Cloudflare (nameservers `chase`/`nelly`);
el dominio y el correo siguen en IONOS. GitHub Pages quedó desactivado (su
certificado nunca se emitió). `_redirects` manda www → apex; `_headers` añade
cabeceras de seguridad y `noindex` en `/admin`.

## Panel de administración (`/admin`)

SPA estática (`admin.html` + `admin/admin.css` + `admin/admin.js`, sin build) con
supabase-js que llama a las RPC `admin_*` del proyecto (migraciones
`20260916100000_admin.sql` y `20260922100000_admin_v2.sql` en el repo de la
app). Solo funciona para cuentas dadas de alta en `public.admin_users`; el primer
administrador se crea por SQL y los siguientes desde el propio panel
(Administradores):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'tu@email';
```

Secciones: Resumen (KPIs, pendientes, series de 30 días), Cifras (registros, activación, retención, sitios, negocios y origen de las visitas; `admin_stats_*`, todo agregado), Negocios (ficha
completa: verificar, rechazar, editar, equipo, plan, pagos, aviso), Publicaciones
(moderación, estado, boost, canjeos), Canjeos, Usuarios (consentimientos RGPD,
suspender, premium, borrar cuenta), Reseñas y posts, Denuncias (DSA), Planes y
pagos, Avisos y push, Categorías, Configuración, Administradores, Registro de
actividad y Ayuda. Todo listado se exporta a CSV y toda acción queda en
`admin_audit_log`. La clave embebida es la *publishable* (pública); la seguridad
la ponen `is_admin()` y RLS. Los JS y el CSS de `admin/` se guardan un año en el navegador (`_headers`) y no
pasan por las Functions (`_routes.json`): su `?v=` en `admin.html` (y lo propio
que carga esa página) es la huella del fichero y la pone sola
`tools/versiones_admin.py` en el pre-commit (`.githooks/pre-commit`; el pre-push
lo comprueba). No hace falta subirlo a mano.
- `python tools/build_kit.py` → kit para negocios en `assets/kit/` (guía de 1 página y cartel A4 con QR; reportlab + qrcode; fuentes Sora y Manrope en `tools/fonts/`, copiadas de la app).
- `python tools/build_brand.py` → símbolo, favicon, apple-touch-icon, icon-512 y `og.png` a partir del símbolo «Pulso» (misma geometría que `tool/brand/make_brand.py` de la app).

## Enlaces compartidos (`/o/<id>`, `/b/<id>`)

`functions/o/[id].js` y `functions/b/[id].js` (Cloudflare Pages Functions) leen
la ficha pública de Supabase (`offer_detail` / `business_profile`, clave
publishable) y devuelven la página «Abrir en Klendar» con Open Graph, Twitter
Card y JSON-LD (Offer/Event/LocalBusiness) del contenido real, para que las
vistas previas de WhatsApp, Telegram, X, etc. muestren título, texto e imagen.
Ids que no existen → 404 `noindex`. `/r/<código>` sigue en `404.html` (solo
tiene sentido dentro de la app). Prueba local: `npx wrangler@3 pages dev .`.

## La web como la app: Descubre, Explorar, Planes, Cuenta

- Las cuatro pestañas de la app (`TABS` en `functions/_lib/chrome.js`):
  arriba en el escritorio y en una barra fija abajo en el móvil. Planes y
  Cuenta viven en «Tu cuenta» (`/cuenta/planes`, `/cuenta`). Lo demás
  (agenda, cómo funciona, negocios, precios…) va en «Más».
- Descubre (`/descubre`, `/en/discover`) y Explorar (`/explorar`,
  `/en/explore`) los pinta `functions/_lib/explore.js`: una barra con
  Filtros (hoja con precio, orden, categoría, distancia…), Dónde, ¿Cuándo? y
  Tipo; en Explorar, además, buscar y Lista · Mapa · Calendario. Todo va en
  la URL y funciona sin JavaScript (`<details>` y formularios GET).
- Una sola tarjeta de publicación: `tarjeta()` en `assets/tarjeta.js`
  (formas `grande` y `fila`; plantillas de `offers.style`), con sus estilos
  y los del calendario en `assets/tarjeta.css`. La usan la web pública (vía
  `functions/_lib/tarjeta.js`, que solo la reexporta) y el panel del negocio
  en el navegador («Tus publicaciones», su calendario y la vista previa del
  formulario). En la web pública, el vídeo, la cuenta atrás y la distancia
  los pone `/assets/tarjetas.js`.

## URLs legales para terceros (`/legal/...`)

`functions/legal/[doc].js` redirige a la versión en el idioma del visitante
(`Accept-Language`, o `?lang=es|en` para forzarla). Son las direcciones que se
dan a Google, Apple, las tiendas o en un contrato, para no atar el documento a
un idioma:

| URL | Documento |
|---|---|
| `/legal/privacy` | Política de privacidad |
| `/legal/terms` | Términos de uso |
| `/legal/business-terms` | Condiciones para negocios |
| `/legal/cookies` | Cookies |
| `/legal/guidelines` | Normas de la comunidad |
| `/legal/legal-notice` | Aviso legal |
| `/legal/delete-account` | Eliminar cuenta |
| `/legal/support` | Soporte |

No se indexan (robots.txt las excluye): lo indexable son las páginas por idioma,
que ya llevan canonical y hreflang.

## Klendar en la tele (`/tv`)

`tv.html` + `tv/tv.css` + `tv/tv.js`, sin depender de nada más que `config.js`
y el QR (`assets/vendor/qrcode.js`), escrito para navegadores de tele algo
viejos. La tele pide un código (`tv_pair_start`), lo enseña con un QR a
`/tv/enlazar/<código>` (`functions/tv/enlazar/[code].js` → panel `#/tele`; la
app lo abre como App Link) y, cuando alguien del local lo escribe en «Poner
en la tele» (`tv_pair_claim`), recoge su llave (`tv_pair_poll`) y pide lo que
enseña cada minuto (`tv_feed`). Guarda en el navegador la llave y lo último
que enseñó (`klendar.tv.llave`, `klendar.tv.ultimo`). Migración
`20261129100001_tele` del repo de la app; diseño en
`docs/DISENOS_PUBLICACION.md` §8.
