// «Avisar de esta respuesta» (13-11, política de contenido generado por IA de Google Play; como
// la app, `lib/features/ai_report/ai_report.dart`). Junto a cada texto que escribe la IA (el
// asistente, las ayudas del panel, «Rellenar desde una foto, un enlace o un texto» y la
// traducción), una bandera discreta en tinta que abre un diálogo: Ofensiva · Incorrecta · Otro,
// una nota opcional y «Enviar aviso»; después, «Gracias, lo revisaremos».
//
// Se guarda con la RPC `report_ai_response` (migración 20261281600000_aviso_respuesta_ia de la
// app) y le llega a administración en la bandeja. Quien lo usa pasa `enviar(args)`, que hace la
// llamada con su sesión (o sin ella: la traducción se usa sin cuenta). Si la base aún no tiene la
// función, dice «No se ha podido enviar» y no rompe nada más.
//
//   KlendarAvisoIA.boton({ use, texto, enviar })  → <button> listo para poner
//   KlendarAvisoIA.abre({ use, texto, enviar })   → abre el diálogo
//
// Trae sus textos en los 8 idiomas y va marcado `translate="no"` (no lo toca assets/i18n.js).
(function () {
  'use strict';
  if (window.KlendarAvisoIA) return;

  var T = {
    es: { accion: 'Avisar de esta respuesta', cuerpo: 'La ha escrito una IA. Dinos qué le pasa y la revisaremos.', ofensiva: 'Ofensiva', incorrecta: 'Incorrecta', otro: 'Otro', nota: 'Algo más (opcional)', enviar: 'Enviar aviso', gracias: 'Gracias, lo revisaremos.', falla: 'No se ha podido enviar. Prueba otra vez.', tope: 'Has enviado muchos avisos hoy. Prueba mañana.', cerrar: 'Cerrar' },
    en: { accion: 'Report this response', cuerpo: 'It was written by AI. Tell us what is wrong and we will review it.', ofensiva: 'Offensive', incorrecta: 'Incorrect', otro: 'Other', nota: 'Anything else (optional)', enviar: 'Send report', gracias: 'Thanks, we will review it.', falla: 'It could not be sent. Try again.', tope: 'You have sent many reports today. Try tomorrow.', cerrar: 'Close' },
    ca: { accion: 'Avisar d’aquesta resposta', cuerpo: 'L’ha escrit una IA. Digues-nos què li passa i la revisarem.', ofensiva: 'Ofensiva', incorrecta: 'Incorrecta', otro: 'Altres', nota: 'Alguna cosa més (opcional)', enviar: 'Enviar l’avís', gracias: 'Gràcies, ho revisarem.', falla: 'No s’ha pogut enviar. Torna-ho a provar.', tope: 'Avui has enviat molts avisos. Prova-ho demà.', cerrar: 'Tancar' },
    gl: { accion: 'Avisar desta resposta', cuerpo: 'Escribiuna unha IA. Dinos que lle pasa e revisarémola.', ofensiva: 'Ofensiva', incorrecta: 'Incorrecta', otro: 'Outro', nota: 'Algo máis (opcional)', enviar: 'Enviar aviso', gracias: 'Grazas, revisarémolo.', falla: 'Non se puido enviar. Proba outra vez.', tope: 'Hoxe enviaches moitos avisos. Proba mañá.', cerrar: 'Pechar' },
    eu: { accion: 'Erantzun honen berri eman', cuerpo: 'IA batek idatzi du. Esaguzu zer gertatzen zaion eta berrikusiko dugu.', ofensiva: 'Iraingarria', incorrecta: 'Okerra', otro: 'Beste bat', nota: 'Besterik (aukerakoa)', enviar: 'Bidali abisua', gracias: 'Eskerrik asko, berrikusiko dugu.', falla: 'Ezin izan da bidali. Saiatu berriro.', tope: 'Gaur abisu asko bidali dituzu. Saiatu bihar.', cerrar: 'Itxi' },
    fr: { accion: 'Signaler cette réponse', cuerpo: 'Elle a été écrite par une IA. Dites-nous ce qui ne va pas et nous la vérifierons.', ofensiva: 'Offensante', incorrecta: 'Incorrecte', otro: 'Autre', nota: 'Autre chose (facultatif)', enviar: 'Envoyer le signalement', gracias: 'Merci, nous allons vérifier.', falla: 'L’envoi a échoué. Réessayez.', tope: 'Vous avez envoyé beaucoup de signalements aujourd’hui. Réessayez demain.', cerrar: 'Fermer' },
    de: { accion: 'Diese Antwort melden', cuerpo: 'Sie wurde von einer KI geschrieben. Sag uns, was nicht stimmt, und wir prüfen sie.', ofensiva: 'Beleidigend', incorrecta: 'Falsch', otro: 'Sonstiges', nota: 'Noch etwas (optional)', enviar: 'Meldung senden', gracias: 'Danke, wir prüfen das.', falla: 'Senden fehlgeschlagen. Versuch es noch einmal.', tope: 'Du hast heute viele Meldungen gesendet. Versuch es morgen.', cerrar: 'Schließen' },
    it: { accion: 'Segnala questa risposta', cuerpo: 'L’ha scritta un’IA. Dicci cosa non va e la controlleremo.', ofensiva: 'Offensiva', incorrecta: 'Errata', otro: 'Altro', nota: 'Altro da aggiungere (facoltativo)', enviar: 'Invia segnalazione', gracias: 'Grazie, la controlleremo.', falla: 'Invio non riuscito. Riprova.', tope: 'Oggi hai inviato molte segnalazioni. Riprova domani.', cerrar: 'Chiudi' },
  };

  function idioma() {
    var l = '';
    try { l = (window.I18N && window.I18N.lang) || localStorage.getItem('klendar_lang') || ''; } catch (e) { /* sin permisos */ }
    l = String(l || document.documentElement.lang || 'es').slice(0, 2).toLowerCase();
    return T[l] ? l : 'es';
  }
  function t(k) { return T[idioma()][k] || T.es[k]; }

  var BANDERA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6zm3.6 8h-3.36l-.4-2H7V6h5.36l.4 2H18v6z"/></svg>';

  var estilo = false;
  function ponEstilo() {
    if (estilo) return;
    estilo = true;
    var s = document.createElement('style');
    s.textContent = [
      '.aviso-ia-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:none;color:var(--ink-2,var(--muted,#666));cursor:pointer;vertical-align:middle}',
      '.aviso-ia-btn:hover,.aviso-ia-btn:focus-visible{color:var(--ink,#111);background:rgba(127,127,127,.12)}',
      '.aviso-ia-dlg{max-width:420px;width:calc(100% - 32px);border:0;border-radius:20px;padding:20px;background:var(--surface,var(--bg,#fff));color:var(--ink,#111);box-shadow:0 12px 40px rgba(0,0,0,.25)}',
      '.aviso-ia-dlg::backdrop{background:rgba(0,0,0,.45)}',
      '.aviso-ia-dlg h2{margin:0 0 4px;font-size:1.2rem}',
      '.aviso-ia-dlg p{margin:0 0 10px;font-size:.88rem;color:var(--ink-2,var(--muted,#666))}',
      '.aviso-ia-dlg label{display:flex;gap:8px;align-items:center;min-height:36px;cursor:pointer}',
      '.aviso-ia-dlg textarea{width:100%;box-sizing:border-box;margin:8px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;font:inherit;resize:vertical}',
      '.aviso-ia-acc{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}',
      '.aviso-ia-acc button{min-height:44px;padding:0 16px;border-radius:12px;font:inherit;font-weight:700;cursor:pointer;background:none;color:inherit;border:1px solid rgba(127,127,127,.45)}',
      '.aviso-ia-acc button.aviso-ia-x{border-color:transparent}',
      '.aviso-ia-acc button:disabled{opacity:.5;cursor:default}',
      '.aviso-ia-ok{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100% - 32px);padding:12px 16px;border-radius:12px;background:var(--ink,#111);color:var(--bg,#fff);font-size:.92rem}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }

  function aviso(texto) {
    ponEstilo();
    var n = el('div', { class: 'aviso-ia-ok', role: 'status', translate: 'no', texto: texto });
    // Dentro del diálogo abierto (si lo hay) para que se vea por encima.
    var abierto = document.querySelector('dialog[open]');
    (abierto && !abierto.classList.contains('aviso-ia-dlg') ? abierto : document.body).appendChild(n);
    setTimeout(function () { n.remove(); }, 4000);
  }

  function abre(o) {
    var texto = String((o && o.texto) || '').trim();
    if (!texto || !o || typeof o.enviar !== 'function') return;
    ponEstilo();
    var motivos = [['offensive', 'ofensiva'], ['wrong', 'incorrecta'], ['other', 'otro']];
    var nombre = 'aviso-ia-' + Math.random().toString(36).slice(2);
    var nota = el('textarea', { rows: '3', maxlength: '500', placeholder: t('nota'), 'aria-label': t('nota') });
    var enviar = el('button', { type: 'submit', disabled: '', texto: t('enviar') });
    var cerrar = el('button', { type: 'button', class: 'aviso-ia-x', texto: t('cerrar') });
    var form = el('form', { method: 'dialog' }, [
      el('h2', { texto: t('accion') }),
      el('p', { texto: t('cuerpo') }),
    ].concat(motivos.map(function (m) {
      return el('label', {}, [el('input', { type: 'radio', name: nombre, value: m[0] }), el('span', { texto: t(m[1]) })]);
    })).concat([nota, el('div', { class: 'aviso-ia-acc' }, [cerrar, enviar])]));
    var dlg = el('dialog', { class: 'aviso-ia-dlg', translate: 'no', 'aria-label': t('accion') }, [form]);
    // Encima de otro diálogo (el del asistente): dentro de él, para que el foco no se pierda.
    var padre = document.querySelector('dialog[open]') || document.body;
    padre.appendChild(dlg);
    form.addEventListener('change', function () { enviar.disabled = !form.querySelector('input:checked'); });
    cerrar.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { dlg.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var elegido = form.querySelector('input:checked');
      if (!elegido || enviar.disabled) return;
      enviar.disabled = true;
      enviar.classList.add('mov-ocupado');
      Promise.resolve().then(function () {
        return o.enviar({
          p_use: o.use, p_reason: elegido.value, p_response: texto.slice(0, 4000),
          p_note: nota.value.trim() || null, p_lang: idioma(), p_platform: 'web',
        });
      }).then(function () {
        dlg.close();
        aviso(t('gracias'));
      }).catch(function (err) {
        enviar.disabled = false;
        enviar.classList.remove('mov-ocupado');
        aviso(/rate_limited/.test(String((err && (err.clave || err.message)) || err)) ? t('tope') : t('falla'));
      });
    });
    dlg.showModal();
  }

  function boton(o) {
    ponEstilo();
    var b = el('button', { type: 'button', class: 'aviso-ia-btn', translate: 'no', 'aria-label': t('accion'), title: t('accion') });
    b.innerHTML = BANDERA;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      abre(typeof o === 'function' ? o() : o);
    });
    return b;
  }

  window.KlendarAvisoIA = { boton: boton, abre: abre };
})();
