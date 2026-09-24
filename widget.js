/* Klendar para tu web.
 *
 * Se pega una línea donde quieras que salga el recuadro:
 *
 *   <script src="https://klendar.app/widget.js" data-klendar="TU-ID"></script>
 *
 * y ahí aparece lo que tengas vivo: ofertas flash y eventos, con su enlace.
 * Se actualiza solo. Opcionales: data-lang="en" y data-limit="3".
 *
 * Por dentro es un iframe, que es lo único que dejan meter casi todos los
 * gestores de webs. El iframe nos dice cuánto mide y aquí se le hace sitio.
 */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var id = me.getAttribute('data-klendar') || me.getAttribute('data-negocio') || me.getAttribute('data-business');
  if (!id) return;
  var lang = me.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  var limit = me.getAttribute('data-limit') || '3';

  var f = document.createElement('iframe');
  f.src = 'https://klendar.app/widget/' + encodeURIComponent(id) + '?lang=' + lang + '&limit=' + encodeURIComponent(limit);
  f.title = 'Klendar';
  f.loading = 'lazy';
  f.setAttribute('scrolling', 'no');
  f.style.cssText = 'width:100%;border:0;display:block;height:260px;max-width:640px;color-scheme:normal';
  me.parentNode.insertBefore(f, me);

  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.klendar !== 'height' || e.source !== f.contentWindow) return;
    var h = parseInt(d.height, 10);
    if (h > 0 && h < 4000) f.style.height = h + 'px';
  });
})();
