# Genera las páginas legales a partir de los textos de abajo.
# Ejecutar: python build_legal.py   (desde la raíz de klendar-web)
import io

HEAD = '''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Klendar</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0C1220">
<link rel="icon" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/assets/symbol.png" alt=""> Klendar</a>
  <nav class="main"><a href="/#como">Cómo funciona</a><a href="/negocios/">Negocios</a><a href="/soporte/">Soporte</a></nav>
</div></header>
<main class="doc">
<h1>{title}</h1>
<div class="meta">Última actualización: {date} · Versión {version}</div>
{todo}
'''
FOOT = '''
</main>
<footer><div class="wrap">
  <div class="links">
    <a href="/aviso-legal/">Aviso legal</a><a href="/privacidad/">Privacidad</a><a href="/terminos/">Términos de uso</a>
    <a href="/negocios/">Condiciones para negocios</a><a href="/cookies/">Cookies</a><a href="/normas/">Normas de la comunidad</a>
    <a href="/eliminar-cuenta/">Eliminar cuenta</a><a href="/soporte/">Soporte</a>
  </div>
  <div>© 2026 Klendar · <a href="mailto:info@klendar.app">info@klendar.app</a></div>
</div></footer>
</body></html>
'''
TODO = '''<p class="todo"><strong>Pendiente de completar antes del lanzamiento:</strong> los datos marcados en <mark class="tbd">amarillo</mark> (titular, NIF, domicilio) dependen de la forma jurídica que se elija. Este texto es un borrador profesional; conviene que lo revise un abogado antes de publicar la app.</p>'''

TITULAR = '<mark class="tbd">[Nombre del titular / razón social]</mark>'
NIF = '<mark class="tbd">[NIF/CIF]</mark>'
DOMICILIO = '<mark class="tbd">[Domicilio completo, España]</mark>'
DATE = '15 de septiembre de 2026'
VERSION = '2026-09'

PAGES = {}

PAGES['aviso-legal'] = ('Aviso legal', 'Identificación del titular de klendar.app y de la app Klendar (LSSI-CE).', f'''
<h2>1. Identificación del titular</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el sitio web <strong>klendar.app</strong> y la aplicación móvil <strong>Klendar</strong> (en adelante, "la Plataforma") son titularidad de:</p>
<ul>
  <li>Titular: {TITULAR}</li>
  <li>NIF/CIF: {NIF}</li>
  <li>Domicilio: {DOMICILIO}</li>
  <li>Correo electrónico: <a href="mailto:info@klendar.app">info@klendar.app</a></li>
</ul>
<h2>2. Objeto</h2>
<p>Klendar es una plataforma que permite a negocios locales publicar ofertas de duración limitada ("ofertas flash") y eventos, y a las personas usuarias descubrirlos por cercanía, guardarlos, valorarlos y canjearlos mediante un código QR. Klendar actúa como intermediario técnico: las ofertas y eventos son publicados y honrados por cada negocio bajo su exclusiva responsabilidad.</p>
<h2>3. Condiciones de uso</h2>
<p>El acceso y uso de la Plataforma se rige por los <a href="/terminos/">Términos de uso</a> y, para los negocios, por las <a href="/negocios/">Condiciones para negocios</a>. El tratamiento de datos personales se describe en la <a href="/privacidad/">Política de privacidad</a>.</p>
<h2>4. Propiedad intelectual e industrial</h2>
<p>La marca Klendar, el logotipo, el diseño de la Plataforma y su código son titularidad del titular o de sus licenciantes. Los contenidos publicados por los negocios (textos, imágenes, cartas) son responsabilidad y propiedad de quien los publica, que concede a Klendar una licencia no exclusiva para mostrarlos en la Plataforma.</p>
<h2>5. Exclusión de responsabilidad</h2>
<p>El titular no garantiza la disponibilidad ininterrumpida de la Plataforma ni responde de la veracidad, vigencia o cumplimiento de las ofertas publicadas por los negocios, sin perjuicio de los mecanismos de denuncia y moderación descritos en las <a href="/normas/">Normas de la comunidad</a>.</p>
<h2>6. Legislación aplicable</h2>
<p>Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales del domicilio de la persona consumidora, cuando así lo establezca la normativa de consumo, o en su defecto a los del domicilio del titular.</p>
''')

PAGES['privacidad'] = ('Política de privacidad', 'Cómo trata Klendar tus datos personales (RGPD y LOPDGDD).', f'''
<p>Esta política explica qué datos personales tratamos en la app Klendar y en klendar.app, para qué, con qué base legal, cuánto tiempo los conservamos y qué derechos tienes. Cumple el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).</p>

<h2>1. Responsable del tratamiento</h2>
<ul>
  <li>Responsable: {TITULAR} · NIF/CIF: {NIF}</li>
  <li>Domicilio: {DOMICILIO}</li>
  <li>Contacto para protección de datos: <a href="mailto:info@klendar.app">info@klendar.app</a></li>
</ul>

<h2>2. Qué datos tratamos y para qué</h2>
<table>
<tr><th>Tratamiento</th><th>Datos</th><th>Finalidad</th><th>Base jurídica</th><th>Conservación</th></tr>
<tr><td>Cuenta de usuario</td><td>Email, nombre mostrado, contraseña (cifrada), fecha de nacimiento, idioma, foto de perfil (opcional), fecha y versión de aceptación de los términos</td><td>Crear y gestionar tu cuenta; verificar la edad mínima (14 años) y el acceso a contenidos para mayores de 18</td><td>Ejecución del contrato (art. 6.1.b RGPD); obligación legal para la edad (art. 6.1.c; art. 7 LOPDGDD)</td><td>Mientras la cuenta esté activa. Al eliminarla, se borra en 30 días salvo obligación legal de conservación</td></tr>
<tr><td>Inicio de sesión con Google / Apple</td><td>Identificador del proveedor, email, nombre</td><td>Autenticación sin contraseña</td><td>Ejecución del contrato</td><td>Igual que la cuenta</td></tr>
<tr><td>Ubicación</td><td>Coordenadas aproximadas o precisas del dispositivo (según el permiso que concedas)</td><td>Ordenar el feed y el mapa por cercanía; "ofertas cerca de ti" si activas esa opción</td><td>Consentimiento (art. 6.1.a), revocable en los ajustes del dispositivo y de la app</td><td>No se guarda un historial. Solo se conserva la última ubicación conocida (para "cerca de ti") y se descarta a los 7 días</td></tr>
<tr><td>Favoritos, reseñas, canjeos</td><td>Negocios guardados, valoraciones y comentarios, códigos de canjeo y su estado, vistas de ofertas</td><td>Prestar el servicio: tus favoritos, tus reseñas públicas, el historial de canjeos y estadísticas agregadas para los negocios</td><td>Ejecución del contrato</td><td>Mientras exista la cuenta. Las reseñas se muestran con tu nombre mostrado</td></tr>
<tr><td>Notificaciones push</td><td>Token del dispositivo, preferencias (favoritos, cercanía, horas de silencio)</td><td>Avisarte de novedades de tus favoritos y ofertas cercanas</td><td>Consentimiento, revocable en cualquier momento</td><td>Hasta que revoques el permiso, cierres sesión o elimines la cuenta</td></tr>
<tr><td>Cuenta de negocio</td><td>Datos del negocio (nombre, dirección, NIF/CIF, teléfono, email de contacto), miembros del equipo (email y rol)</td><td>Dar de alta, verificar y gestionar el negocio; facturar la cuota</td><td>Ejecución del contrato; obligación legal (facturación)</td><td>Durante la relación y después el plazo legal (fiscal: 4 años; mercantil: 6 años)</td></tr>
<tr><td>Denuncias de contenido</td><td>Identidad de quien denuncia, motivo, contenido denunciado</td><td>Moderar la Plataforma (Reglamento (UE) 2022/2065, DSA)</td><td>Obligación legal e interés legítimo</td><td>2 años desde la resolución</td></tr>
<tr><td>Diagnóstico y rendimiento</td><td>Identificador de instalación, modelo y sistema del dispositivo, informes de errores, uso agregado de pantallas</td><td>Detectar fallos y mejorar la app (Firebase Crashlytics y Analytics)</td><td>Interés legítimo (art. 6.1.f): mantener la app estable</td><td>Crashlytics 90 días; Analytics agregado 14 meses</td></tr>
<tr><td>Comunicaciones comerciales</td><td>Email</td><td>Enviarte novedades de Klendar (nunca de terceros)</td><td>Consentimiento específico marcado en el registro; revocable en cada email o en el perfil</td><td>Hasta que lo revoques</td></tr>
<tr><td>Soporte</td><td>Email y contenido de tu mensaje</td><td>Atender tus consultas</td><td>Ejecución del contrato / interés legítimo</td><td>1 año desde el cierre</td></tr>
</table>

<h2>3. Destinatarios y encargados del tratamiento</h2>
<p>No vendemos ni cedemos tus datos. Para prestar el servicio usamos proveedores que actúan como encargados del tratamiento con contratos conforme al art. 28 RGPD:</p>
<ul>
  <li><strong>Supabase</strong> (base de datos, autenticación y almacenamiento; servidores en la Unión Europea).</li>
  <li><strong>Google Firebase</strong> (notificaciones push, informes de errores y analítica agregada; Google Ireland Ltd.; transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo).</li>
  <li><strong>Mapbox</strong> (mapas; recibe las coordenadas del área que consultas para pintar el mapa).</li>
  <li>Proveedor de correo transaccional para emails de cuenta.</li>
</ul>
<p>Los <strong>negocios</strong> ven tu nombre mostrado cuando canjeas una oferta o publicas una reseña, y estadísticas agregadas (nunca tu email ni tu ubicación).</p>

<h2>4. Menores</h2>
<p>La edad mínima para usar Klendar es de <strong>14 años</strong>. Los contenidos marcados como "+18" (locales de ocio nocturno, alcohol) solo se muestran a personas que han acreditado ser mayores de 18 años mediante su fecha de nacimiento. Si detectamos una cuenta de un menor de 14 años, la eliminaremos.</p>

<h2>5. Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento en cualquier momento, escribiendo a <a href="mailto:info@klendar.app">info@klendar.app</a> desde el email de tu cuenta. Además, desde la app puedes: editar tu perfil, gestionar permisos de ubicación y notificaciones, y <a href="/eliminar-cuenta/">eliminar tu cuenta</a> por completo. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Seguridad</h2>
<p>Los datos se transmiten cifrados (TLS), las contraseñas se almacenan con hash, el acceso a la base de datos está restringido por políticas de seguridad a nivel de fila (cada persona solo accede a lo suyo) y los proveedores citados cuentan con certificaciones de seguridad reconocidas.</p>

<h2>7. Cambios</h2>
<p>Si cambiamos esta política de forma relevante te lo comunicaremos en la app. La versión vigente está siempre en <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a>.</p>
''')

PAGES['terminos'] = ('Términos de uso', 'Condiciones de uso de la app Klendar para personas usuarias.', f'''
<h2>1. Quiénes somos y qué es Klendar</h2>
<p>Klendar es una plataforma titularidad de {TITULAR} (NIF {NIF}) que permite descubrir ofertas de duración limitada y eventos de negocios locales, guardarlos, valorarlos y canjearlos con un código QR. Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad/">Política de privacidad</a>.</p>

<h2>2. Cuenta</h2>
<ul>
  <li>Debes tener al menos <strong>14 años</strong>. Los contenidos "+18" solo se muestran a mayores de 18.</li>
  <li>Los datos de tu cuenta deben ser veraces. Eres responsable de mantener tu contraseña en secreto.</li>
  <li>Puedes usar la app sin cuenta ("invitado") para ver ofertas; canjear, guardar favoritos y reseñar requiere cuenta.</li>
  <li>Puedes eliminar tu cuenta en cualquier momento desde Perfil o en <a href="/eliminar-cuenta/">klendar.app/eliminar-cuenta</a>.</li>
</ul>

<h2>3. Ofertas y canjeos</h2>
<ul>
  <li>Las ofertas y eventos los publican los negocios, que son los únicos responsables de su contenido, condiciones, disponibilidad y cumplimiento. Klendar no vende productos ni servicios ni cobra por los canjeos.</li>
  <li>Cada código QR es <strong>personal y de un solo uso</strong>, válido 5 minutos desde que lo generas y solo dentro de la ventana de la oferta. Cada persona puede canjear cada oferta una vez, salvo que el negocio indique otra cosa.</li>
  <li>El negocio puede exigir que la persona que canjea sea la titular de la cuenta y que se cumplan las condiciones publicadas (consumo mínimo, aforo, horario).</li>
  <li>Si un negocio no honra una oferta publicada, denúncialo desde la app; podremos suspender al negocio.</li>
</ul>

<h2>4. Reseñas y contenido de usuarios</h2>
<ul>
  <li>Puedes publicar una reseña por negocio (editable). Debe basarse en tu experiencia real y respetar las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Concedes a Klendar una licencia no exclusiva, gratuita y mundial para mostrar tus reseñas en la Plataforma mientras estén publicadas.</li>
  <li>Podemos retirar contenido que incumpla las normas y suspender cuentas reincidentes, con la motivación y vías de recurso previstas en el Reglamento de Servicios Digitales (DSA).</li>
</ul>

<h2>5. Uso permitido</h2>
<p>No está permitido: usar la app para fines ilegales; intentar acceder a datos de otras personas o negocios; manipular canjeos, reseñas o valoraciones; extraer datos de forma automatizada; ni interferir con el funcionamiento del servicio.</p>

<h2>6. Disponibilidad y cambios</h2>
<p>Trabajamos para que Klendar esté disponible siempre, pero no garantizamos ausencia de interrupciones. Podemos modificar o retirar funciones. Si un cambio en estos términos es relevante, te avisaremos en la app con antelación razonable.</p>

<h2>7. Responsabilidad</h2>
<p>En la medida permitida por la ley, Klendar no responde de los daños derivados de ofertas o eventos publicados por los negocios, ni de decisiones tomadas en base a la información de la Plataforma. Nada en estos términos limita los derechos que te reconoce la normativa de consumo.</p>

<h2>8. Legislación y jurisdicción</h2>
<p>Se aplica la legislación española. Como persona consumidora, puedes acudir a los juzgados de tu domicilio y a la plataforma europea de resolución de litigios en línea.</p>
''')

PAGES['negocios'] = ('Condiciones para negocios', 'Condiciones de contratación del servicio Klendar para negocios.', f'''
<p>Estas condiciones regulan la relación entre {TITULAR} (NIF {NIF}, "Klendar") y el negocio que se da de alta en la Plataforma ("el Negocio"). Al enviar la solicitud de alta, la persona que la envía declara tener poder para obligar al Negocio.</p>

<h2>1. Alta y verificación</h2>
<ul>
  <li>El Negocio facilita datos veraces (nombre, categoría, dirección, NIF/CIF, contacto). Klendar verifica el alta antes de hacerlo público y puede rechazarlo motivadamente.</li>
  <li>El Negocio designa un propietario de la cuenta y puede añadir encargados y empleados. El propietario responde de las acciones de su equipo.</li>
</ul>

<h2>2. Servicio</h2>
<p>Klendar permite al Negocio publicar ofertas flash y eventos, posts, su carta, gestionar su ficha, validar canjeos mediante QR y consultar estadísticas. Klendar no interviene en la venta ni cobra a las personas usuarias.</p>

<h2>3. Obligaciones del Negocio</h2>
<ul>
  <li><strong>Honrar las ofertas publicadas</strong> en las condiciones indicadas durante su vigencia y hasta agotar el aforo declarado.</li>
  <li>Publicar solo contenido veraz, lícito, del que tenga derechos (fotos, textos) y conforme a las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Cumplir la normativa aplicable a su actividad, incluida la de publicidad de bebidas alcohólicas (Ley 34/1988 y normativa autonómica) y la protección de menores: los negocios de ocio nocturno o cuyas ofertas incluyan alcohol deben marcarse como "+18".</li>
  <li>Tratar los datos de las personas usuarias que conozca (nombre al canjear) solo para prestar el servicio, sin fines propios ni cesiones.</li>
</ul>

<h2>4. Precio y facturación</h2>
<ul>
  <li>El servicio se presta mediante una <strong>cuota mensual fija</strong> según el plan contratado, sin comisiones por canjeo. Los precios se comunican antes de la contratación y se muestran sin IVA.</li>
  <li>Klendar puede ofrecer periodos gratuitos de lanzamiento. Al terminar, el Negocio elige un plan o su ficha deja de ser pública (sin borrar sus datos).</li>
  <li>Pago por transferencia, domiciliación o tarjeta según se acuerde. Klendar emite factura. En caso de impago, tras un aviso y 15 días, se suspende la publicación.</li>
</ul>

<h2>5. Duración y baja</h2>
<p>Contrato mensual renovable automáticamente. El Negocio puede darse de baja en cualquier momento con efecto al final del periodo pagado, escribiendo a <a href="mailto:info@klendar.app">info@klendar.app</a>. Klendar puede resolver el contrato por incumplimiento grave (no honrar ofertas, contenido ilícito, fraude en canjeos) con comunicación motivada.</p>

<h2>6. Moderación, suspensión y recurso</h2>
<p>Klendar puede retirar contenido o suspender temporalmente la ficha ante denuncias fundadas o incumplimientos. El Negocio recibirá la motivación y podrá recurrir en 15 días a <a href="mailto:info@klendar.app">info@klendar.app</a> (Reglamento (UE) 2022/2065).</p>

<h2>7. Propiedad intelectual y datos</h2>
<p>El Negocio conserva la propiedad de sus contenidos y concede a Klendar licencia para mostrarlos en la Plataforma y en materiales promocionales de Klendar (con posibilidad de oponerse). Klendar y el Negocio actúan como responsables independientes respecto de los datos personales que cada uno trata.</p>

<h2>8. Responsabilidad</h2>
<p>Klendar responde de la prestación diligente del servicio técnico. No responde de la actividad del Negocio ni de reclamaciones de las personas usuarias derivadas de ofertas no honradas, que serán a cargo del Negocio. La responsabilidad máxima de Klendar se limita a las cuotas pagadas en los 12 meses anteriores, salvo dolo o negligencia grave.</p>

<h2>9. Legislación y fuero</h2>
<p>Legislación española. Para negocios, las partes se someten a los juzgados de {DOMICILIO}.</p>
''')

PAGES['cookies'] = ('Política de cookies', 'Uso de cookies en klendar.app.', '''
<p><strong>klendar.app</strong> no utiliza cookies de seguimiento ni publicidad. Solo se utilizan, en su caso, cookies técnicas estrictamente necesarias para el funcionamiento del sitio (por ejemplo, recordar tu preferencia de idioma), que no requieren consentimiento según el art. 22.2 de la LSSI-CE.</p>
<p>Las fuentes tipográficas se cargan desde Google Fonts, lo que implica una petición a servidores de Google con tu dirección IP; si en el futuro se incorporan cookies analíticas o de terceros, actualizaremos esta política y solicitaremos tu consentimiento previo.</p>
<p>La <strong>app móvil</strong> no usa cookies. Usa identificadores de dispositivo para notificaciones y diagnóstico, descritos en la <a href="/privacidad/">Política de privacidad</a>.</p>
''')

PAGES['normas'] = ('Normas de la comunidad', 'Qué se puede y qué no se puede publicar en Klendar, y cómo se modera.', '''
<h2>Para todo el mundo</h2>
<ul>
  <li>Respeto: nada de insultos, acoso, discriminación ni amenazas.</li>
  <li>Verdad: reseñas basadas en experiencias reales; ofertas que se cumplen.</li>
  <li>Legalidad: nada de contenido ilegal, que infrinja derechos de terceros o que promueva actividades ilícitas.</li>
  <li>Sin spam: ni publicidad ajena, ni enlaces engañosos, ni cuentas falsas.</li>
</ul>
<h2>Para negocios</h2>
<ul>
  <li>Publica solo ofertas que vayas a honrar, con condiciones claras (horario, aforo, requisitos).</li>
  <li>Fotos reales de tu local y productos, de las que tengas derechos.</li>
  <li>Alcohol y ocio nocturno: marca el negocio o la oferta como "+18". No se permite incitar al consumo excesivo ni dirigirse a menores.</li>
  <li>No manipules reseñas ni canjeos (cuentas propias, incentivos por valoraciones).</li>
</ul>
<h2>Cómo denunciar</h2>
<p>En cualquier negocio, oferta, reseña o post encontrarás la opción "Denunciar". Indica el motivo y, si quieres, detalles. Recibiremos la denuncia con tu identidad (no se muestra al denunciado).</p>
<h2>Cómo moderamos</h2>
<ul>
  <li>Revisamos las denuncias en un plazo máximo de <strong>72 horas</strong> (24 horas si afectan a menores o contenido claramente ilegal).</li>
  <li>Las medidas posibles son: retirar el contenido, avisar, suspender temporalmente o dar de baja la cuenta o el negocio.</li>
  <li>Quien publicó el contenido recibe una notificación motivada y puede recurrir en 15 días escribiendo a <a href="mailto:info@klendar.app">info@klendar.app</a>. Quien denunció también recibe respuesta.</li>
  <li>Punto de contacto para autoridades y para el Reglamento de Servicios Digitales (DSA): <a href="mailto:info@klendar.app">info@klendar.app</a>.</li>
</ul>
''')

PAGES['eliminar-cuenta'] = ('Eliminar tu cuenta', 'Cómo eliminar tu cuenta de Klendar y qué datos se borran.', '''
<h2>Desde la app (recomendado)</h2>
<ol>
  <li>Abre Klendar e inicia sesión.</li>
  <li>Ve a <strong>Perfil</strong> → sección <strong>Cuenta</strong> → <strong>Eliminar mi cuenta</strong>.</li>
  <li>Confirma. La cuenta se elimina al momento.</li>
</ol>
<h2>Por correo</h2>
<p>Si no puedes acceder a la app, escribe a <a href="mailto:info@klendar.app?subject=Eliminar%20mi%20cuenta">info@klendar.app</a> desde el email de tu cuenta con el asunto "Eliminar mi cuenta". La eliminaremos en un máximo de 30 días y te lo confirmaremos.</p>
<h2>Qué se elimina</h2>
<ul>
  <li>Tu perfil (nombre, email, fecha de nacimiento, foto), tus favoritos, tus preferencias y tokens de notificaciones, tu ubicación y tu historial de canjeos.</li>
  <li>Tus reseñas se eliminan junto con tu cuenta.</li>
</ul>
<h2>Qué se conserva y por qué</h2>
<ul>
  <li>Estadísticas <strong>anónimas</strong> de los negocios (número de canjeos o vistas), que ya no se vinculan a ti.</li>
  <li>Si eres propietario/a de un negocio con cuota facturada, los datos de facturación se conservan el plazo legal (fiscal 4 años, mercantil 6 años). Antes de eliminar la cuenta deberás transferir la propiedad del negocio a otra persona o darlo de baja.</li>
  <li>Denuncias resueltas, 2 años, para cumplir el Reglamento de Servicios Digitales.</li>
</ul>
''')

PAGES['soporte'] = ('Soporte', 'Contacto y ayuda de Klendar.', '''
<h2>Contacto</h2>
<p>Escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a>. Respondemos en un máximo de 2 días laborables.</p>
<h2>Preguntas frecuentes</h2>
<h3>No me deja canjear una oferta</h3>
<p>Comprueba que la oferta sigue activa (tiene una ventana horaria y un aforo), que has iniciado sesión y que no la has canjeado ya: cada oferta se canjea una vez por persona.</p>
<h3>El código QR ha caducado</h3>
<p>Cada código vale 5 minutos. Pulsa "Generar otro código" en la misma pantalla.</p>
<h3>Un negocio no ha respetado su oferta</h3>
<p>Denúncialo desde su ficha (icono de bandera) con el motivo "La oferta no es como se anuncia". Lo revisamos y, si se repite, el negocio queda suspendido.</p>
<h3>No recibo notificaciones</h3>
<p>Revisa Perfil → Ajustes de notificaciones y los permisos de notificaciones del sistema. "Cerca de ti" solo avisa de ofertas flash dentro del radio elegido y como máximo 3 veces al día.</p>
<h3>Soy un negocio y quiero darme de alta</h3>
<p>En la app: Perfil → "¿Tienes un negocio? Dalo de alta". Lo revisamos en 24-48 h. También puedes escribirnos.</p>
''')

for slug, (title, desc, body) in PAGES.items():
    io.open(f'{slug}/index.html', 'w', encoding='utf-8', newline='\n').write(
        HEAD.format(title=title, desc=desc, date=DATE, version=VERSION, todo=TODO if slug in ('aviso-legal','privacidad','terminos','negocios') else '')
        + body + FOOT)
print('ok', list(PAGES))
