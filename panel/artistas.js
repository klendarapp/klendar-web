/* «Quién actúa» en el formulario de publicación (solo eventos) y lo de los
 * organizadores sin local fijo en el panel (tanda C; migraciones
 * 20261205100000_artistas y 20261205100001_sin_local_fijo de la app).
 *
 * «Quién actúa»: chips con los elegidos (× para quitar), un buscador
 * (`business_artist_suggestions`: sin texto, los que ya ha puesto el negocio;
 * con texto, los que encajan, los suyos primero) y «Añadir «X» como nuevo»
 * cuando no está. Como mucho 10. Lo que escribe el negocio solo pone el
 * nombre: la ficha del artista (foto, descripción, enlaces) la cambia
 * administración. Se guarda DESPUÉS de la publicación, con su id
 * (`set_offer_artists`, como `set_offer_promoters`).
 *
 * Script clásico: comparte ámbito con panel.js (BIZ, rpc, esc, $, $$…). Va
 * después de panel.js; los textos, de /assets/artistas.js.
 */
'use strict';

const KAp = () => globalThis.KlendarArtistas;
const SAp = () => KAp().t(I18N.lang);

/** Sin tildes, sin mayúsculas y sin nada que no sea letra o número (lo mismo
 * que `artist_key` en la base): «DJ Nano» y «Dj-nano» son el mismo. */
const claveArtista = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const nombreLimpio = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** El bloque, para el formulario (`offerForm`). */
function quienActuaHtml() {
  const S = SAp();
  return `<fieldset class="f plano quien-actua" id="quienActua"><legend>${esc(S.whoPerforms)}</legend>
      <div class="art-chips" id="artChips"></div>
      <div class="art-buscar">
        <input type="search" id="artQ" maxlength="60" autocomplete="off" spellcheck="false" enterkeyhint="done"
          placeholder="${esc(S.searchPh)}" aria-label="${esc(S.addArtist)}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="artSug">
        <div class="art-sug" id="artSug" role="listbox" aria-label="${esc(S.addArtist)}" hidden></div>
      </div>
      <p class="hint" id="artAyuda">${esc(S.panelHint)}</p>
    </fieldset>`;
}

/**
 * Engancha el bloque. `iniciales`: [{id, name}] (al editar o al crear a partir
 * de otra). Devuelve { lista() (para comparar cambios), guarda(offerId, evento) }.
 */
function quienActuaEngancha(v, iniciales = [], alCambiar = () => {}) {
  const S = SAp();
  const MAX = KAp().MAX_POR_EVENTO;
  let elegidos = (iniciales || []).filter((a) => a && a.name).map((a) => ({ id: a.id || null, name: a.name }));
  const chips = $('#artChips', v);
  const q = $('#artQ', v);
  const sug = $('#artSug', v);
  const ayuda = $('#artAyuda', v);
  let opciones = [];
  let activa = -1;
  let pedido = 0;
  let espera = null;

  const pintaChips = () => {
    chips.innerHTML = elegidos.map((a, i) => `<span class="art-chip">${esc(a.name)}<button type="button" data-quita="${i}" aria-label="${esc(S.remove(a.name))}" title="${esc(S.remove(a.name))}">×</button></span>`).join('');
    chips.hidden = !elegidos.length;
    const lleno = elegidos.length >= MAX;
    q.disabled = lleno;
    ayuda.textContent = lleno ? S.tooMany : S.panelHint;
  };
  const cierra = () => { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); activa = -1; };
  const marca = (i) => {
    activa = i;
    $$('[role=option]', sug).forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    const o = $$('[role=option]', sug)[i];
    if (o) { q.setAttribute('aria-activedescendant', o.id); o.scrollIntoView({ block: 'nearest' }); } else q.removeAttribute('aria-activedescendant');
  };
  const pintaSug = (lista, texto) => {
    const ya = new Set(elegidos.map((a) => claveArtista(a.name)));
    const ids = new Set(elegidos.map((a) => a.id).filter(Boolean));
    const libres = (lista || []).filter((a) => a && a.id && !ids.has(a.id) && !ya.has(claveArtista(a.name)));
    const limpio = nombreLimpio(texto);
    const k = claveArtista(limpio);
    const existe = k && ((lista || []).some((a) => claveArtista(a.name) === k) || ya.has(k));
    opciones = libres.map((a) => ({ id: a.id, name: a.name }));
    if (limpio.length >= 2 && k && !existe) opciones.push({ id: null, name: limpio, nuevo: true });
    if (!opciones.length) {
      sug.innerHTML = limpio.length >= 2 ? `<p class="art-sug-nada">${esc(S.noneFound)}</p>` : '';
      sug.hidden = limpio.length < 2;
      q.setAttribute('aria-expanded', String(!sug.hidden));
      activa = -1;
      return;
    }
    sug.innerHTML = `${!limpio && libres.length ? `<p class="art-sug-t">${esc(S.yourArtists)}</p>` : ''}${opciones.map((o, i) => `<button type="button" role="option" id="artOp${i}" data-op="${i}" aria-selected="false" tabindex="-1" class="${o.nuevo ? 'nuevo' : ''}">${o.nuevo ? esc(S.addNew(o.name)) : esc(o.name)}</button>`).join('')}`;
    sug.hidden = false;
    q.setAttribute('aria-expanded', 'true');
    marca(-1);
  };
  const busca = async () => {
    const texto = q.value;
    const limpio = nombreLimpio(texto);
    const n = ++pedido;
    if (limpio.length === 1) { pintaSug([], texto); return; }
    let lista = [];
    try { lista = (await rpc('business_artist_suggestions', { p_business: BIZ.id, p_q: limpio || null, p_limit: 20 })) || []; } catch { lista = []; }
    if (n !== pedido || document.activeElement !== q) return;
    pintaSug(lista, texto);
  };
  const elige = (o) => {
    if (!o || elegidos.length >= MAX) return;
    const nombre = nombreLimpio(o.name);
    if (!o.id && (nombre.length < 2 || nombre.length > 60 || !claveArtista(nombre))) { toast(S.nameInvalid(nombre), true); return; }
    elegidos.push({ id: o.id || null, name: nombre });
    q.value = '';
    pintaChips();
    cierra();
    alCambiar();
    if (!q.disabled) { q.focus(); busca(); }
  };

  chips.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-quita]') : null;
    if (!b) return;
    elegidos.splice(Number(b.dataset.quita), 1);
    pintaChips();
    alCambiar();
    q.focus();
  });
  q.addEventListener('focus', () => busca());
  q.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(busca, 250); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (sug.hidden || !opciones.length) return;
      e.preventDefault();
      const n = opciones.length;
      marca(e.key === 'ArrowDown' ? (activa + 1) % n : (activa <= 0 ? n - 1 : activa - 1));
    } else if (e.key === 'Enter') {
      // Intro no manda el formulario: elige la marcada o, si no hay, lo escrito.
      e.preventDefault();
      if (activa >= 0) { elige(opciones[activa]); return; }
      const limpio = nombreLimpio(q.value);
      if (!limpio) return;
      const igual = opciones.find((o) => claveArtista(o.name) === claveArtista(limpio));
      elige(igual || { id: null, name: limpio });
    } else if (e.key === 'Escape') {
      if (!sug.hidden) { e.preventDefault(); e.stopPropagation(); cierra(); }
    } else if (e.key === 'Backspace' && !q.value && elegidos.length) {
      elegidos.pop(); pintaChips(); alCambiar();
    }
  });
  // `mousedown` y no `click`: el campo no pierde el foco antes de elegir.
  sug.addEventListener('mousedown', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-op]') : null;
    if (!b) return;
    e.preventDefault();
    elige(opciones[Number(b.dataset.op)]);
  });
  q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) cierra(); }, 120));
  pintaChips();

  return {
    lista: () => elegidos.map((a) => a.id || `+${a.name}`),
    nombres: () => elegidos.map((a) => a.name),
    /** Tras guardar la publicación. Un evento lleva su lista (vacía también,
     * para quitar los que tuviera); una oferta flash, ninguno si tenía. Si
     * falla, la publicación ya está guardada: se avisa y sigue. */
    async guarda(offerId, evento, teniaAlguno) {
      if (!evento && !teniaAlguno) return;
      const lista = evento ? elegidos.map((a) => (a.id ? { id: a.id } : { name: a.name })) : [];
      if (!lista.length && !teniaAlguno) return;
      let r = null;
      try { r = await rpc('set_offer_artists', { p_offer: offerId, p_artists: lista }); } catch (e) { r = { ok: false, error: String(e?.message || '') }; }
      if (r?.ok !== false) return;
      const motivo = S.reasons[r.error] || S.reasons.other;
      const nombre = r.name || (r.error === 'too_many' ? '' : elegidos.find((a) => !a.id)?.name) || elegidos.map((a) => a.name).join(', ');
      toast(S.savedBut(nombre, motivo), true);
    },
  };
}

/** Los artistas que ya tiene una publicación (al editarla o copiarla). */
async function artistasDe(offerId) {
  if (!offerId) return [];
  try {
    const l = await rpc('offer_artists_of', { p_offer: offerId });
    return (Array.isArray(l) ? l : []).filter((a) => a && a.id && a.name).map((a) => ({ id: a.id, name: a.name }));
  } catch { return []; }
}
