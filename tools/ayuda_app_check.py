# -*- coding: utf-8 -*-
"""La ayuda de la app no habla de precios ni lleva a pagar.

`assets/ayuda.json` es lo que descarga la app, también las versiones ya
instaladas. Tiene que ser lo que genera `ayuda.py` (sin las preguntas `app=False`
ni enlaces a precios o al panel) y pasar `comprueba_app`. `/preguntas` y
`/en/faq` sí pueden hablar de precios. Revisión N-01 del 5-11-2026: Apple 3.1.1
y 3.1.3; Google Play, Pagos §4.

    python tools/ayuda_app_check.py
"""
import io
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

import ayuda  # noqa: E402

generado = ayuda.json_para_la_app()  # falla si se cuela un precio o un enlace a pagar
publicado = json.load(io.open(os.path.join(RAIZ, 'assets', 'ayuda.json'), encoding='utf-8'))
ayuda.comprueba_app(publicado)
if publicado != generado:
    sys.exit('assets/ayuda.json no está al día con ayuda.py: python build_pages.py')
ocultas = {p['id'] for p in ayuda.PREGUNTAS if not p.get('app', True)}
for lang in ('es', 'en'):
    for para in ('ti', 'negocios'):
        fuera = ocultas & {e['id'] for e in publicado[lang][para]}
        if fuera:
            sys.exit(f'en la app no deberían salir: {sorted(fuera)}')
print('ayuda de la app: sin precios ni enlaces a pagar,', len(publicado['es']['ti']) + len(publicado['es']['negocios']), 'preguntas')
