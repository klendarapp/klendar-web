"""El único indicador de carga es la aguja de Klendar (Iván, 2026-10-28).

Falla si en el CSS, el JavaScript o el HTML de la web aparece otro:
  - una animación sin fin que no sea de las permitidas (la aguja, el brillo
    de los esqueletos, el punto «en vivo» que respira, el adorno de la
    portada);
  - una rueda hecha con bordes (`border-right-color: transparent` girando);
  - una barra `<progress>` sin valor (con valor es progreso real y vale).

Lo que tiene forma conocida carga con esqueleto (`.loading`, `.esq`, `.sk`)
y lo instantáneo, sin nada (GLOSARIO, «Movimiento»).

Uso: python tools/indicadores_check.py   (va en el pre-push)
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SALTAR = {'node_modules', '.git', '.wrangler', 'vendor', 'fonts'}

PERMITIDAS = {
    'mov-gira',        # la aguja: botón ocupado, foto que se sube
    'mov-aguja-gira',  # la aguja suelta («Cargando…» de «Tu cuenta»)
    'mov-brillo',      # el brillo de los esqueletos
    'pulse',           # los esqueletos del admin (.sk)
    'mov-respira',     # «Abierto» / en vivo: no es carga
    'float',           # el adorno de la portada: no es carga
}

ANIM = re.compile(r'animation:\s*([\w-]+)[^;}"]*\binfinite')
RUEDA = re.compile(r'border-right-color:\s*transparent[^}]*animation|animation[^}]*border-right-color:\s*transparent')
PROGRESO = re.compile(r'<progress(?![^>]*\bvalue=)[^>]*>')

fallos = []
for raiz, dirs, archivos in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SALTAR]
    for a in archivos:
        if not a.endswith(('.css', '.js', '.html', '.mjs')) or a.endswith('.min.js'):
            continue
        ruta = os.path.join(raiz, a)
        rel = os.path.relpath(ruta, ROOT).replace('\\', '/')
        if rel.startswith('tools/'):
            continue
        with open(ruta, encoding='utf-8', errors='replace') as f:
            texto = f.read()
        for m in ANIM.finditer(texto):
            if m.group(1) not in PERMITIDAS:
                n = texto.count('\n', 0, m.start()) + 1
                fallos.append(f'{rel}:{n} animación sin fin «{m.group(1)}» (¿un indicador de carga?)')
        for m in RUEDA.finditer(texto):
            n = texto.count('\n', 0, m.start()) + 1
            fallos.append(f'{rel}:{n} rueda de carga con bordes')
        for m in PROGRESO.finditer(texto):
            n = texto.count('\n', 0, m.start()) + 1
            fallos.append(f'{rel}:{n} <progress> sin valor')

if fallos:
    print('Indicadores de carga que no son la aguja de Klendar:')
    for f in fallos:
        print('  ' + f)
    sys.exit(1)
print('Indicadores de carga: solo la aguja de Klendar y los esqueletos.')
