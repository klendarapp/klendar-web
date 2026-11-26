"""Cada pantalla del panel y de «Tu cuenta» tiene su esqueleto (§4zzz-cargas,
P3 aprobada por Iván el 26-11).

Mientras carga, cada pantalla enseña la forma de lo que viene
(`KL_ESQUELETO(tipo)`, assets/esqueleto.js). Qué tipo lleva cada una lo dice
`ESQUELETO_DE` en panel/panel.js y en assets/cuenta/app.js. Falla si:
  - una pantalla (`PAGES.x =` en panel/, `RUTAS.x =` en assets/cuenta/) no está
    en su `ESQUELETO_DE` (saldría el de por defecto, con otra forma);
  - `ESQUELETO_DE` nombra una pantalla que ya no existe, o la pone dos veces;
  - un tipo de `ESQUELETO_DE` no está en assets/esqueleto.js;
  - el panel o «Tu cuenta» vuelven al esqueleto común (`class="loading"` en el
    router del panel o `esq tarjetas` en el de «Tu cuenta»).

Uso: python tools/esqueletos_check.py   (va en el pre-push)
"""
import glob
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lee(ruta):
    with open(os.path.join(RAIZ, ruta), encoding='utf-8') as f:
        return f.read()


def pantallas(patron, nombre):
    claves = set()
    for ruta in sorted(glob.glob(os.path.join(RAIZ, patron))):
        texto = open(ruta, encoding='utf-8').read()
        for m in re.finditer(nombre + r"""(?:\.([A-Za-z_]\w*)|\['([^']*)'\])\s*=(?!=)""", texto):
            claves.add(m.group(1) if m.group(1) is not None else m.group(2))
    return claves


def mapa(ruta):
    texto = lee(ruta)
    m = re.search(r'const ESQUELETO_DE = \{(.*?)\n\};', texto, re.S)
    if not m:
        return None, texto
    tipos = {}
    for t in re.finditer(r"(\w+):\s*\[(.*?)\]", m.group(1), re.S):
        tipos[t.group(1)] = re.findall(r"'([^']*)'", t.group(2))
    return tipos, texto


TIPOS = set(re.findall(r'^\s{4}(\w+): function \(\)', lee('assets/esqueleto.js'), re.M))
fallos = []
if not TIPOS:
    fallos.append('assets/esqueleto.js: no encuentro los tipos (TIPOS)')

for nombre, ruta, patron, clave, comun in (
    ('panel', 'panel/panel.js', 'panel/*.js', 'PAGES', r'innerHTML = \'<div class="loading"'),
    ('«Tu cuenta»', 'assets/cuenta/app.js', 'assets/cuenta/*.js', 'RUTAS', r'class="esq tarjetas"'),
):
    tipos, texto = mapa(ruta)
    if tipos is None:
        fallos.append(f'{ruta}: falta `const ESQUELETO_DE = {{…}};`')
        continue
    hay = pantallas(patron, clave)
    puestas = [p for lista in tipos.values() for p in lista]
    for t in tipos:
        if t not in TIPOS:
            fallos.append(f'{ruta}: el tipo «{t}» no está en assets/esqueleto.js ({", ".join(sorted(TIPOS))})')
    for p in sorted(hay - set(puestas)):
        fallos.append(f'{nombre}: la pantalla «{p}» no tiene esqueleto (añádela a ESQUELETO_DE en {ruta})')
    for p in sorted(set(puestas) - hay):
        fallos.append(f'{nombre}: ESQUELETO_DE nombra «{p}», que no es una pantalla')
    for p in sorted({p for p in puestas if puestas.count(p) > 1}):
        fallos.append(f'{nombre}: «{p}» está dos veces en ESQUELETO_DE')
    if re.search(comun, texto):
        fallos.append(f'{ruta}: vuelve el esqueleto común; usa KL_ESQUELETO(tipo)')
    if 'KL_ESQUELETO(' not in texto:
        fallos.append(f'{ruta}: no usa KL_ESQUELETO')

for pagina in ('panel.html', 'cuenta.html'):
    if '/assets/esqueleto.js?v=' not in lee(pagina):
        fallos.append(f'{pagina}: no carga /assets/esqueleto.js')

if fallos:
    print('Esqueletos:')
    for f in fallos:
        print('  ' + f)
    sys.exit(1)
print('Esqueletos: cada pantalla del panel y de «Tu cuenta» tiene el suyo.')
