// Las palabras del panel del negocio en inglés. El motor está en
// `/assets/i18n.js`; aquí solo está la lista.
'use strict';

const I18N = makeI18N({
    // ── Entrada ───────────────────────────────────────────────────────────
    'Entra en tu panel': 'Sign in to your dashboard',
    'Con la misma cuenta que usas en la app. Si tu negocio todavía no está dado de alta, hazlo desde la app: Perfil → Dar de alta mi negocio.':
      'With the same account you use in the app. If your business is not registered yet, do it from the app: Profile → Register my business.',
    'Email': 'Email',
    'Contraseña': 'Password',
    'Entrar': 'Sign in',
    'He olvidado la contraseña': 'I forgot my password',
    'Correo o contraseña incorrectos.': 'Wrong email or password.',
    'Invalid login credentials': 'Wrong email or password.',
    'Escribe tu correo y vuelve a pulsar.': 'Type your email and press again.',
    'Te hemos enviado un correo para cambiar la contraseña.':
      'We have sent you an email to change your password.',
    'Conexión no segura': 'Connection is not secure',
    'Este panel solo funciona por HTTPS:': 'This dashboard only works over HTTPS:',

    // ── Barra y navegación ────────────────────────────────────────────────
    'negocios': 'business',
    '· negocios': '· business',
    'Negocio': 'Business',
    'Sesión': 'Session',
    'Salir': 'Sign out',
    'Menú': 'Menu',
    '☰ Menú': '☰ Menu',
    'Resumen': 'Overview',
    'Publicaciones': 'Publications',
    'Validar códigos': 'Validate codes',
    'Informe': 'Report',
    'Equipo': 'Team',
    'Ayuda': 'Help',
    'Cargando…': 'Loading…',
    'Nada por aquí.': 'Nothing here.',
    'Reintentar': 'Retry',
    'Cancelar': 'Cancel',
    'Guardar cambios': 'Save changes',
    'Cambios guardados': 'Changes saved',
    'Guardado': 'Saved',
    'Algo ha fallado': 'Something went wrong',
    '← Volver': '← Back',
    'Abrir': 'Open',
    'Editar': 'Edit',
    'Quitar': 'Remove',
    'Borrar': 'Clear',
    'Descargar CSV': 'Download CSV',
    'Exportar CSV': 'Export CSV',
    'Tipo': 'Type',
    'Estado': 'Status',
    'Fecha y hora': 'Date and time',
    'días': 'days',
    '1 año': '1 year',

    // ── Resumen ───────────────────────────────────────────────────────────
    'Cómo va': 'How it is going',
    'Vistas': 'Views',
    'Vistas (30 días)': 'Views (30 days)',
    'Canjeos (30 días)': 'Redemptions (30 days)',
    'Favoritos': 'Favourites',
    'Valoración': 'Rating',
    'Publicaciones activas': 'Active publications',
    'Últimas publicaciones': 'Latest publications',
    'Todavía no has publicado nada.': 'You have not published anything yet.',
    'Nueva oferta relámpago': 'New flash deal',
    'Nuevo evento': 'New event',
    'Validar un código': 'Validate a code',
    'Canjeable con QR durante unas horas': 'Redeemable with a QR code for a few hours',
    'Con fecha, aforo y reserva de plaza': 'With a date, capacity and seat booking',
    'Escribe el código que enseña el cliente': 'Type the code the customer shows you',
    'Ver ficha pública ↗': 'See public page ↗',
    'Tu plan': 'Your plan',
    'sin límite de publicaciones activas': 'no limit on active publications',
    'Para cambiar de plan escribe a': 'To change plan write to',
    'en revisión': 'under review',

    // ── Publicaciones ─────────────────────────────────────────────────────
    '⚡ Nueva oferta': '⚡ New deal',
    '📅 Nuevo evento': '📅 New event',
    'Oferta relámpago': 'Flash deal',
    'Evento': 'Event',
    'Editar publicación': 'Edit publication',
    'Borrar publicación': 'Delete publication',
    'Publicación': 'Publication',
    'Título': 'Title',
    'Título corto y concreto, con el precio dentro.':
      'A short, concrete title with the price in it.',
    'Descripción': 'Description',
    'Condiciones (letra pequeña)': 'Conditions (small print)',
    'Categoría': 'Category',
    'Enlace externo (entradas, reservas…)': 'External link (tickets, bookings…)',
    'Empieza': 'Starts',
    'Termina': 'Ends',
    'Termina (obligatorio)': 'Ends (required)',
    'Termina (opcional)': 'Ends (optional)',
    'Día y hora del evento': 'Date and time of the event',
    'Precio (opcional)': 'Price (optional)',
    'Precio anterior': 'Previous price',
    'Precio fijo': 'Fixed price',
    'Aforo / unidades': 'Capacity / units',
    'vacío = sin límite': 'empty = no limit',
    'Descuento': 'Discount',
    'Sin descuento': 'No discount',
    'Valor del descuento': 'Discount value',
    'Otro (lo escribes tú)': 'Other (you write it)',
    'Elige una opción': 'Choose an option',
    'No lleva alcohol': 'No alcohol',
    'Sí, lleva alcohol': 'Yes, with alcohol',
    '¿El 2x1 incluye bebidas alcohólicas?': 'Does the two-for-one include alcoholic drinks?',
    'Di si el 2x1 incluye bebidas alcohólicas.':
      'Say whether the two-for-one includes alcoholic drinks.',
    'Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.':
      'Add the previous price: the law requires showing it next to the discount.',
    'El precio anterior tiene que ser mayor que el de ahora.':
      'The previous price must be higher than the current one.',
    '¿Cuánto vale el código QR?': 'How long is the QR code valid?',
    'Sin caducidad': 'No expiry',
    'Canjes por persona': 'Redemptions per person',
    'Solo para mayores de 18': 'Over-18s only',
    'Fotos y vídeo': 'Photos and video',
    '+ Añadir foto o vídeo': '+ Add photo or video',
    'Portada': 'Cover',
    'Mover antes': 'Move earlier',
    'Mover después': 'Move later',
    'Esa foto pesa más de 5 MB.': 'That photo is over 5 MB.',
    'Ese vídeo pesa más de 60 MB.': 'That video is over 60 MB.',
    'Publicar ahora (desactívalo para dejarlo en borrador)':
      'Publish now (turn it off to leave it as a draft)',
    'Una oferta relámpago necesita principio y fin.':
      'A flash deal needs a start and an end.',
    'El fin tiene que ser posterior al principio.': 'The end must be after the start.',
    'Has llegado al límite de publicaciones activas de tu plan. Pausa alguna o cambia de plan.':
      'You have reached your plan limit of active publications. Pause one or change plan.',
    'Repetir…': 'Repeat…',
  'Repetir cada semana': 'Repeat every week',
  'Se repiten solas': 'They publish themselves',
  'Cada una se publica sola a su hora. Si la de la semana pasada sigue activa, esa semana se salta: no se apilan.':
    'Each one publishes itself at its time. If last week\u2019s is still live, that week is skipped: they do not stack.',
  '¿Qué días?': 'Which days?',
  '¿A qué hora empieza?': 'What time does it start?',
  '¿Cuánto dura?': 'How long does it last?',
  'De lunes a viernes': 'Monday to Friday',
  'Todos los días': 'Every day',
  'Fines de semana': 'Weekends',
  'Crear la repetición': 'Create the repeat',
  'Se repetirá sola': 'It will repeat on its own',
  'Quitar la repetición': 'Remove the repeat',
  'Dejará de publicarse sola. Lo que ya se publicó se queda como está.':
    'It will stop publishing itself. What is already published stays as it is.',
  'Pausar': 'Pause',
  'Reanudar': 'Resume',
  'Cuándo': 'When',
  'Dura': 'Lasts',
  'Ninguna.': 'None.',
  'Asistentes': 'Attendees',
    'Dar entrada': 'Check in',
    'Todavía no hay nadie apuntado.': 'Nobody has signed up yet.',

    // ── Validar ───────────────────────────────────────────────────────────
    'Código o enlace del QR': 'QR code or link',
    'Validar': 'Validate',
    'Buscar por nombre o código': 'Search by name or code',
    'Últimos validados': 'Recently validated',
    'Todavía no has validado ningún código.': 'You have not validated any code yet.',
    'Ese código no existe.': 'That code does not exist.',
    'Ese código ya se usó.': 'That code was already used.',
    'Ese código no es de tu negocio.': 'That code is not from your business.',
    'El código ha caducado: pide que generen otro.':
      'The code has expired: ask them to generate another one.',
    'Demasiados intentos seguidos. Espera un momento.':
      'Too many tries in a row. Wait a moment.',

    // ── Informe ───────────────────────────────────────────────────────────
    'El periodo en cuatro cifras': 'The period in four numbers',
    'Códigos generados': 'Codes generated',
    'Canjes validados': 'Redemptions validated',
    'De código a canje': 'From code to redemption',
    'Día a día': 'Day by day',
    'Cada barra es un día: la altura son las vistas y la parte de color, los canjes.':
      'Each bar is a day: the height is views and the coloured part, redemptions.',
    'De dónde viene tu gente': 'Where your people come from',
  'menos de 500 m': 'under 500 m',
  '500 m - 1 km': '500 m - 1 km',
  '1 - 2 km': '1 - 2 km',
  '2 - 5 km': '2 - 5 km',
  'más de 5 km': 'over 5 km',
  'Por publicación': 'By publication',
    'No hay publicaciones en este periodo.': 'No publications in this period.',
    'Cada línea es un código validado en el local, con quién lo validó. Sirve de justificante.':
      'Each line is a code validated at the venue, with who validated it. It works as a receipt.',
    'Todavía no se ha validado ningún código en este periodo.':
      'No code has been validated in this period yet.',
    'Validado por': 'Validated by',
    'Plazas libres': 'Places left',
    'A quien ya canjeó no se le avisa.': 'Nobody who already redeemed is told.',

    // ── Equipo ────────────────────────────────────────────────────────────
    'Añadir a alguien': 'Add someone',
    'Añadir a alguien al equipo': 'Add someone to the team',
    'Añadido al equipo': 'Added to the team',
    'Invitaciones pendientes': 'Pending invitations',
    'Invitación guardada': 'Invitation saved',
    'Todavía no tienen cuenta en Klendar. Entran solas al registrarse con ese correo.':
      'They do not have a Klendar account yet. They join automatically when they sign up with that email.',
    'Propietario': 'Owner',
    'Encargado': 'Manager',
    'Empleado': 'Employee',
    'Hacer encargado': 'Make manager',
    'Hacer empleado': 'Make employee',
    'Rol cambiado': 'Role changed',
    'Quitar del equipo': 'Remove from the team',
    'Dejará de poder validar códigos y de ver el panel.':
      'They will no longer be able to validate codes or see the dashboard.',
    'Esa persona ya no está en el equipo.': 'That person is no longer in the team.',
    'Al propietario no se le cambia el rol desde aquí.':
      'The owner’s role cannot be changed from here.',
    'Ese rol no existe.': 'That role does not exist.',
    'No hay ninguna cuenta con ese correo.': 'There is no account with that email.',
    'No tienes permiso para esto. Pídeselo a quien lleve el negocio.':
      'You do not have permission for this. Ask whoever runs the business.',
    '¿Quién puede qué?': 'Who can do what?',
    ': todo; no se le puede cambiar el rol desde aquí.':
      ': everything; their role cannot be changed from here.',
    ': además publica, edita la ficha y lleva el equipo.':
      ': also publishes, edits the profile and manages the team.',
    ': valida códigos QR.': ': validates QR codes.',
    'Fuera del equipo': 'Out of the team',

    // ── Avisos de estado ──────────────────────────────────────────────────
    'Tu negocio está en revisión.': 'Your business is under review.',
    'Tu negocio está rechazado.': 'Your business was rejected.',
    'Tu negocio está verificado.': 'Your business is verified.',
    'Mientras tanto puedes preparar publicaciones en borrador; se verán en cuanto te verifiquemos.':
      'Meanwhile you can prepare draft publications; they go live as soon as we verify you.',
    ': algo que se canjea hoy, con cuenta atrás y aforo («café + tostada 2,50 € hasta mediodía»).':
      ': something redeemed today, with a countdown and a capacity («coffee + toast €2.50 until noon»).',
    ': algo con fecha, que se guarda en la agenda y puede admitir reserva de plaza.':
      ': something with a date, saved in the calendar, which can take seat bookings.',
    'Pide a la persona su código (lo tiene en la app, debajo del QR) y escríbelo aquí. Cada código vale una vez: al validarlo queda marcado y el aforo baja. Si tienes cámara, desde la app es más rápido.':
      'Ask the person for their code (it is in the app, under the QR) and type it here. Each code works once: validating it marks it and the capacity goes down. If you have a camera, the app is quicker.',
    'código(s) se quedaron sin usar.': 'code(s) were left unused.',
    '¿Oferta o evento?': 'Deal or event?',

    // ── Ayuda y textos largos ─────────────────────────────────────────────
    'Qué puedes hacer aquí': 'What you can do here',
    'Este panel hace lo mismo que la app, pero desde el ordenador: publicar ofertas y eventos, ver cómo van, validar códigos en la puerta y llevar el equipo.':
      'This dashboard does the same as the app, but from a computer: publish deals and events, see how they are doing, validate codes at the door and manage the team.',
    'Lo único que se hace solo desde la app es': 'The only things you can do just from the app are',
    'dar de alta el negocio': 'registering the business',
    '(hace falta la ubicación exacta) y': '(it needs the exact location) and',
    'escanear el QR con la cámara': 'scanning the QR code with the camera',
    'Una oferta que funciona': 'A deal that works',
    'Ventana realista: lo que de verdad puedes servir.':
      'A realistic window: what you can actually serve.',
    'Aforo si hay stock limitado; así nadie se lleva un chasco.':
      'Set a capacity if stock is limited; nobody gets a nasty surprise.',
    'Foto propia, luz natural, sin texto encima.':
      'Your own photo, natural light, no text on top.',
    'Un evento que se llena': 'An event that fills up',
    'Publícalo con días de antelación: la gente lo guarda en su agenda.':
      'Publish it days ahead: people save it in their calendar.',
    'Activa la reserva de plaza si quieres saber cuánta gente viene.':
      'Turn on seat booking if you want to know how many people are coming.',
    'Pon el código «sin caducidad» para que valga como entrada.':
      'Set the code to «no expiry» so it works as a ticket.',
    'El día del evento, usa «Asistentes» para dar entrada.':
      'On the day, use «Attendees» to check people in.',
    '¿Algo no cuadra?': 'Something not right?',
    'Escríbenos a': 'Write to us at',
    'y lo miramos.': 'and we will look into it.',
    '¿Cómo funciona?': 'How does it work?',
    'Cómo funciona ↗': 'How it works ↗',
    'Todavía no tienes ningún negocio': 'You do not have a business yet',
    'Si alguien te ha añadido a su equipo, entra con el mismo correo con el que te invitaron.':
      'If someone added you to their team, sign in with the same email they invited.',
});
