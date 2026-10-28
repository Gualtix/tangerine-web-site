/*
 * Single state module: the cart and the customer profile, their localStorage persistence, the cart
 * rules, and change notification. Business-agnostic: it only knows products as ids with a price.
 *
 * Cart line shape: { id, qty, removed[] }. One line per product + removed-ingredient set, so adding
 * the same customisation again merges into the existing line.
 * Persistence: localStorage under `${storageKey}:cart` and `${storageKey}:profile`. Every access is
 * in try/catch, so private mode or a full quota keeps working in memory. On load, unknown product
 * ids and malformed entries are dropped. Prices are never stored; they are looked up at render time.
 * Privacy: the profile keeps only name and address (reused by returning customers). Order notes and
 * the delivery map pin are per order and never stored here.
 * Notifications: the store is an EventTarget and fires 'change' after every cart mutation.
 */
import { clamp, sameSet } from './utils.js';

/** Namespaced, fail-safe JSON access to localStorage (also used by components/pwa.js). */
export const storage = key => ({
  get(name, fallback) { try { return JSON.parse(localStorage.getItem(`${key}:${name}`)) ?? fallback; } catch { return fallback; } },
  set(name, value) { try { localStorage.setItem(`${key}:${name}`, JSON.stringify(value)); } catch { /* private mode or quota: keep working in memory */ } }
});

export class CartStore extends EventTarget {
  #storage; #catalog; #maxQty;

  /**
   * @param {{ storageKey: string, maxQty: number, catalog: Map<string, { price: number }> }} options
   *   catalog maps every orderable product id to its product; it defines which saved lines are still valid.
   */
  constructor({ storageKey, maxQty, catalog }) {
    super();
    this.#storage = storage(storageKey);
    this.#catalog = catalog;
    this.#maxQty = maxQty;
    // stale or tampered entries (unknown id, bad qty) are dropped on load; a saved cart that is not
    // an array (valid JSON, wrong shape) counts as empty instead of crashing startup
    const saved = this.#storage.get('cart', []);
    this.lines = (Array.isArray(saved) ? saved : []).filter(l => catalog.has(l?.id) && Array.isArray(l.removed))
      .map(l => ({ id: l.id, qty: clamp(Math.floor(l.qty) || 1, 1, maxQty), removed: l.removed.map(String) }));
    /** { name, address } of the returning customer, or {} */
    this.profile = this.#storage.get('profile', {});
  }

  /** Total number of items across all lines. */
  count() { return this.lines.reduce((n, l) => n + l.qty, 0); }

  /** Order total from current catalogue prices. */
  total() { return this.lines.reduce((n, l) => n + this.#catalog.get(l.id).price * l.qty, 0); }

  /** Adds qty of a product; merges into an existing line with the same removed-ingredient set. */
  add(id, qty, removed) {
    const same = this.lines.find(l => l.id === id && sameSet(l.removed, removed));
    if (same) same.qty = clamp(same.qty + qty, 1, this.#maxQty);
    else this.lines.push({ id, qty, removed });
    this.#changed();
  }

  /** Replaces line i in place; if the edit makes it identical to another line, merges into that one. */
  update(i, qty, removed) {
    const { id } = this.lines.splice(i, 1)[0];
    const same = this.lines.find(l => l.id === id && sameSet(l.removed, removed));
    if (same) same.qty = clamp(same.qty + qty, 1, this.#maxQty);
    else this.lines.splice(i, 0, { id, qty, removed });
    this.#changed();
  }

  /** Sets the quantity of line i, clamped to 1..maxQty. */
  setQty(i, qty) {
    this.lines[i].qty = clamp(qty, 1, this.#maxQty);
    this.#changed();
  }

  /** Removes line i. */
  remove(i) {
    this.lines.splice(i, 1);
    this.#changed();
  }

  /** Persists the customer's name and address for the next visit. */
  saveProfile({ name, address }) {
    this.profile = { name, address };
    this.#storage.set('profile', this.profile);
  }

  /** Saves the cart and notifies subscribers. */
  #changed() {
    this.#storage.set('cart', this.lines);
    this.dispatchEvent(new Event('change'));
  }
}
