# klendar.app

Web pública de Klendar: landing, páginas legales y páginas de enlace (`/o/<id>`, `/b/<id>`, `/r/<código>`) que abren la app.

- Sitio estático servido por **GitHub Pages** con el dominio `klendar.app` (`CNAME`).
- `404.html` atiende los enlaces `/o`, `/b`, `/r` (GitHub Pages no tiene rutas dinámicas): intenta abrir la app y ofrece descargarla.
- `.well-known/assetlinks.json` — App Links de Android. Contiene las huellas del certificado de **debug** y del de **release** (`android/keys/klendar-release.jks` en el repo de la app, fuera de git).
- `.well-known/apple-app-site-association` — Universal Links de iOS. Sustituir `TEAMID` por el Team ID de Apple Developer.
- Las páginas legales se generan con `python build_legal.py` a partir de los textos en ese archivo (no editar los `index.html` a mano). Los datos marcados en amarillo (titular, NIF, domicilio) están pendientes de la forma jurídica.
