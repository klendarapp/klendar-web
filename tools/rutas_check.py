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

  python tools/rutas_check.py        -> sale con 1 si encuentra alguno
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
    ['git', 'ls-files', '--', '*.js', '*.html', '*.json', '*.md', ':!tools/', ':!assets/vendor/', ':!README.md',
     ':!**/README.md', ':!docs/'],
    cwd=RAIZ, capture_output=True, text=True, encoding='utf-8').stdout.splitlines() if l]

# Delante de una ruta: comillas, espacio, paréntesis, `=`, `}` (`${location.origin}/…`) o el dominio.
ANTES = r"""(?:(?<=[\s'"`(=}>])|(?<=klendar\.app))"""
DOBLE = re.compile(ANTES + r"/(cuenta|panel|admin)//")
DOBLE_PLANTILLA = re.compile(ANTES + r"/(cuenta|panel|admin)/\$\{[^`\n]*`/")
SIN_HASH = re.compile(ANTES + r"/(panel|admin)/([A-Za-z0-9][^\s'\"`<>)\\#?]*)")
A_CUENTA = re.compile(ANTES + r"/cuenta/([a-z][a-z0-9-]*)")
A_HASH = re.compile(ANTES + r"/(panel|admin)/(?:\?[^#\s'\"`]*)?#/([a-z][a-z0-9-]*)")
HASH_DENTRO = re.compile(r"""(?<=['"`=])#/([a-z][a-z0-9-]*)""")
COMENTARIO = re.compile(r'^\s*(//|\*|/\*|#)')


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
            if propio:
                for m in HASH_DENTRO.finditer(linea):
                    if m[1] not in (PANEL if propio == 'panel' else ADMIN):
                        malos.append(f'{donde}: «#/{m[1]}» (el {propio} no tiene esa pantalla)')
    if len(CUENTA) < 30 or len(PANEL) < 30 or len(ADMIN) < 20:
        malos.append(f'no encuentro las pantallas (cuenta {len(CUENTA)}, panel {len(PANEL)}, admin {len(ADMIN)})')
    if malos:
        print('Enlaces a pantallas que no existen:')
        for l in malos[:60]:
            print('  ' + l[:200])
        if len(malos) > 60:
            print(f'  … y {len(malos) - 60} más')
        return 1
    print(f'Rutas bien: {len(FICHEROS)} ficheros; pantallas de «Tu cuenta» {len(CUENTA)}, panel {len(PANEL)}, admin {len(ADMIN)}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
