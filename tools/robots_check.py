# robots.txt es lo que genera build_site.py (`robots()`, su única fuente):
# falla si el fichero publicado no es exactamente eso, o si hay un sitemap
# dinámico (functions/sitemap-<nombre>.xml.js) que robots.txt no nombra.
# Antes robots() se había quedado atrás (sin sitemap-planes.xml ni los
# Disallow de guías, RRPP, carteles…): ejecutar build_site.py los borraba.
#
#   python tools/robots_check.py
import io, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
os.chdir(RAIZ)
import build_site  # noqa: E402

fallos = []
publicado = io.open('robots.txt', encoding='utf-8', newline='').read()
if build_site.robots() != publicado:
    fallos.append('robots.txt no es lo que genera build_site.py (cambia robots() y ejecuta python build_site.py)')
con_funcion = sorted(f[:-3] for f in os.listdir('functions') if f.startswith('sitemap-') and f.endswith('.xml.js'))
for s in con_funcion:
    if s not in build_site.SITEMAPS:
        fallos.append(f'{s} tiene su función pero no está en SITEMAPS de build_site.py')
for s in build_site.SITEMAPS:
    if s != 'sitemap.xml' and s not in con_funcion:
        fallos.append(f'{s} está en SITEMAPS pero no hay functions/{s}.js')

for f in fallos:
    print('FALLA:', f)
print(f'{len(fallos)} fallo(s)' if fallos else 'robots.txt al día.')
sys.exit(1 if fallos else 0)
