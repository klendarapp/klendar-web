import { discountLabel, fmtWhen, html, isUuid, pickLang, render, rpc } from '../_lib/page.js';

// /o/<id>: ficha pública de una oferta o evento con vista previa (OG + JSON-LD).
export async function onRequestGet({ request, params }) {
  const lang = pickLang(request);
  const path = `/o/${params.id}`;
  if (!isUuid(params.id)) return html(render({ lang, path, kind: 'o', notFound: true }), 404, 'no-store');
  const o = await rpc('offer_detail', { p_id: params.id });
  if (!o) return html(render({ lang, path, kind: 'o', notFound: true }), 404, 'no-store');
  const en = lang === 'en';
  const flash = o.kind === 'flash_offer';
  const soldOut = o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0);
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const bits = [];
  if (soldOut) bits.push(en ? 'Sold out' : 'Agotado');
  const disc = discountLabel(o.discount);
  if (disc) bits.push(disc);
  if (o.price_cents != null) bits.push(`${(o.price_cents / 100).toFixed(2)} €`);
  bits.push(flash
    ? (en ? `Redeem until ${fmtWhen(o.redeem_end_at, lang)}` : `Canjea hasta el ${fmtWhen(o.redeem_end_at, lang)}`)
    : fmtWhen(o.event_at, lang));
  const where = [o.business_name, o.city].filter(Boolean).join(' · ');
  const description = `${bits.join(' · ')} — ${where}${o.description ? `. ${o.description}` : ''}`.slice(0, 200);
  const address = [o.address, o.city].filter(Boolean).join(', ');
  const jsonLd = flash
    ? {
        '@context': 'https://schema.org', '@type': 'Offer', name: o.title, description: o.description || undefined,
        url: `https://klendar.app${path}`, image: o.images?.[0], validFrom: o.redeem_start_at, validThrough: o.redeem_end_at,
        offeredBy: { '@type': 'LocalBusiness', name: o.business_name, address },
        price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : undefined,
        priceCurrency: o.price_cents != null ? (o.currency || 'EUR') : undefined,
        availability,
      }
    : {
        '@context': 'https://schema.org', '@type': 'Event', name: o.title, description: o.description || undefined,
        url: `https://klendar.app${path}`, image: o.images?.[0], startDate: o.event_at, endDate: o.event_end_at || undefined,
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: o.business_name, address }, organizer: { '@type': 'Organization', name: o.business_name },
        // Un evento con reserva en la app tiene entrada: Google y las redes
        // enseñan «agotado» cuando ya no quedan plazas.
        offers: o.reservations_enabled
          ? {
              '@type': 'Offer', url: `https://klendar.app${path}`, availability,
              price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '0',
              priceCurrency: o.currency || 'EUR', validFrom: o.created_at || undefined,
            }
          : undefined,
      };
  return html(render({
    lang, path, kind: 'o',
    title: o.title, description, image: o.images?.[0],
    ogTitle: `${o.title} · ${o.business_name}`, ogDescription: description, jsonLd,
  }));
}
