"""El `?v=` de lo que carga el admin es la huella del fichero (sale sola).

Los JS y el CSS de `/admin/` se guardan un año en el navegador (`_headers`,
`immutable`): el admin solo ve código nuevo si cambia su `?v=`. Para que no
dependa de acordarse, el `?v=` es el principio del id del fichero en git
(cambia en cuanto cambia una letra):

  - en `admin.html` y `admin/carta.html`: todo lo propio que lleva `?v=`
    (`/admin/…`, `/assets/…`, `/config.js`);
  - en cualquier otra página (`panel.html` usa `admin.css`): lo de `/admin/`.

  python tools/versiones_admin.py           # pone las huellas (ficheros del disco)
  python tools/versiones_admin.py --index   # pre-commit: lo que va en el commit (y el disco)
  python tools/versiones_admin.py --check [REV]   # pre-push: falla si alguna no cuadra (REV: HEAD)
"""
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTERAS = {'admin.html', 'admin/carta.html'}
REF = re.compile(r'(\b(?:src|href)=")(/[A-Za-z0-9_./-]+)\?v=([A-Za-z0-9_.-]*)(")')
LARGO = 10


def git(*a, entrada=None):
    return subprocess.run(['git', *a], cwd=RAIZ, input=entrada, capture_output=True, check=True).stdout


def paginas():
    return [p for p in git('ls-files', '-z', '--', '*.html').decode().split('\0') if p]


def cuenta(pagina, ruta):
    return pagina in ENTERAS or ruta.startswith('/admin/')


def referencias(textos):
    rutas = set()
    for pagina, t in textos.items():
        for m in REF.finditer(t):
            if cuenta(pagina, m.group(2)):
                rutas.add(m.group(2).lstrip('/'))
    return sorted(rutas)


def huellas(rutas, modo, rev):
    """{ruta: id del fichero en git} (sin las que no existen ahí)."""
    out = {}
    if not rutas:
        return out
    if modo == 'index':
        for linea in git('ls-files', '-s', '-z', '--', *rutas).decode().split('\0'):
            if linea:
                meta, ruta = linea.split('\t', 1)
                out[ruta] = meta.split()[1]
    elif modo == 'rev':
        for linea in git('ls-tree', '-r', '-z', rev, '--', *rutas).decode().split('\0'):
            if linea:
                meta, ruta = linea.split('\t', 1)
                out[ruta] = meta.split()[2]
    else:
        hay = [r for r in rutas if os.path.isfile(os.path.join(RAIZ, r))]
        if hay:
            ids = git('hash-object', '--', *hay).decode().split()
            out = dict(zip(hay, ids))
    return out


def cambia(pagina, texto, hs):
    def sub(m):
        h = hs.get(m.group(2).lstrip('/'))
        if not cuenta(pagina, m.group(2)) or not h:
            return m.group(0)
        return f'{m.group(1)}{m.group(2)}?v={h[:LARGO]}{m.group(4)}'
    return REF.sub(sub, texto)


def lee_disco(p):
    with open(os.path.join(RAIZ, p), encoding='utf-8', newline='') as f:
        return f.read()


def escribe_disco(p, t):
    with open(os.path.join(RAIZ, p), 'w', encoding='utf-8', newline='') as f:
        f.write(t)


def main():
    args = sys.argv[1:]
    if args[:1] == ['--check']:
        rev = args[1] if len(args) > 1 else 'HEAD'
        textos = {}
        for p in paginas():
            try:
                textos[p] = git('show', f'{rev}:{p}').decode('utf-8')
            except subprocess.CalledProcessError:
                pass
        hs = huellas(referencias(textos), 'rev', rev)
        malos = []
        for p, t in textos.items():
            for m in REF.finditer(t):
                if not cuenta(p, m.group(2)):
                    continue
                h = hs.get(m.group(2).lstrip('/'))
                if not h:
                    malos.append(f'{p}: {m.group(2)} no existe')
                elif m.group(3) != h[:LARGO]:
                    malos.append(f'{p}: {m.group(2)}?v={m.group(3)} (le toca ?v={h[:LARGO]})')
        if malos:
            print('Versiones del admin que no cuadran (el navegador guardaría el código viejo un año):')
            print('\n'.join(f'  {x}' for x in malos))
            print('Arreglo: python tools/versiones_admin.py, y commit.')
            sys.exit(1)
        print(f'Versiones del admin bien ({len(hs)} ficheros).')
        return
    if args[:1] == ['--index']:
        # Lo que va en el commit manda; el disco se arregla igual (mismas huellas).
        textos = {}
        for p in paginas():
            try:
                textos[p] = git('show', f':{p}').decode('utf-8')
            except subprocess.CalledProcessError:
                pass
        hs = huellas(referencias(textos), 'index', None)
        for p, t in textos.items():
            nuevo = cambia(p, t, hs)
            if nuevo == t:
                continue
            blob = git('hash-object', '-w', '--stdin', f'--path={p}', entrada=nuevo.encode('utf-8')).decode().strip()
            modo = git('ls-files', '-s', '--', p).decode().split()[0]
            git('update-index', '--cacheinfo', f'{modo},{blob},{p}')
            if os.path.isfile(os.path.join(RAIZ, p)):
                disco = lee_disco(p)
                escribe_disco(p, cambia(p, disco, hs))
            print(f'versiones_admin: {p} con las huellas nuevas')
        return
    textos = {p: lee_disco(p) for p in paginas() if os.path.isfile(os.path.join(RAIZ, p))}
    hs = huellas(referencias(textos), 'disco', None)
    for p, t in textos.items():
        nuevo = cambia(p, t, hs)
        if nuevo != t:
            escribe_disco(p, nuevo)
            print(f'{p}: versiones puestas al día')


if __name__ == '__main__':
    main()
