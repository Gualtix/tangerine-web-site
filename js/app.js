/*
 * Composition root, the single module index.html loads. Imports the business data, creates the store,
 * registers the components (each module calls customElements.define when imported) and hands them the
 * shared context. Runs the opt-in ?sf-selftest assertions.
 *
 * What the site is: a landing page plus a WhatsApp storefront. The page collects a cart, a delivery
 * address and an optional map pin, then hands off to WhatsApp with a prefilled plain-text order.
 * Payment, confirmation and fulfilment happen by hand in that chat; there is no inventory, payment
 * gateway or order tracking.
 *
 * Layers (the monolith's planned "extract the core" upgrade, done):
 *   data.js             business data only: identity, WhatsApp number, locale, currency, limits, copy, products
 *   js/*.js             business-agnostic plain modules: store, services, utils, ui (no custom elements)
 *   js/components/      light-DOM custom elements: site.js (generic landing), menu.js + order.js (the journeys),
 *                       pwa.js (install button, offline message)
 * Installable app: manifest.webmanifest, icons/ (regenerate with icons/generate.sh) and ../sw.js, which only
 *   serves offline.html when a page load fails; everything else always comes from the network.
 */
import data from '../data.js';
import { CartStore } from './store.js';
import { money, sameSet } from './utils.js';
import * as services from './services.js';
import { revealOnScroll } from './components/site.js';
import './components/menu.js';
import './components/order.js';
import { installMode } from './components/pwa.js';

const fmt = money(data.locale, data.currency);
const byId = new Map(data.products.map(p => [p.id, p]));
const store = new CartStore({ storageKey: data.storageKey, maxQty: data.maxQty, catalog: byId });

/** Context every data-driven element renders from. Elements are already upgraded here, so the `app` setter runs. */
const app = { data, store, fmt, byId };
document.querySelectorAll('menu-catalog, product-dialog, cart-bar, cart-dialog, reserve-form, app-install, offline-notice').forEach(el => { el.app = app; });
revealOnScroll();
// relative to the page, so it works in a sub-folder; its scope is the folder holding sw.js
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[pwa] service worker not registered', err));

// self-check, opt-in via ?sf-selftest (no test runner needed). The assertions are the monolith's,
// unchanged; the bindings below give them the same names and signatures they had there.
if (new URLSearchParams(location.search).has('sf-selftest')) {
  const cfg = data, t = data.text, { mapsUrl, orderId } = services;
  const buildMessage = (lines, info) => services.buildMessage(lines, info, { t, fmt, byId });
  const waUrl = text => services.waUrl(cfg.whatsapp, text);
  const [a, b] = cfg.products, msg = buildMessage([{ id: a.id, qty: 2, removed: ['X'] }, { id: b.id, qty: 1, removed: [] }], { name: 'N', address: 'A', notes: '' });
  console.assert(msg.includes(`2 x ${a.name} - ${fmt(a.price * 2)}`) && msg.includes(`${t.without} X`), 'line + removed ingredient');
  console.assert(msg.includes(`${t.total}: ${fmt(a.price * 2 + b.price)}`) && !msg.includes(t.msgNotes), 'total, no empty notes');
  console.assert(!msg.includes(t.msgLocation), 'no location line without a pin');
  const pinned = buildMessage([{ id: a.id, qty: 1, removed: [] }], { name: 'N', address: 'A', notes: '', location: mapsUrl({ lat: 14.5230004, lng: -90.759 }) });
  console.assert(pinned.includes(`${t.msgAddress}: A\n${t.msgLocation}: https://www.google.com/maps?q=14.523000,-90.759000`), 'location line follows address');
  console.assert(waUrl('a b&c').endsWith('?text=a%20b%26c') && /^https:\/\/wa\.me\/\d+\?/.test(waUrl('')), 'wa.me url');
  console.assert(sameSet(['b', 'a'], ['a', 'b']) && !sameSet(['a'], ['a', 'b']), 'line merge key');
  const ids = Array.from({ length: 200 }, () => orderId({ prefix: 'DG', randomLength: 5 }, new Date(2026, 9, 27)));
  console.assert(ids.every(id => /^DG-261027-[0-9A-HJKMNP-TV-Z]{5}$/.test(id)) && new Set(ids).size === ids.length, 'order id format + no repeats');
  console.assert(buildMessage([{ id: a.id, qty: 1, removed: [] }], { name: 'N', address: 'A', orderId: 'DG-1' }).startsWith(`${t.msgOrder}: DG-1\n${t.msgGreeting}`), 'order id is the first line');
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  console.assert(installMode({ ua: mac }) === '' && installMode({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0', uaData: { platform: 'Windows', mobile: false }, touchPoints: 10 }) === '', 'install: never on desktop, touch laptops included');
  console.assert(installMode({ ua: android }) === 'prompt' && installMode({ ua: android, uaData: { platform: 'Android', mobile: false } }) === 'prompt', 'install: Android phone and tablet');
  console.assert(installMode({ ua: iphone }) === 'ios' && installMode({ ua: mac, touchPoints: 5 }) === 'ios', 'install: iPhone and iPadOS (Mac UA + touch)');
  console.assert(installMode({ ua: iphone, standalone: true }) === '' && installMode({ ua: `${iphone} Instagram 300.0` }) === '', 'install: hidden when installed or in an in-app webview');
  console.info('[storefront] self-check done');
}
