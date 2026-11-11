"""Los enlaces a «Tu cuenta», al panel y al admin llevan a una pantalla que existe.

El 5-11 (3b4b95f) «Tu cuenta» pasó a `/cuenta/…` (rutas limpias) cambiando `#/`
por `/cuenta/` en sus scripts, y un enlace al panel se quedó en
`/panel//cuenta/baja?biz=…` (revisión del 9-11, I6). Esto mira, en lo que se
publica (no en tools/ ni en lo de terceros):

  - `//` pegado a `/cuenta/`, `/panel/` o `/admin/` (también `/panel/${… ? `/x` …}`,
    que da `//` al juntarse);
  - `/panel/<algo>` y `/admin/<algo>` sin `#/`: el panel y el admin son una sola
    página y sus pantallas van con `#/` (salvo sus propios ficheros);
  - `/cuenta/<pantalla>`: que «Tu cuenta» tenga esa pantalla (`RUTAS.x = …`);
  - `/panel/#/<pantalla>`, `/admin/#/<pantalla>` y los `#/<pantalla>` de dentro
    del panel y del admin: que exista (`PAGES.x = …`).

Y, desde el 11-11 (Iván: todas las direcciones sin barra al final), que ningún
enlace propio lleve la barra final (`/privacidad/`, `klendar.app/en/privacy/`,
`/panel/#/x`, `${base}/`): la dirección buena es `/privacidad`, `/panel#/x`; la
portada sigue siendo `/`. Las viejas siguen funcionando (301 en
functions/_middleware.js, `_lib/direccion.js`), pero un enlace nuestro no debe
pasar por ahí.

  python tools/rutas_check.py                 -> sale con 1 si encuentra alguno
  python tools/rutas_check.py --vivo URL      -> además recorre la web en URL (p. ej.
      https://klendar.app o la vista previa de Pages): cada página del sitemap y
      del menú da 200 con su canonical sin barra, y con barra (y `.html`,
      `/index.html`) da un solo 301 a la buena.
"""

from __future__ import annotations

import glob
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lee(ruta: str) -> str:
    with open(os.path.join(RAIZ, ruta), encoding='utf-8', errors='replace') as f:
        return f.read()


def nombres(patron_ficheros: str, que: str) -> set[str]:
    """Las pantallas registradas (`RUTAS.x =`, `RUTAS['x-y'] =` o lo mismo con PAGES)."""
    hay: set[str] = set()
    for f in glob.glob(os.path.join(RAIZ, patron_ficheros)):
        texto = open(f, encoding='utf-8', errors='replace').read()
        hay |= set(re.findall(rf"\b{que}\.([a-z][a-z0-9]*)\s*=(?!=)", texto))
        hay |= set(re.findall(rf"\b{que}\['([a-z][a-z0-9-]*)'\]\s*=(?!=)", texto))
    return hay


CUENTA = nombres('assets/cuenta/*.js', 'RUTAS')
PANEL = nombres('panel/*.js', 'PAGES')
ADMIN = nombres('admin/*.js', 'PAGES')

# Lo publicado: páginas, scripts, Functions y la ayuda. Ni tools/ ni lo de terceros.
FICHEROS = [l for l in subprocess.run(
    ['git', 'ls-files', '--', '*.js', '*.html', '*.json', '*.md', '*.py', '*.xml', '*.txt', '*.webmanifest', '_redirects', '_headers', ':!tools/', ':!assets/vendor/', ':!README.md',
     ':!**/README.md', ':!docs/'],
    cwd=RAIZ, capture_output=True, text=True, encoding='utf-8').stdout.splitlines() if l]

# Delante de una ruta: comillas, espacio, paréntesis, `=`, `}` (`${location.origin}/…`) o el dominio.
ANTES = r"""(?:(?<=[\s'"`(=}>])|(?<=klendar\.app))"""
DOBLE = re.compile(ANTES + r"/(cuenta|panel|admin)//")
DOBLE_PLANTILLA = re.compile(ANTES + r"/(cuenta|panel|admin)/\$\{[^`\n]*`/")
SIN_HASH = re.compile(ANTES + r"/(panel|admin)/([A-Za-z0-9][^\s'\"`<>)\\#?]*)")
A_CUENTA = re.compile(ANTES + r"/cuenta/([a-z][a-z0-9-]*)")
A_HASH = re.compile(ANTES + r"/(panel|admin)/?(?:\?[^#\s'\"`]*)?#/([a-z][a-z0-9-]*)")
# Las páginas de la web (sin barra final). Detrás, lo que cierra una dirección.
PAGINAS = [
    'accesibilidad', 'aviso-legal', 'captcha', 'como-funciona', 'cookies', 'eliminar-cuenta', 'estado', 'fuentes',
    'negocios', 'normas', 'para-entidades', 'para-negocios', 'precios', 'preguntas', 'prensa', 'privacidad', 'sobre',
    'soporte', 'terminos', 'descubre', 'explorar', 'agenda', 'hoy', 'con-ninos', 'partidos', 'grupos', 'sorteos',
    'cuenta', 'panel', 'admin', 'tv', 'alta', 'en',
] + ['en/' + s for s in (
    'about', 'accessibility', 'business-terms', 'community-guidelines', 'cookies', 'delete-account', 'faq',
    'for-business', 'for-organisations', 'how-it-works', 'legal-notice', 'press', 'pricing', 'privacy', 'sources',
    'status', 'support', 'terms', 'discover', 'explore', 'whats-on', 'today', 'kids', 'matches', 'groups', 'giveaways')]
# `/privacidad/` entre comillas, en un href o tras el dominio, y que no siga la ruta
# (ni `'/agenda/' + ciudad`, `${en ? '/en/matches/' : '/partidos/'}${id}` ni
# `/cuenta/${x}`, que son prefijos).
CON_BARRA = re.compile(
    r"""(?:(?<=klendar\.app)|(?<=["'`(=\s>]))/(""" + '|'.join(re.escape(p) for p in sorted(PAGINAS, key=len, reverse=True))
    + r""")/(?=["'`?#<\s)\\]|$)(?!["'`]\s*(\+|\}\$\{|:\s*["'`][^"'`]*["'`]\}\$\{))""")
# `${base}/"` o `${x}/?…`: una dirección hecha con piezas que acaba en barra (menos la portada).
PIEZA_CON_BARRA = re.compile(r"""\$\{(?!(BASE|origin|location\.origin|APP_URL)\})[^{}]*\}/(?=["'`?#])""")
# Las que no son direcciones de la web: comentarios de documentación y lo que solo se compara.
LOGICA = re.compile(r"startsWith\(|\.test\(|\.match\(|\.replace\(|\.slice\(|RegExp|Disallow|direccionBuena")
HASH_DENTRO = re.compile(r"""(?<=['"`=])#/([a-z][a-z0-9-]*)""")
COMENTARIO = re.compile(r'^\s*(//|\*|/\*|#)')


# Las que se siguen sirviendo con barra (200, sin redirigir): la app hasta la
# 0.1.7 abre `/captcha/` en una vista web que no deja salir de `/captcha/…`.
CON_BARRA_200 = {'/captcha'}


def main() -> int:
    malos: list[str] = []
    for f in FICHEROS:
        try:
            texto = lee(f)
        except OSError:
            continue
        propio = 'panel' if f.startswith('panel/') else 'admin' if f.startswith('admin/') else None
        for n, linea in enumerate(texto.splitlines(), 1):
            if COMENTARIO.match(linea):
                continue
            donde = f'{f}:{n}'
            for m in DOBLE.finditer(linea):
                malos.append(f'{donde}: «/{m[1]}//…» (dos barras)')
            for m in DOBLE_PLANTILLA.finditer(linea):
                malos.append(f'{donde}: «/{m[1]}/${{… `/…` }}» (al juntarse da dos barras)')
            for m in SIN_HASH.finditer(linea):
                resto = m[2]
                # Sus propios ficheros (/panel/panel.css, /admin/i18n.js, /panel/i18n/fr.js).
                if re.match(r'^[\w./-]+\.(js|css|html|png|svg|json|webp|jpg)$', resto) or resto.startswith('i18n/'):
                    continue
                malos.append(f'{donde}: «/{m[1]}/{resto}» (el {m[1]} no tiene esa dirección; sus pantallas van con #/)')
            for m in A_CUENTA.finditer(linea):
                if m[1] not in CUENTA:
                    malos.append(f'{donde}: «/cuenta/{m[1]}» («Tu cuenta» no tiene esa pantalla)')
            for m in A_HASH.finditer(linea):
                if m[2] not in (PANEL if m[1] == 'panel' else ADMIN):
                    malos.append(f'{donde}: «/{m[1]}/#/{m[2]}» (el {m[1]} no tiene esa pantalla)')
            if not LOGICA.search(linea) and not f.endswith('.md') and f not in ('functions/_lib/direccion.js',):
                for m in CON_BARRA.finditer(linea):
                    malos.append(f'{donde}: «/{m[1]}/» lleva barra al final (va sin ella: «/{m[1]}»)')
                if f.endswith('.js'):
                    for m in PIEZA_CON_BARRA.finditer(linea):
                        malos.append(f'{donde}: «{m[0]}» acaba en barra (las direcciones van sin ella)')
            if propio:
                for m in HASH_DENTRO.finditer(linea):
                    if m[1] not in (PANEL if propio == 'panel' else ADMIN):
                        malos.append(f'{donde}: «#/{m[1]}» (el {propio} no tiene esa pantalla)')
    # Cada página estática (`x.html`) sin barra: fuera de las Functions por su
    # dirección exacta (`_routes.json`) y con su `/x/ /x 301` en `_redirects`
    # (sin él, Cloudflare da un 308); las zonas con sesión pasan por el middleware.
    import json
    fuera = set(json.loads(lee('_routes.json'))['exclude'])
    reglas = set(l.strip() for l in lee('_redirects').splitlines() if l.strip() and not l.startswith('#'))
    for f in glob.glob(os.path.join(RAIZ, '*.html')) + glob.glob(os.path.join(RAIZ, 'en', '*.html')):
        ruta = '/' + os.path.relpath(f, RAIZ).replace(os.sep, '/')[:-5]
        if ruta in ('/index', '/404', '/en/404') or ruta in ('/cuenta', '/panel', '/admin', '/tv', '/alta'):
            continue
        if ruta not in fuera:
            malos.append(f'_routes.json: falta «{ruta}» en exclude (la página estática pasaría por las Functions)')
        # `/captcha/` sigue sirviéndose tal cual (200) para la app hasta la 0.1.7.
        if f'{ruta}/ {ruta} 301' not in reglas and not (ruta in CON_BARRA_200 and f'{ruta}/ {ruta} 200' in reglas):
            malos.append(f'_redirects: falta «{ruta}/ {ruta} 301»')
    for d in glob.glob(os.path.join(RAIZ, '**', 'index.html'), recursive=True):
        rel = os.path.relpath(d, RAIZ).replace(os.sep, '/')
        if rel != 'index.html' and not rel.startswith(('tools/', 'node_modules/')):
            malos.append(f'{rel}: las páginas van en `x.html` (sin barra), no en `x/index.html`')
    if len(CUENTA) < 30 or len(PANEL) < 30 or len(ADMIN) < 20:
        malos.append(f'no encuentro las pantallas (cuenta {len(CUENTA)}, panel {len(PANEL)}, admin {len(ADMIN)})')
    if malos:
        print('Enlaces que no van bien (pantallas que no existen o con barra al final):')
        for l in malos[:60]:
            print('  ' + l[:200])
        if len(malos) > 60:
            print(f'  … y {len(malos) - 60} más')
        return 1
    print(f'Rutas bien: {len(FICHEROS)} ficheros; pantallas de «Tu cuenta» {len(CUENTA)}, panel {len(PANEL)}, admin {len(ADMIN)}.')
    return 0


# ── --vivo: la web de verdad ─────────────────────────────────────────────────
# Las que viven fuera del sitemap: zonas con sesión, la tele y la comprobación.
FUERA_DEL_SITEMAP = ['/cuenta', '/cuenta/entrar', '/cuenta/registro', '/panel', '/admin', '/tv', '/captcha', '/alta',
                     '/precios', '/en/pricing', '/sorteos', '/en/giveaways', '/hoy/malaga', '/en/today/malaga',
                     '/agenda/malaga', '/en/whats-on/malaga']
# Con fichero propio (`x.html`): también `/x.html` y `/x/index.html` dan 301.
ESTATICAS = set(['/' + p for p in PAGINAS if p not in (
    'descubre', 'explorar', 'agenda', 'hoy', 'con-ninos', 'partidos', 'grupos', 'sorteos', 'cuenta')]) - {
    '/en/discover', '/en/explore', '/en/whats-on', '/en/today', '/en/kids', '/en/matches', '/en/groups', '/en/giveaways'}


def vivo(base: str) -> int:
    """Recorre la web en `base`: 200 sin barra (con su canonical), 301 de un salto desde lo viejo."""
    import http.client
    import urllib.parse

    raiz = urllib.parse.urlsplit(base)
    def pide(ruta: str):
        con = (http.client.HTTPSConnection if raiz.scheme == 'https' else http.client.HTTPConnection)(raiz.netloc, timeout=30)
        con.request('GET', ruta, headers={'User-Agent': 'klendar-rutas-check', 'Accept-Language': 'es'})
        r = con.getresponse()
        cuerpo = r.read().decode('utf-8', 'replace') if r.status == 200 else ''
        loc = r.getheader('location') or ''
        con.close()
        return r.status, urllib.parse.urlsplit(urllib.parse.urljoin(base + ruta, loc)) if loc else None, cuerpo

    _, _, mapa = pide('/sitemap.xml')
    rutas = [urllib.parse.urlsplit(u).path for u in re.findall(r'<loc>([^<]+)</loc>', mapa)]
    rutas = list(dict.fromkeys(rutas + FUERA_DEL_SITEMAP))
    malos: list[str] = []
    vistos = 0
    enlaces: set[str] = set()
    for ruta in rutas:
        st, _, html = pide(ruta)
        vistos += 1
        if st != 200:
            malos.append(f'{ruta}: da {st} (tenía que dar 200)')
            continue
        canon = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        if canon and urllib.parse.urlsplit(canon[1]).path != ruta:
            malos.append(f'{ruta}: su canonical es {canon[1]}')
        if not canon and ruta not in FUERA_DEL_SITEMAP:
            malos.append(f'{ruta}: sin canonical')
        for m in re.finditer(r'<link rel="alternate" hreflang="[a-z-]+" href="([^"]+)"', html):
            if urllib.parse.urlsplit(m[1]).path.endswith('/') and urllib.parse.urlsplit(m[1]).path != '/':
                malos.append(f'{ruta}: hreflang con barra: {m[1]}')
        og = re.search(r'<meta property="og:url" content="([^"]+)"', html)
        if og and urllib.parse.urlsplit(og[1]).path != ruta:
            malos.append(f'{ruta}: su og:url es {og[1]}')
        for h in re.findall(r'href="(/[^"#?]*)', html):
            enlaces.add(h)
        if ruta == '/':
            continue
        viejas = [ruta + '/', ruta + '/?x=1']
        if ruta in ESTATICAS:
            viejas += [ruta + '.html', ruta + '/index.html']
        for vieja in viejas:
            if ruta in CON_BARRA_200 and vieja.startswith(ruta + '/?') or vieja == ruta + '/' and ruta in CON_BARRA_200:
                st, _, cuerpo = pide(vieja)
                vistos += 1
                if st != 200 or 'turnstile' not in cuerpo.lower():
                    malos.append(f'{vieja}: da {st} (tiene que seguir dando la página, 200, para la app 0.1.7)')
                continue
            st, a, _ = pide(vieja)
            vistos += 1
            esperado = ruta + ('?x=1' if vieja.endswith('?x=1') else '')
            llega = (a.path + (('?' + a.query) if a.query else '')) if a else ''
            if st != 301 or llega != esperado:
                malos.append(f'{vieja}: da {st} {llega or ""} (tenía que dar 301 a {esperado})')
            elif a:
                st2, _, _ = pide(llega)
                vistos += 1
                if st2 != 200:
                    malos.append(f'{vieja}: el 301 lleva a {llega}, que da {st2} (más de un salto o roto)')
    for h in sorted(enlaces):
        if h != '/' and h.endswith('/') and not h.startswith(('/assets/', '/.well-known/')):
            malos.append(f'enlace con barra en las páginas: {h}')
    if malos:
        print(f'En {base}:')
        for l in malos[:80]:
            print('  ' + l)
        return 1
    print(f'{base}: {len(rutas)} páginas y {vistos} peticiones, todo sin barra y con 301 de un salto desde lo viejo.')
    return 0


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--vivo':
        raise SystemExit(main() or vivo(sys.argv[2].rstrip('/')))
    raise SystemExit(main())
