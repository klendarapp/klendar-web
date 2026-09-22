# Genera las páginas legales en ES (versión que prevalece) y su traducción
# informativa en EN bajo /en/.
# Ejecutar: python build_legal.py   (desde la raíz de klendar-web)
import io, os

from build_site import head, footer, T, ALT

TODO = {
  'es': '''<p class="todo"><strong>Pendiente de completar antes del lanzamiento:</strong> los datos marcados en <mark class="tbd">amarillo</mark> (titular, NIF, domicilio) dependen de la forma jurídica que se elija. Este texto es un borrador profesional; conviene que lo revise un abogado antes de publicar la app.</p>''',
  'en': '''<p class="todo"><strong>To be completed before launch:</strong> the details highlighted in <mark class="tbd">yellow</mark> (owner, tax ID, address) depend on the legal form chosen. This text is a professional draft and should be reviewed by a lawyer before the app is published.</p>''',
}

COURTESY = '''<p class="notice">This is a courtesy translation provided for information only. In case of any discrepancy, the <a href="{es}">Spanish version</a> prevails.</p>'''

TITULAR = {'es': '<mark class="tbd">[Nombre del titular / razón social]</mark>', 'en': '<mark class="tbd">[Owner / company name]</mark>'}
NIF = {'es': '<mark class="tbd">[NIF/CIF]</mark>', 'en': '<mark class="tbd">[Spanish tax ID (NIF/CIF)]</mark>'}
DOMICILIO = {'es': '<mark class="tbd">[Domicilio completo, España]</mark>', 'en': '<mark class="tbd">[Full address, Spain]</mark>'}
DATE = {'es': '17 de septiembre de 2026', 'en': '17 September 2026'}
VERSION = '2026-09'
META = {'es': 'Última actualización: {date} · Versión {v}', 'en': 'Last updated: {date} · Version {v}'}

# slug ES → (título, descripción, cuerpo)
ES = {}
# slug ES → (slug EN, título, descripción, cuerpo)
EN = {}

# ── Aviso legal ─────────────────────────────────────────────────────────────
ES['aviso-legal'] = ('Aviso legal', 'Identificación del titular de klendar.app y de la app Klendar (LSSI-CE).', f'''
<h2>1. Identificación del titular</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el sitio web <strong>klendar.app</strong> y la aplicación móvil <strong>Klendar</strong> (en adelante, "la Plataforma") son titularidad de:</p>
<ul>
  <li>Titular: {TITULAR['es']}</li>
  <li>NIF/CIF: {NIF['es']}</li>
  <li>Domicilio: {DOMICILIO['es']}</li>
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

EN['aviso-legal'] = ('legal-notice', 'Legal notice', 'Who owns klendar.app and the Klendar app (Spanish LSSI-CE).', f'''
<h2>1. Owner</h2>
<p>In accordance with article 10 of Spanish Law 34/2002 of 11 July on Information Society Services and Electronic Commerce (LSSI-CE), the website <strong>klendar.app</strong> and the mobile app <strong>Klendar</strong> (together, "the Platform") are owned by:</p>
<ul>
  <li>Owner: {TITULAR['en']}</li>
  <li>Tax ID: {NIF['en']}</li>
  <li>Address: {DOMICILIO['en']}</li>
  <li>Email: <a href="mailto:info@klendar.app">info@klendar.app</a></li>
</ul>
<h2>2. Purpose</h2>
<p>Klendar is a platform that lets local businesses publish time-limited deals ("flash deals") and events, and lets users discover them by proximity, save them, review them and redeem them with a QR code. Klendar acts as a technical intermediary: deals and events are published and honoured by each business under its sole responsibility.</p>
<h2>3. Terms of use</h2>
<p>Access to and use of the Platform are governed by the <a href="/en/terms/">Terms of use</a> and, for businesses, by the <a href="/en/business-terms/">Business terms</a>. How we process personal data is described in the <a href="/en/privacy/">Privacy policy</a>.</p>
<h2>4. Intellectual and industrial property</h2>
<p>The Klendar brand, logo, the design of the Platform and its code belong to the owner or its licensors. Content published by businesses (text, images, menus) is the responsibility and property of whoever publishes it, who grants Klendar a non-exclusive licence to display it on the Platform.</p>
<h2>5. Disclaimer</h2>
<p>The owner does not guarantee uninterrupted availability of the Platform and is not liable for the accuracy, validity or fulfilment of deals published by businesses, without prejudice to the reporting and moderation mechanisms described in the <a href="/en/community-guidelines/">Community guidelines</a>.</p>
<h2>6. Governing law</h2>
<p>These terms are governed by Spanish law. For any dispute, the parties submit to the courts of the consumer's place of residence where consumer law so provides, or otherwise to the courts of the owner's registered address.</p>
''')

# ── Privacidad ──────────────────────────────────────────────────────────────
ES['privacidad'] = ('Política de privacidad', 'Cómo trata Klendar tus datos personales (RGPD y LOPDGDD).', f'''
<p>Esta política explica qué datos personales tratamos en la app Klendar y en klendar.app, para qué, con qué base legal, cuánto tiempo los conservamos y qué derechos tienes. Cumple el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).</p>

<h2>1. Responsable del tratamiento</h2>
<ul>
  <li>Responsable: {TITULAR['es']} · NIF/CIF: {NIF['es']}</li>
  <li>Domicilio: {DOMICILIO['es']}</li>
  <li>Contacto para protección de datos: <a href="mailto:info@klendar.app">info@klendar.app</a></li>
</ul>

<h2>2. Qué datos tratamos y para qué</h2>
<table>
<tr><th>Tratamiento</th><th>Datos</th><th>Finalidad</th><th>Base jurídica</th><th>Conservación</th></tr>
<tr><td>Cuenta de usuario</td><td>Email, nombre mostrado, contraseña (cifrada), fecha de nacimiento, idioma, foto de perfil (opcional), fecha y versión de aceptación de los términos</td><td>Crear y gestionar tu cuenta; verificar la edad mínima (14 años) y el acceso a contenidos para mayores de 18</td><td>Ejecución del contrato (art. 6.1.b RGPD); obligación legal para la edad (art. 6.1.c; art. 7 LOPDGDD)</td><td>Mientras la cuenta esté activa. Al eliminarla, se borra en 30 días salvo obligación legal de conservación</td></tr>
<tr><td>Inicio de sesión con Google / Apple</td><td>Identificador del proveedor, email, nombre</td><td>Autenticación sin contraseña</td><td>Ejecución del contrato</td><td>Igual que la cuenta</td></tr>
<tr><td>Ubicación</td><td>Coordenadas aproximadas o precisas del dispositivo (según el permiso que concedas) o la ciudad que elijas manualmente</td><td>Ordenar el feed y el mapa por cercanía; "ofertas cerca de ti" si activas esa opción</td><td>Consentimiento (art. 6.1.a), revocable en los ajustes del dispositivo y de la app</td><td>No se guarda un historial. Solo se conserva la última ubicación conocida (para "cerca de ti") y se descarta a los 7 días</td></tr>
<tr><td>Favoritos, reseñas, canjeos</td><td>Negocios guardados, valoraciones y comentarios, códigos de canjeo y su estado, vistas de ofertas</td><td>Prestar el servicio: tus favoritos, tus reseñas públicas, el historial de canjeos y estadísticas agregadas para los negocios</td><td>Ejecución del contrato</td><td>Mientras exista la cuenta. Las reseñas se muestran con tu nombre mostrado</td></tr>
<tr><td>Notificaciones push</td><td>Token del dispositivo, preferencias (favoritos, cercanía, horas de silencio)</td><td>Avisarte de novedades de tus favoritos y ofertas cercanas</td><td>Consentimiento, revocable en cualquier momento</td><td>Hasta que revoques el permiso, cierres sesión o elimines la cuenta</td></tr>
<tr><td>Cuenta de negocio</td><td>Datos del negocio (nombre, dirección, NIF/CIF, teléfono, email de contacto, horarios), miembros del equipo (email y rol), plan contratado y pagos</td><td>Dar de alta, verificar y gestionar el negocio; facturar la cuota</td><td>Ejecución del contrato; obligación legal (facturación)</td><td>Durante la relación y después el plazo legal (fiscal: 4 años; mercantil: 6 años)</td></tr>
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
  <li><strong>Cloudflare</strong> (alojamiento y red de entrega de klendar.app; procesa la dirección IP de las visitas para servir la web y protegerla).</li>
  <li>Proveedor de correo transaccional para emails de cuenta.</li>
</ul>
<p>Los <strong>negocios</strong> ven tu nombre mostrado cuando canjeas una oferta o publicas una reseña, y estadísticas agregadas (nunca tu email ni tu ubicación).</p>

<h2>4. Menores</h2>
<p>La edad mínima para usar Klendar es de <strong>14 años</strong>. Los contenidos marcados como "+18" (locales de ocio nocturno, alcohol) solo se muestran a personas que han acreditado ser mayores de 18 años mediante su fecha de nacimiento. Si detectamos una cuenta de un menor de 14 años, la eliminaremos.</p>

<h2>5. Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento en cualquier momento, escribiendo a <a href="mailto:info@klendar.app">info@klendar.app</a> desde el email de tu cuenta. Además, desde la app (Perfil → Ajustes → Privacidad y datos) puedes: ver qué has consentido y cuándo, retirar por separado el consentimiento de ubicación, notificaciones push y comunicaciones comerciales, descargar todos tus datos en un archivo (acceso y portabilidad), y <a href="/eliminar-cuenta/">eliminar tu cuenta</a> por completo. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Seguridad</h2>
<p>Los datos se transmiten cifrados (TLS), las contraseñas se almacenan con hash, el acceso a la base de datos está restringido por políticas de seguridad a nivel de fila (cada persona solo accede a lo suyo) y los proveedores citados cuentan con certificaciones de seguridad reconocidas.</p>

<h2>7. Cambios</h2>
<p>Si cambiamos esta política de forma relevante te lo comunicaremos en la app. La versión vigente está siempre en <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a>.</p>
''')

EN['privacidad'] = ('privacy', 'Privacy policy', 'How Klendar handles your personal data (GDPR).', f'''
<p>This policy explains which personal data we process in the Klendar app and on klendar.app, why, on what legal basis, for how long, and what your rights are. It complies with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).</p>

<h2>1. Data controller</h2>
<ul>
  <li>Controller: {TITULAR['en']} · Tax ID: {NIF['en']}</li>
  <li>Address: {DOMICILIO['en']}</li>
  <li>Data protection contact: <a href="mailto:info@klendar.app">info@klendar.app</a></li>
</ul>

<h2>2. What we process and why</h2>
<table>
<tr><th>Processing</th><th>Data</th><th>Purpose</th><th>Legal basis</th><th>Retention</th></tr>
<tr><td>User account</td><td>Email, display name, password (hashed), date of birth, language, profile photo (optional), date and version of the terms you accepted</td><td>Create and manage your account; verify the minimum age (14) and access to 18+ content</td><td>Performance of a contract (art. 6(1)(b) GDPR); legal obligation for age (art. 6(1)(c); art. 7 LOPDGDD)</td><td>While the account is active. When you delete it, data is erased within 30 days unless we must keep it by law</td></tr>
<tr><td>Sign in with Google / Apple</td><td>Provider identifier, email, name</td><td>Passwordless authentication</td><td>Performance of a contract</td><td>Same as the account</td></tr>
<tr><td>Location</td><td>Approximate or precise device coordinates (depending on the permission you grant) or the city you pick manually</td><td>Sort the feed and the map by distance; "deals near you" if you enable it</td><td>Consent (art. 6(1)(a)), revocable in your device and app settings</td><td>No history is kept. Only the last known location is stored (for "near you") and discarded after 7 days</td></tr>
<tr><td>Favourites, reviews, redemptions</td><td>Saved businesses, ratings and comments, redemption codes and their status, deal views</td><td>Provide the service: your favourites, your public reviews, your redemption history and aggregate statistics for businesses</td><td>Performance of a contract</td><td>While the account exists. Reviews are shown with your display name</td></tr>
<tr><td>Push notifications</td><td>Device token, preferences (favourites, nearby, quiet hours)</td><td>Alert you about news from your favourites and nearby deals</td><td>Consent, revocable at any time</td><td>Until you revoke the permission, sign out or delete the account</td></tr>
<tr><td>Business account</td><td>Business details (name, address, tax ID, phone, contact email, opening hours), team members (email and role), plan and payments</td><td>Register, verify and manage the business; invoice the subscription</td><td>Performance of a contract; legal obligation (invoicing)</td><td>During the relationship and afterwards for the statutory period (tax: 4 years; commercial: 6 years)</td></tr>
<tr><td>Content reports</td><td>Identity of the reporter, reason, reported content</td><td>Moderate the Platform (Regulation (EU) 2022/2065, DSA)</td><td>Legal obligation and legitimate interest</td><td>2 years from resolution</td></tr>
<tr><td>Diagnostics and performance</td><td>Installation identifier, device model and OS, crash reports, aggregate screen usage</td><td>Detect failures and improve the app (Firebase Crashlytics and Analytics)</td><td>Legitimate interest (art. 6(1)(f)): keeping the app stable</td><td>Crashlytics 90 days; aggregate Analytics 14 months</td></tr>
<tr><td>Marketing emails</td><td>Email</td><td>Send you Klendar news (never from third parties)</td><td>Specific consent ticked at sign-up; revocable in every email or in your profile</td><td>Until you withdraw it</td></tr>
<tr><td>Support</td><td>Email and the content of your message</td><td>Answer your enquiries</td><td>Performance of a contract / legitimate interest</td><td>1 year after closure</td></tr>
</table>

<h2>3. Recipients and processors</h2>
<p>We never sell or share your data. To provide the service we rely on providers acting as processors under contracts compliant with art. 28 GDPR:</p>
<ul>
  <li><strong>Supabase</strong> (database, authentication and storage; servers in the European Union).</li>
  <li><strong>Google Firebase</strong> (push notifications, crash reports and aggregate analytics; Google Ireland Ltd.; international transfers covered by the EU-US Data Privacy Framework and standard contractual clauses).</li>
  <li><strong>Mapbox</strong> (maps; receives the coordinates of the area you look at in order to render the map).</li>
  <li><strong>Cloudflare</strong> (hosting and content delivery for klendar.app; processes visitors' IP addresses to serve and protect the website).</li>
  <li>A transactional email provider for account emails.</li>
</ul>
<p><strong>Businesses</strong> see your display name when you redeem a deal or post a review, plus aggregate statistics (never your email or your location).</p>

<h2>4. Minors</h2>
<p>The minimum age to use Klendar is <strong>14</strong>. Content marked "18+" (nightlife venues, alcohol) is only shown to people who have confirmed they are over 18 through their date of birth. If we detect an account belonging to someone under 14, we will delete it.</p>

<h2>5. Your rights</h2>
<p>You may exercise your rights of access, rectification, erasure, objection, restriction and portability, and withdraw consent at any time, by writing to <a href="mailto:info@klendar.app">info@klendar.app</a> from your account email. From the app (Profile → Settings → Privacy and data) you can also see what you have consented to and when, withdraw location, push and marketing consent separately, download all your data as a file (access and portability), and <a href="/en/delete-account/">delete your account</a> entirely. If you believe we have not handled your request properly, you may lodge a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Security</h2>
<p>Data is transmitted encrypted (TLS), passwords are stored hashed, database access is restricted by row-level security policies (each person only reaches their own data), and the providers listed hold recognised security certifications.</p>

<h2>7. Changes</h2>
<p>If we change this policy in a material way we will let you know in the app. The current version is always at <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a> (Spanish, governing) and <a href="https://klendar.app/en/privacy/">klendar.app/en/privacy</a>.</p>
''')

# ── Términos de uso ─────────────────────────────────────────────────────────
ES['terminos'] = ('Términos de uso', 'Condiciones de uso de la app Klendar para personas usuarias.', f'''
<h2>1. Quiénes somos y qué es Klendar</h2>
<p>Klendar es una plataforma titularidad de {TITULAR['es']} (NIF {NIF['es']}) que permite descubrir ofertas de duración limitada y eventos de negocios locales, guardarlos, valorarlos y canjearlos con un código QR. Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad/">Política de privacidad</a>.</p>

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

EN['terminos'] = ('terms', 'Terms of use', 'Terms of use of the Klendar app for users.', f'''
<h2>1. Who we are and what Klendar is</h2>
<p>Klendar is a platform owned by {TITULAR['en']} (tax ID {NIF['en']}) that lets you discover time-limited deals and events from local businesses, save them, review them and redeem them with a QR code. By creating an account or using the app you accept these terms and the <a href="/en/privacy/">Privacy policy</a>.</p>

<h2>2. Account</h2>
<ul>
  <li>You must be at least <strong>14 years old</strong>. "18+" content is only shown to people over 18.</li>
  <li>Your account details must be accurate. You are responsible for keeping your password secret.</li>
  <li>You can use the app without an account ("guest") to browse deals; redeeming, saving favourites and reviewing require an account.</li>
  <li>You can delete your account at any time from Profile or at <a href="/en/delete-account/">klendar.app/en/delete-account</a>.</li>
</ul>

<h2>3. Deals and redemptions</h2>
<ul>
  <li>Deals and events are published by businesses, which are solely responsible for their content, conditions, availability and fulfilment. Klendar does not sell products or services and does not charge for redemptions.</li>
  <li>Each QR code is <strong>personal and single-use</strong>, valid for 5 minutes after you generate it and only within the deal's time window. Each person may redeem each deal once, unless the business states otherwise.</li>
  <li>The business may require that the person redeeming is the account holder and that the published conditions are met (minimum spend, capacity, opening hours).</li>
  <li>If a business does not honour a published deal, report it from the app; we may suspend the business.</li>
</ul>

<h2>4. Reviews and user content</h2>
<ul>
  <li>You may post one review per business (editable). It must be based on your real experience and follow the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>You grant Klendar a non-exclusive, royalty-free, worldwide licence to display your reviews on the Platform while they are published.</li>
  <li>We may remove content that breaches the guidelines and suspend repeat offenders, with the statement of reasons and appeal routes provided by the Digital Services Act (DSA).</li>
</ul>

<h2>5. Acceptable use</h2>
<p>You may not: use the app for unlawful purposes; attempt to access other people's or businesses' data; manipulate redemptions, reviews or ratings; scrape data automatically; or interfere with the operation of the service.</p>

<h2>6. Availability and changes</h2>
<p>We work to keep Klendar available at all times but cannot guarantee it will be free of interruptions. We may change or withdraw features. If a change to these terms is material, we will notify you in the app with reasonable notice.</p>

<h2>7. Liability</h2>
<p>To the extent permitted by law, Klendar is not liable for damages arising from deals or events published by businesses, or from decisions made on the basis of information on the Platform. Nothing in these terms limits the rights granted to you by consumer law.</p>

<h2>8. Governing law and jurisdiction</h2>
<p>Spanish law applies. As a consumer, you may bring claims before the courts of your place of residence and use the European online dispute resolution platform.</p>
''')

# ── Condiciones para negocios ───────────────────────────────────────────────
ES['negocios'] = ('Condiciones para negocios', 'Condiciones de contratación del servicio Klendar para negocios.', f'''
<p>Estas condiciones regulan la relación entre {TITULAR['es']} (NIF {NIF['es']}, "Klendar") y el negocio que se da de alta en la Plataforma ("el Negocio"). Al enviar la solicitud de alta, la persona que la envía declara tener poder para obligar al Negocio.</p>

<h2>1. Alta y verificación</h2>
<ul>
  <li>El Negocio facilita datos veraces (nombre, categoría, dirección, NIF/CIF, contacto). Klendar verifica el alta antes de hacerlo público y puede rechazarlo motivadamente.</li>
  <li>El Negocio designa un propietario de la cuenta y puede añadir encargados y empleados. El propietario responde de las acciones de su equipo.</li>
</ul>

<h2>2. Servicio</h2>
<p>Klendar permite al Negocio publicar ofertas flash y eventos, posts, su carta y horarios, gestionar su ficha, validar canjeos mediante QR y consultar estadísticas. Klendar no interviene en la venta ni cobra a las personas usuarias.</p>

<h2>3. Obligaciones del Negocio</h2>
<ul>
  <li><strong>Honrar las ofertas publicadas</strong> en las condiciones indicadas durante su vigencia y hasta agotar el aforo declarado.</li>
  <li>Publicar solo contenido veraz, lícito, del que tenga derechos (fotos, textos) y conforme a las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Cumplir la normativa aplicable a su actividad, incluida la de publicidad de bebidas alcohólicas (Ley 34/1988 y normativa autonómica) y la protección de menores: los negocios de ocio nocturno o cuyas ofertas incluyan alcohol deben marcarse como "+18".</li>
  <li>Tratar los datos de las personas usuarias que conozca (nombre al canjear) solo para prestar el servicio, sin fines propios ni cesiones.</li>
</ul>

<h2>4. Planes, precio y facturación</h2>
<ul>
  <li>Klendar ofrece un <strong>plan gratuito</strong> con un número limitado de publicaciones activas a la vez y <strong>planes de pago</strong> con más capacidad y funciones, mediante una <strong>cuota mensual fija</strong> sin comisiones por canjeo. Los precios y límites de cada plan se comunican antes de la contratación y se muestran sin IVA.</li>
  <li>Al darse de alta, el Negocio disfruta de un <strong>periodo de prueba gratuito</strong> del plan superior. Al terminar, pasa automáticamente al plan gratuito salvo que contrate uno de pago; sus publicaciones en curso no se borran.</li>
  <li>Pago por transferencia, domiciliación o tarjeta según se acuerde. Klendar emite factura. En caso de impago, tras un aviso y 15 días, el Negocio vuelve al plan gratuito.</li>
</ul>

<h2>5. Duración y baja</h2>
<p>Los planes de pago son mensuales y se renuevan automáticamente. El Negocio puede darse de baja en cualquier momento con efecto al final del periodo pagado, escribiendo a <a href="mailto:info@klendar.app">info@klendar.app</a>. Klendar puede resolver el contrato por incumplimiento grave (no honrar ofertas, contenido ilícito, fraude en canjeos) con comunicación motivada.</p>

<h2>6. Moderación, suspensión y recurso</h2>
<p>Klendar puede retirar contenido o suspender temporalmente la ficha ante denuncias fundadas o incumplimientos. El Negocio recibirá la motivación y podrá recurrir en 15 días a <a href="mailto:info@klendar.app">info@klendar.app</a> (Reglamento (UE) 2022/2065).</p>

<h2>7. Propiedad intelectual y datos</h2>
<p>El Negocio conserva la propiedad de sus contenidos y concede a Klendar licencia para mostrarlos en la Plataforma y en materiales promocionales de Klendar (con posibilidad de oponerse). Klendar y el Negocio actúan como responsables independientes respecto de los datos personales que cada uno trata.</p>

<h2>8. Responsabilidad</h2>
<p>Klendar responde de la prestación diligente del servicio técnico. No responde de la actividad del Negocio ni de reclamaciones de las personas usuarias derivadas de ofertas no honradas, que serán a cargo del Negocio. La responsabilidad máxima de Klendar se limita a las cuotas pagadas en los 12 meses anteriores, salvo dolo o negligencia grave.</p>

<h2>9. Legislación y fuero</h2>
<p>Legislación española. Para negocios, las partes se someten a los juzgados de {DOMICILIO['es']}.</p>
''')

EN['negocios'] = ('business-terms', 'Business terms', 'Terms of service of Klendar for businesses.', f'''
<p>These terms govern the relationship between {TITULAR['en']} (tax ID {NIF['en']}, "Klendar") and the business that registers on the Platform ("the Business"). By submitting the registration, the person submitting it declares they are authorised to bind the Business.</p>

<h2>1. Registration and verification</h2>
<ul>
  <li>The Business provides accurate details (name, category, address, tax ID, contact). Klendar verifies the registration before making it public and may reject it with reasons.</li>
  <li>The Business designates an account owner and may add managers and staff. The owner is responsible for the actions of their team.</li>
</ul>

<h2>2. Service</h2>
<p>Klendar lets the Business publish flash deals and events, posts, its menu and opening hours, manage its profile, validate redemptions via QR and view statistics. Klendar does not take part in the sale and does not charge users.</p>

<h2>3. Obligations of the Business</h2>
<ul>
  <li><strong>Honour published deals</strong> under the stated conditions for as long as they are valid and until the declared capacity runs out.</li>
  <li>Publish only accurate, lawful content it holds the rights to (photos, text), in line with the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>Comply with the rules applicable to its activity, including those on advertising alcoholic beverages (Spanish Law 34/1988 and regional regulations) and the protection of minors: nightlife venues, or deals that include alcohol, must be marked "18+".</li>
  <li>Use the user data it learns (name on redemption) only to provide the service, with no purposes of its own and no disclosure.</li>
</ul>

<h2>4. Plans, pricing and invoicing</h2>
<ul>
  <li>Klendar offers a <strong>free plan</strong> with a limited number of simultaneously active posts and <strong>paid plans</strong> with more capacity and features, billed as a <strong>flat monthly fee</strong> with no commission on redemptions. Prices and limits of each plan are communicated before subscribing and are shown excluding VAT.</li>
  <li>On registration, the Business enjoys a <strong>free trial</strong> of the top plan. When it ends, the Business automatically moves to the free plan unless it subscribes to a paid one; its ongoing posts are not deleted.</li>
  <li>Payment by bank transfer, direct debit or card as agreed. Klendar issues an invoice. In case of non-payment, after a reminder and 15 days, the Business reverts to the free plan.</li>
</ul>

<h2>5. Term and termination</h2>
<p>Paid plans are monthly and renew automatically. The Business may cancel at any time, effective at the end of the paid period, by writing to <a href="mailto:info@klendar.app">info@klendar.app</a>. Klendar may terminate the contract for serious breach (not honouring deals, unlawful content, redemption fraud) with a reasoned notice.</p>

<h2>6. Moderation, suspension and appeal</h2>
<p>Klendar may remove content or temporarily suspend the profile in response to substantiated reports or breaches. The Business will receive the reasons and may appeal within 15 days to <a href="mailto:info@klendar.app">info@klendar.app</a> (Regulation (EU) 2022/2065).</p>

<h2>7. Intellectual property and data</h2>
<p>The Business retains ownership of its content and grants Klendar a licence to display it on the Platform and in Klendar's promotional materials (with the option to object). Klendar and the Business act as independent controllers with regard to the personal data each of them processes.</p>

<h2>8. Liability</h2>
<p>Klendar is responsible for diligently providing the technical service. It is not liable for the Business's activity or for users' claims arising from deals not honoured, which are borne by the Business. Klendar's maximum liability is limited to the fees paid in the preceding 12 months, except in cases of wilful misconduct or gross negligence.</p>

<h2>9. Governing law and jurisdiction</h2>
<p>Spanish law. For businesses, the parties submit to the courts of {DOMICILIO['en']}.</p>
''')

# ── Cookies ─────────────────────────────────────────────────────────────────
ES['cookies'] = ('Política de cookies', 'Uso de cookies en klendar.app.', '''
<p><strong>klendar.app</strong> no utiliza cookies de seguimiento ni publicidad. Solo se utilizan, en su caso, cookies técnicas estrictamente necesarias para el funcionamiento del sitio y el almacenamiento local de tu preferencia de idioma, que no requieren consentimiento según el art. 22.2 de la LSSI-CE.</p>
<p>Las fuentes tipográficas se cargan desde Google Fonts, lo que implica una petición a servidores de Google con tu dirección IP; si en el futuro se incorporan cookies analíticas o de terceros, actualizaremos esta política y solicitaremos tu consentimiento previo.</p>
<p>La <strong>app móvil</strong> no usa cookies. Usa identificadores de dispositivo para notificaciones y diagnóstico, descritos en la <a href="/privacidad/">Política de privacidad</a>.</p>
''')

EN['cookies'] = ('cookies', 'Cookie policy', 'Use of cookies on klendar.app.', '''
<p><strong>klendar.app</strong> does not use tracking or advertising cookies. Only strictly necessary technical cookies, if any, and local storage of your language preference are used, which do not require consent under art. 22.2 of the Spanish LSSI-CE.</p>
<p>Fonts are loaded from Google Fonts, which involves a request to Google's servers including your IP address; if analytics or third-party cookies are added in the future, we will update this policy and ask for your prior consent.</p>
<p>The <strong>mobile app</strong> does not use cookies. It uses device identifiers for notifications and diagnostics, described in the <a href="/en/privacy/">Privacy policy</a>.</p>
''')

# ── Normas de la comunidad ──────────────────────────────────────────────────
ES['normas'] = ('Normas de la comunidad', 'Qué se puede y qué no se puede publicar en Klendar, y cómo se modera.', '''
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
  <li>Alcohol y ocio nocturno: marca el negocio o la oferta como "+18". No se permite incitar al consumo excesivo ni dirigirse a menores (Ley 34/1988). Las publicaciones que mencionan bebidas alcohólicas se marcan +18 automáticamente y se revisan antes de publicarse.</li>
  <li>No se admite publicidad de tabaco, productos de vapeo ni juegos de azar o apuestas.</li>
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

EN['normas'] = ('community-guidelines', 'Community guidelines', 'What you can and cannot post on Klendar, and how we moderate.', '''
<h2>For everyone</h2>
<ul>
  <li>Respect: no insults, harassment, discrimination or threats.</li>
  <li>Honesty: reviews based on real experiences; deals that are honoured.</li>
  <li>Legality: no unlawful content, nothing that infringes third-party rights or promotes illegal activities.</li>
  <li>No spam: no third-party advertising, misleading links or fake accounts.</li>
</ul>
<h2>For businesses</h2>
<ul>
  <li>Only publish deals you will honour, with clear conditions (hours, capacity, requirements).</li>
  <li>Real photos of your venue and products that you hold the rights to.</li>
  <li>Alcohol and nightlife: mark the business or the deal as "18+". Encouraging excessive drinking or targeting minors is not allowed (Spanish Law 34/1988). Posts that mention alcoholic drinks are marked 18+ automatically and reviewed before going live.</li>
  <li>Advertising of tobacco, vaping products, gambling or betting is not accepted.</li>
  <li>Do not manipulate reviews or redemptions (own accounts, incentives for ratings).</li>
</ul>
<h2>How to report</h2>
<p>On any business, deal, review or post you will find the "Report" option. State the reason and, if you wish, details. We receive the report with your identity (it is not shown to the reported party).</p>
<h2>How we moderate</h2>
<ul>
  <li>We review reports within <strong>72 hours</strong> at most (24 hours if they involve minors or clearly illegal content).</li>
  <li>Possible measures: remove the content, issue a warning, temporarily suspend, or close the account or business.</li>
  <li>Whoever posted the content receives a reasoned notification and may appeal within 15 days by writing to <a href="mailto:info@klendar.app">info@klendar.app</a>. The reporter also gets a reply.</li>
  <li>Point of contact for authorities and for the Digital Services Act (DSA): <a href="mailto:info@klendar.app">info@klendar.app</a>.</li>
</ul>
''')

# ── Eliminar cuenta ─────────────────────────────────────────────────────────
ES['eliminar-cuenta'] = ('Eliminar tu cuenta', 'Cómo eliminar tu cuenta de Klendar y qué datos se borran.', '''
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

EN['eliminar-cuenta'] = ('delete-account', 'Delete your account', 'How to delete your Klendar account and what data is erased.', '''
<h2>From the app (recommended)</h2>
<ol>
  <li>Open Klendar and sign in.</li>
  <li>Go to <strong>Profile</strong> → <strong>Account</strong> section → <strong>Delete my account</strong>.</li>
  <li>Confirm. The account is deleted immediately.</li>
</ol>
<h2>By email</h2>
<p>If you cannot access the app, write to <a href="mailto:info@klendar.app?subject=Delete%20my%20account">info@klendar.app</a> from your account email with the subject "Delete my account". We will delete it within 30 days at most and confirm it to you.</p>
<h2>What is deleted</h2>
<ul>
  <li>Your profile (name, email, date of birth, photo), your favourites, your preferences and notification tokens, your location and your redemption history.</li>
  <li>Your reviews are deleted together with your account.</li>
</ul>
<h2>What is kept and why</h2>
<ul>
  <li><strong>Anonymous</strong> business statistics (number of redemptions or views), no longer linked to you.</li>
  <li>If you own a business with invoiced fees, invoicing data is kept for the statutory period (tax 4 years, commercial 6 years). Before deleting the account you must transfer ownership of the business to someone else or close it.</li>
  <li>Resolved reports, 2 years, to comply with the Digital Services Act.</li>
</ul>
''')

# ── Soporte (ES; la versión EN vive en build_site.py como /en/support/) ─────
ES['soporte'] = ('Soporte', 'Contacto y ayuda de Klendar.', '''
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

LEGAL_SLUGS = ('aviso-legal', 'privacidad', 'terminos', 'negocios')


def render(lang, path, title, desc, body, es_path=None):
    t = T[lang]
    todo = TODO[lang] if (es_path or path).strip('/') in LEGAL_SLUGS else ''
    courtesy = COURTESY.format(es=es_path) if lang == 'en' else ''
    meta = META[lang].format(date=DATE[lang], v=VERSION)
    return (head(t, path, f'{title} · Klendar', desc)
            + '<main class="doc">\n<h1>' + title + '</h1>\n'
            + f'<div class="meta">{meta}</div>\n' + courtesy + todo + '\n'
            + body + '\n</main>\n' + footer(t))


if __name__ == '__main__':
    for slug, (title, desc, body) in ES.items():
        io.open(f'{slug}/index.html', 'w', encoding='utf-8', newline='\n').write(render('es', f'/{slug}/', title, desc, body))
    for es_slug, (en_slug, title, desc, body) in EN.items():
        assert ALT[f'/{es_slug}/'] == f'/en/{en_slug}/', es_slug
        os.makedirs(f'en/{en_slug}', exist_ok=True)
        io.open(f'en/{en_slug}/index.html', 'w', encoding='utf-8', newline='\n').write(render('en', f'/en/{en_slug}/', title, desc, body, es_path=f'/{es_slug}/'))
    print('ok', list(ES), [v[0] for v in EN.values()])
