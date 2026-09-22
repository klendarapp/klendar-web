import { html, isUuid, pickLang, render, rpc } from '../_lib/page.js';

// /b/<id>: ficha pública de un negocio con vista previa (OG + JSON-LD).
export async function onRequestGet({ request, params }) {
  const lang = pickLang(request);
  const path = `/b/${params.id}`;
  if (!isUuid(params.id)) return html(render({ lang, path, kind: 'b', notFound: true }), 404, 'no-store');
  const b = await rpc('business_profile', { p_id: params.id });
  if (!b || !b.name) return html(render({ lang, path, kind: 'b', notFound: true }), 404, 'no-store');
  const en = lang === 'en';
  const bits = [];
  if (b.rating && b.ratings) bits.push(`★ ${Number(b.rating).toFixed(1)} (${b.ratings})`);
  if (b.active_flash) bits.push(en ? `${b.active_flash} flash deal(s) now` : `${b.active_flash} oferta(s) flash ahora`);
  const where = [b.address, b.city].filter(Boolean).join(', ');
  if (where) bits.push(where);
  const description = `${bits.join(' · ')}${b.description ? ` — ${b.description}` : ''}`.slice(0, 200);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, description: b.description || undefined,
    url: `https://klendar.app${path}`, image: b.cover || b.logo || undefined, telephone: b.phone || undefined,
    address: where ? { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: b.city || undefined, addressCountry: 'ES' } : undefined,
    geo: b.lat ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating && b.ratings ? { '@type': 'AggregateRating', ratingValue: Number(b.rating).toFixed(1), reviewCount: b.ratings } : undefined,
    sameAs: b.website ? [b.website] : undefined,
  };
  return html(render({
    lang, path, kind: 'b',
    title: b.name, description, image: b.cover || b.logo,
    ogTitle: b.name, ogDescription: description, jsonLd,
  }));
}
