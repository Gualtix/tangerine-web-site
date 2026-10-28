/*
 * Outside-world integrations: the only places the site talks to something beyond the page.
 * Business-agnostic: copy, prices and the phone number come in as arguments.
 *
 * WhatsApp hand-off: cart lines + customer info -> plain-text order -> https://wa.me/<digits>?text=<encoded>.
 *   Payment, confirmation and fulfilment happen by hand in that chat (no inventory, gateway or tracking).
 * Location: device GPS when available, a lazily loaded Leaflet map, and the Google Maps link that goes
 *   into the message. Leaflet 1.9.4 is the one external script dependency, pinned and SRI-checked.
 */
import { digitsOnly } from './utils.js';

/* ===== WhatsApp ===== */

/**
 * Builds the plain-text order message. Its exact text and layout are what staff read in WhatsApp,
 * so change it deliberately.
 * @param lines  cart lines [{ id, qty, removed[] }]
 * @param info   { name, address, notes, location?, orderId? }
 * @param ctx    { t: UI copy, fmt: currency formatter, byId: Map of products }
 */
export function buildMessage(lines, info, { t, fmt, byId }) {
  const out = info.orderId ? [`${t.msgOrder}: ${info.orderId}`, t.msgGreeting, ''] : [t.msgGreeting, ''];
  lines.forEach((l, i) => {
    const p = byId.get(l.id);
    out.push(`${i + 1}) ${l.qty} x ${p.name} - ${fmt(p.price * l.qty)}`);
    if (l.removed.length) out.push(`   ${t.without} ${l.removed.join(', ')}`);
  });
  out.push('', `${t.total}: ${fmt(lines.reduce((n, l) => n + byId.get(l.id).price * l.qty, 0))}`, '');
  out.push(`${t.msgName}: ${info.name}`, `${t.msgAddress}: ${info.address}`);
  if (info.location) out.push(`${t.msgLocation}: ${info.location}`);
  if (info.notes) out.push(`${t.msgNotes}: ${info.notes}`);
  return out.join('\n');
}

/** wa.me deep link that opens a chat with `number` and the message prefilled. */
export const waUrl = (number, text) => `https://wa.me/${digitsOnly(number)}?text=${encodeURIComponent(text)}`;

// Order id: PREFIX-YYMMDD-RANDOM, e.g. DG-261027-7KQ4M. No backend, so uniqueness is probabilistic:
// ids can only collide within the same day (32^5 ≈ 33M codes/day), and WhatsApp also shows the sender's number.
// Crockford base32 (no I, L, O, U) so staff can read it aloud; 256 % 32 === 0, so no modulo bias.
const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Creates a fresh order id from crypto randomness; `now` is injectable for the self-check. */
export const orderId = ({ prefix = '', randomLength = 5 } = {}, now = new Date()) => {
  const date = [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('');
  const code = Array.from(crypto.getRandomValues(new Uint8Array(randomLength)), b => ID_ALPHABET[b % 32]).join('');
  return [prefix, date, code].filter(Boolean).join('-');
};

/* ===== Location and maps ===== */

/** Google Maps link for a point, rounded to 6 decimals (~10 cm). */
export const mapsUrl = ({ lat, lng }) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

/**
 * Resolves the device position as { lat, lng }. Geolocation only works in a secure context (https or
 * localhost); on plain http, when permission is denied, or after the 10 s timeout it rejects and the
 * caller falls back to its default map centre.
 */
export const locate = () => new Promise((ok, fail) => {
  if (!navigator.geolocation || !window.isSecureContext) return fail(new Error('geolocation unavailable'));
  navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), fail,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
});

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';
let leaflet = null; // the in-flight or finished load, shared by every caller

/** Appends a <link>/<script> to <head> and resolves when it has loaded. */
const tag = el => new Promise((ok, fail) => { el.onload = ok; el.onerror = fail; document.head.append(el); });

/**
 * Loads Leaflet's CSS and JS once, pinned to 1.9.4 with Subresource Integrity, and resolves with the
 * Leaflet namespace. A failed load is forgotten so the next map open retries.
 */
export const loadLeaflet = () => leaflet ||= (window.L ? Promise.resolve() : Promise.all([
  tag(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: LEAFLET + '.css', integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=', crossOrigin: '' })),
  tag(Object.assign(document.createElement('script'), { src: LEAFLET + '.js', integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=', crossOrigin: '' }))
])).then(() => window.L, err => { leaflet = null; throw err; }); // reset so the next open retries
