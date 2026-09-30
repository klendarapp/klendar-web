"""Comprueba la sintaxis de TODO el JavaScript de la web antes de subir.

`node --check archivo.js` no sirve para los módulos de `functions/` (usan
`import`/`export`): Node decide cómo leer un `.js` según el `package.json` y,
con uno roto, puede salir sin error. Por eso cada módulo se copia a un `.mjs`
temporal y se comprueba así; los scripts clásicos del navegador (`assets/`,
`app/`, `panel/`, `admin/`, `config.js`…) se comprueban tal cual.

Un error de sintaxis en `functions/` hace que Cloudflare rechace el despliegue
entero (la web se queda en la versión anterior sin avisar).

  python tools/check_js.py        -> sale con 1 si hay algún fallo
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8')
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALTAR = {'node_modules', '.git', '.wrangler', 'tools'}


def archivos():
    for base, dirs, nombres in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in SALTAR and not d.startswith('.')]
        for n in nombres:
            if n.endswith(('.js', '.mjs')) and not n.endswith('.min.js'):
                yield os.path.join(base, n)


def comprueba(ruta: str, tmp: str) -> str | None:
    rel = os.path.relpath(ruta, RAIZ).replace(os.sep, '/')
    objetivo = ruta
    if rel.startswith('functions/') or ruta.endswith('.mjs'):
        objetivo = os.path.join(tmp, rel.replace('/', '__') + '.mjs')
        shutil.copyfile(ruta, objetivo)
    r = subprocess.run(['node', '--check', objetivo], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    if r.returncode != 0:
        return (r.stderr or r.stdout).strip().replace(objetivo, rel)
    return None


def main() -> int:
    fallos = 0
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in sorted(archivos()):
            total += 1
            error = comprueba(ruta, tmp)
            if error:
                fallos += 1
                print(f'✘ {os.path.relpath(ruta, RAIZ)}\n{error[:600]}\n')
    print(f'{total} archivos JS revisados · {fallos} con errores de sintaxis')
    return 1 if fallos else 0


if __name__ == '__main__':
    sys.exit(main())
