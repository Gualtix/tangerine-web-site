/*
 * Pure, DOM-free helpers that any module may import. No state and no side effects.
 *
 * Security: every string interpolated into an HTML template goes through esc(). User input is only
 * ever assigned as .value or placed in the WhatsApp message text, never rendered as HTML.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes a value for safe use in HTML text and attribute positions. */
export const esc = v => String(v).replace(/[&<>"']/g, c => ESC[c]);

/** Limits n to the range [lo, hi]. */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** True when two arrays hold the same strings in any order: the cart's line-merge key for removed ingredients. */
export const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/** Returns a currency formatter, e.g. money('es-GT', 'GTQ')(35) -> "Q35.00". Build it once and reuse it. */
export const money = (locale, currency) => {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return n => format.format(n);
};

/** Reduces a phone number in any format to its digits, as wa.me links require. */
export const digitsOnly = v => String(v).replace(/\D/g, '');
