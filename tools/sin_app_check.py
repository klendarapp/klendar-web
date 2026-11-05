"""Que no reaparezca la dirección vieja de «Tu cuenta» (decisión de Iván, 5-11).

`/app` se quitó del todo: ahora es `klendar.app/cuenta/` y `/app/…` da la 404
normal, así que cualquier enlace que vuelva a nombrarla es un enlace roto. Y que
no se cuele `#/` en «Tu cuenta»: tiene una sola forma de ruta, la dirección
(el panel y el admin sí van con `#/`). Barato: `git grep` sobre lo que hay en
el repo.

Se saltan este fichero y la prueba que comprueba que `/app/…` da 404.

  python tools/sin_app_check.py        -> sale con 1 si encuentra alguna
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# `klendar.app/app`, y `/app/` entre comillas o con su `#/`, `?`.
PATRON = r'''klendar\.app/app([/?#"'` ]|$)|["'`(]/app/|/app/[#?]'''
EXCLUIR = [':!tools/sin_app_check.py', ':!tools/cuenta_rutas_check.mjs', ':!assets/vendor/', ':!assets/cuenta/i18n/']
# Una ruta de hash en la propia «Tu cuenta» (sus scripts, su página).
HASH = r'''["'`=]#/[a-z]|location\.hash|hashchange'''


def grep(patron: str, *rutas: str) -> list[str]:
    r = subprocess.run(['git', 'grep', '-nIE', patron, '--', *rutas], cwd=RAIZ, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    return r.stdout.splitlines()


def main() -> int:
    malos = grep(PATRON, '.', *EXCLUIR)
    if not os.path.isdir(os.path.join(RAIZ, 'cuenta')):
        malos.append('falta la carpeta cuenta/')
    if os.path.isfile(os.path.join(RAIZ, 'app', 'index.html')):
        malos.append('ha vuelto app/index.html')
    malos += [l for l in grep(HASH, 'assets/cuenta/*.js', 'cuenta/index.html') if not re.search(r'^assets/cuenta/i18n', l)]
    if malos:
        print('Sigue la dirección vieja de «Tu cuenta» (ahora /cuenta/, sin #/):')
        for l in malos[:40]:
            print('  ' + l[:160])
        return 1
    print('Ninguna referencia a /app/ ni a #/ en «Tu cuenta».')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
