"""El `?v=` de lo que se guarda un año es la huella del fichero (sale sola).

Los JS y el CSS del admin (`/admin/`), del panel (`/panel/`), de «Tu cuenta»
(`/assets/cuenta/`) y unos pocos de `/assets/` que solo cargan esas páginas
(SUELTOS) se guardan un año en el navegador (`_headers`, `immutable`): solo se
ve código nuevo si cambia su `?v=`. Para que no dependa de acordarse, el `?v=`
es el principio del id del fichero en git (cambia en cuanto cambia una letra):

  - en `admin.html` y `admin/carta.html`: todo lo propio que lleva `?v=`
    (`/admin/…`, `/assets/…`, `/config.js`);
  - en cualquier otra página: lo de las carpetas de arriba y SUELTOS;
  - los diccionarios de idioma (`data-dic="/panel/i18n/" data-dic-v="…"`): la
    huella de toda la carpeta (cambia si cambia cualquiera de sus ficheros).

Lo gestionado solo se enlaza desde un `.html` y siempre con `?v=`: el `--check`
falla si una página lo enlaza sin `?v=` o si un `.js` lo nombra con `?v=` a mano
(ese no lo pondría al día nadie y se quedaría viejo un año).

  python tools/versiones.py           # pone las huellas (ficheros del disco)
  python tools/versiones.py --index   # pre-commit: lo que va en el commit (y el disco)
  python tools/versiones.py --check [REV]   # pre-push: falla si alguna no cuadra (REV: HEAD)
"""
import hashlib
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTERAS = {'admin.html', 'admin/carta.html'}
# Carpetas enteras con caché de un año (`_headers`).
CARPETAS = ('/admin/', '/panel/', '/assets/cuenta/')
# Ficheros de /assets/ con caché de un año que solo enlazan páginas `.html`
# (ni las Functions ni otro JS los piden con `?v=`). Uno nuevo: aquí y en `_headers`.
SUELTOS = {'/assets/acceso.js', '/assets/identidad.js', '/assets/cajon.js', '/assets/fotogramas.js', '/assets/retenido.js'}
REF = re.compile(r'(\b(?:src|href)=")(/[A-Za-z0-9_./-]+)\?v=([A-Za-z0-9_.-]*)(")')
SIN_V = re.compile(r'\b(?:src|href)="(/[A-Za-z0-9_./-]+\.(?:js|css))"')
DIC = re.compile(r'(\bdata-dic=")(/[A-Za-z0-9_./-]+/)(" data-dic-v=")([A-Za-z0-9_.-]*)(")')
LARGO = 10


def git(*a, entrada=None):
    return subprocess.run(['git', *a], cwd=RAIZ, input=entrada, capture_output=True, check=True).stdout


def paginas():
    return [p for p in git('ls-files', '-z', '--', '*.html').decode().split('\0') if p]


def gestionado(ruta):
    return ruta.startswith(CARPETAS) or ruta in SUELTOS


def cuenta(pagina, ruta):
    return pagina in ENTERAS or gestionado(ruta)


def referencias(textos):
    rutas = set()
    for pagina, t in textos.items():
        for m in REF.finditer(t):
            if cuenta(pagina, m.group(2)):
                rutas.add(m.group(2).lstrip('/'))
        for m in DIC.finditer(t):
            if gestionado(m.group(2)):
                rutas.add(m.group(2).lstrip('/'))  # carpeta, con su barra
    return sorted(rutas)


def huellas(rutas, modo, rev):
    """{ruta: id en git} de cada fichero; para una carpeta (`x/`), la huella de
    todo lo que hay dentro. Sin las que no existen ahí."""
    out = {}
    if not rutas:
        return out
    ficheros = {}
    if modo == 'index':
        for linea in git('ls-files', '-s', '-z', '--', *rutas).decode().split('\0'):
            if linea:
                meta, ruta = linea.split('\t', 1)
                ficheros[ruta] = meta.split()[1]
    elif modo == 'rev':
        for linea in git('ls-tree', '-r', '-z', rev, '--', *rutas).decode().split('\0'):
            if linea:
                meta, ruta = linea.split('\t', 1)
                ficheros[ruta] = meta.split()[2]
    else:
        hay = []
        for r in rutas:
            d = os.path.join(RAIZ, r)
            if r.endswith('/') and os.path.isdir(d):
                hay += [r + n for n in sorted(os.listdir(d)) if os.path.isfile(os.path.join(d, n))]
            elif os.path.isfile(d):
                hay.append(r)
        if hay:
            ficheros = dict(zip(hay, git('hash-object', '--', *hay).decode().split()))
    for r in rutas:
        if r.endswith('/'):
            dentro = sorted((k, v) for k, v in ficheros.items() if k.startswith(r) and '/' not in k[len(r):])
            if dentro:
                out[r] = hashlib.sha1(''.join(f'{k} {v}\n' for k, v in dentro).encode()).hexdigest()
        elif r in ficheros:
            out[r] = ficheros[r]
    return out


def cambia(pagina, texto, hs):
    def sub(m):
        h = hs.get(m.group(2).lstrip('/'))
        if not cuenta(pagina, m.group(2)) or not h:
            return m.group(0)
        return f'{m.group(1)}{m.group(2)}?v={h[:LARGO]}{m.group(4)}'

    def sub_dic(m):
        h = hs.get(m.group(2).lstrip('/'))
        if not gestionado(m.group(2)) or not h:
            return m.group(0)
        return f'{m.group(1)}{m.group(2)}{m.group(3)}{h[:LARGO]}{m.group(5)}'
    return DIC.sub(sub_dic, REF.sub(sub, texto))


def lee_disco(p):
    with open(os.path.join(RAIZ, p), encoding='utf-8', newline='') as f:
        return f.read()


def escribe_disco(p, t):
    with open(os.path.join(RAIZ, p), 'w', encoding='utf-8', newline='') as f:
        f.write(t)


def a_mano_en_js(rev):
    """Un `.js` que nombra lo gestionado con `?v=` (nadie se lo pondría al día)."""
    malos = []
    ls = git('ls-tree', '-r', '-z', '--name-only', rev).decode().split('\0')
    patron = re.compile(r'(/(?:admin|panel|assets)/[A-Za-z0-9_./-]+\.(?:js|css))\?v=')
    for p in ls:
        if not p.endswith(('.js', '.mjs')) or p.startswith(('tools/', 'assets/vendor/')):
            continue
        try:
            t = git('show', f'{rev}:{p}').decode('utf-8', 'replace')
        except subprocess.CalledProcessError:
            continue
        for m in patron.finditer(t):
            if gestionado(m.group(1)):
                malos.append(f'{p}: {m.group(1)}?v=… a mano (enlázalo desde el .html: el `?v=` lo pone tools/versiones.py)')
    return malos


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
            for m in DIC.finditer(t):
                if not gestionado(m.group(2)):
                    continue
                h = hs.get(m.group(2).lstrip('/'))
                if not h:
                    malos.append(f'{p}: la carpeta {m.group(2)} no existe')
                elif m.group(4) != h[:LARGO]:
                    malos.append(f'{p}: data-dic-v="{m.group(4)}" de {m.group(2)} (le toca {h[:LARGO]})')
            for m in SIN_V.finditer(t):
                if gestionado(m.group(1)):
                    malos.append(f'{p}: {m.group(1)} sin ?v= (se guardaría un año sin cambiar nunca)')
            for m in re.finditer(r'\bdata-dic="(/[^"]+/)"(?! data-dic-v=")', t):
                if gestionado(m.group(1)):
                    malos.append(f'{p}: data-dic="{m.group(1)}" sin data-dic-v justo detrás')
        malos += a_mano_en_js(rev)
        if malos:
            print('Versiones que no cuadran (el navegador guardaría el código viejo un año):')
            print('\n'.join(f'  {x}' for x in malos))
            print('Arreglo: python tools/versiones.py, y commit.')
            sys.exit(1)
        print(f'Versiones bien ({len(hs)} ficheros y carpetas).')
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
            print(f'versiones: {p} con las huellas nuevas')
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
