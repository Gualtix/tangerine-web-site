/*
 * Business-specific order journey: <cart-bar>, <cart-dialog> (lines, checkout form, WhatsApp hand-off)
 * and <location-picker> (optional delivery pin). Replace this file, menu.js and data.js for a different
 * kind of business. Each element renders once js/app.js (or its parent) sets its `app` property
 * ({ data, store, fmt, byId }), and re-renders on the store's 'change' event.
 *
 * Flow: cart lines -> render -> checkout (name, address, optional pin, notes)
 *   -> buildMessage(lines, info) -> https://wa.me/<digits>?text=<encodeURIComponent(message)>.
 * Shortest path: Ordenar ahora -> Agregar -> cart bar -> Pedir por WhatsApp (the address is prefilled
 *   from the saved profile after the first order). Bottom sheets on mobile and a sticky cart bar.
 * Hooks: any element with [data-sf-open-cart] opens the cart.
 */
import { esc } from '../utils.js';
import { cls, icon, stepper, wireDialog } from '../ui.js';
import { buildMessage, waUrl, orderId, mapsUrl, locate, loadLeaflet } from '../services.js';

/** Asks <product-dialog> (menu.js) to open; detail { id, edit } with edit = cart line index. */
const OPEN_PRODUCT = 'sf:product';
/** Asks <offline-notice> (pwa.js) to show the offline message. */
const OFFLINE = 'sf:offline';

/**
 * <cart-bar>: sticky "Ver pedido" button with item count and total, shown only while the cart has items.
 * Also pads the page bottom then, so the bar never covers the footer.
 */
class CartBar extends HTMLElement {
  set app({ data, store, fmt }) {
    const t = data.text;
    this.innerHTML = `<button type="button" class="fixed z-60 left-3 right-3 bottom-[calc(12px+env(safe-area-inset-bottom))] flex items-center gap-3 min-h-14 pl-3.5 pr-5 rounded-full bg-ink text-white font-semibold cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,.25)] sm:left-auto sm:right-6 sm:bottom-6 sm:min-w-[300px]" data-sf-open-cart hidden></button>`;
    const bar = this.firstElementChild;
    const render = () => {
      const n = store.count(), total = fmt(store.total());
      bar.hidden = n === 0;
      document.body.classList.toggle('pb-21', n > 0);
      bar.innerHTML = `<span class="grid place-items-center min-w-[30px] h-[30px] px-2 rounded-[15px] bg-tangerine text-ink text-[.9rem]" aria-hidden="true">${n}</span><span>${esc(t.viewCart)}</span><span class="ml-auto">${total}</span>`;
      bar.setAttribute('aria-label', `${t.viewCart}: ${t.itemsLabel(n)}, ${total}`);
    };
    store.addEventListener('change', render);
    render();
  }
}

/**
 * <cart-dialog>: the order sheet. Lists lines (quantity stepper, Cambiar reopens the product dialog,
 * Eliminar), then the checkout form. Name and address persist as the customer profile; notes are per
 * order. Submit trims the fields, validates natively, and opens WhatsApp with the order text.
 */
class CartDialog extends HTMLElement {
  #app; #dialog; #form; #status;

  set app(app) {
    this.#app = app;
    const { data, store } = app, t = data.text;
    this.innerHTML = `<dialog class="${cls.dialog}" aria-labelledby="sf-c-title">
        <form class="${cls.sheet}">
          <div class="${cls.head}"><h2 class="${cls.title}" id="sf-c-title">${esc(t.cartTitle)}</h2>
            <button type="button" class="${cls.close} bg-soft" data-sf-close aria-label="${esc(t.close)}">×</button></div>
          <div class="${cls.body}"><div class="${cls.pad}">
            <ul data-sf-lines></ul>
            <p class="py-7 text-center text-muted" data-sf-empty>${esc(t.empty)}</p>
            <div data-sf-checkout>
              <p class="flex justify-between pt-3.5 pb-1 text-[1.1rem] font-bold"><span>${esc(t.total)}</span><span data-sf-total></span></p>
              <label class="${cls.field}"><span class="${cls.label}">${esc(t.name)}</span><input class="${cls.input}" name="customer" autocomplete="name" required></label>
              <label class="${cls.field}"><span class="${cls.label}">${esc(t.address)}</span><textarea class="${cls.input}" name="address" rows="2" autocomplete="street-address" placeholder="${esc(t.addressHint)}" required></textarea></label>
              ${data.location?.enabled ? '<location-picker class="block mt-3"></location-picker>' : ''}
              <label class="${cls.field}"><span class="${cls.label}">${esc(t.notes)}</span><input class="${cls.input}" name="notes" autocomplete="off"></label>
            </div>
          </div></div>
          <div class="${cls.foot}" data-sf-checkout>
            <!-- side by side when they fit; stacked on narrow phones with WhatsApp (the main action) on top -->
            <div class="w-full flex gap-2.5 max-xs:flex-col-reverse">
              <button type="button" class="${cls.btn} ${cls.btnOutline} min-h-[52px] px-5 text-[.95rem] flex-auto whitespace-nowrap" data-sf-close>${esc(t.keepShopping)}</button>
              <button type="submit" class="${cls.btn} ${cls.btnLg} ${cls.btnWa} flex-auto whitespace-nowrap">${icon('wa')}${esc(t.submit)}</button>
            </div>
            <p class="${cls.hint} w-full text-center">${esc(t.submitHint)}</p>
            <p class="w-full text-center text-[.9rem] font-semibold text-wa empty:hidden" role="status"></p>
          </div>
        </form>
      </dialog>`;
    this.#dialog = this.querySelector('dialog');
    this.#form = this.#dialog.firstElementChild;
    this.#status = this.#form.querySelector('[role="status"]');
    const fields = this.#form.elements, picker = this.querySelector('location-picker');
    if (picker) picker.app = app;
    wireDialog(this.#dialog);

    // profile (name + address) persists for returning customers; notes are per order
    fields.customer.value = store.profile.name || '';
    fields.address.value = store.profile.address || '';
    this.#form.addEventListener('input', () => store.saveProfile({ name: fields.customer.value, address: fields.address.value }));
    this.#form.addEventListener('click', e => this.#onLineClick(e));
    this.#form.addEventListener('submit', e => this.#submit(e));

    document.addEventListener('click', e => {
      if (e.target.closest('[data-sf-open-cart]')) { e.preventDefault(); this.#dialog.showModal(); }
    });
    // after a Cambiar edit the line's buttons were re-rendered, so put focus back on that line's edit button
    document.addEventListener('sf:line-saved', e => {
      (this.querySelector(`[data-sf-line="${Math.min(e.detail.index, store.lines.length - 1)}"] [data-sf-edit]`) || this.querySelector('[data-sf-close]')).focus();
    });
    store.addEventListener('change', () => { this.#status.textContent = ''; this.#render(); });
    this.#render();
  }

  /** Renders the lines, the empty state, the checkout visibility and the total. */
  #render() {
    const { data, store, fmt, byId } = this.#app, t = data.text, n = store.count();
    this.querySelector('[data-sf-lines]').innerHTML = store.lines.map((l, i) => {
      const p = byId.get(l.id);
      return `<li class="py-3 border-b border-line" data-sf-line="${i}">
          <div class="flex justify-between gap-3 font-semibold"><span>${esc(p.name)}${l.removed.length
              ? `<small class="block text-[.85rem] font-semibold text-burnt-d">${esc(t.removedLabel)}: ${esc(l.removed.join(', '))}</small>`
              : p.ingredients?.length ? `<small class="block text-[.85rem] font-normal text-muted">${esc(t.allIngredients)}</small>` : ''}</span>
            <span>${fmt(p.price * l.qty)}</span></div>
          <div class="flex items-center justify-between gap-2 mt-2">${stepper(t, l.qty, data.maxQty)}
            <span class="flex gap-2">
              <button type="button" class="${cls.link} ${cls.linkNeutral} px-3.5" data-sf-edit aria-label="${esc(t.edit)}: ${esc(p.name)}">${esc(t.edit)}</button>
              <button type="button" class="${cls.link} ${cls.linkDanger} px-3.5" data-sf-remove aria-label="${esc(t.remove)}: ${esc(p.name)}">${esc(t.remove)}</button></span></div>
        </li>`;
    }).join('');
    this.querySelector('[data-sf-empty]').hidden = n > 0;
    this.querySelectorAll('[data-sf-checkout]').forEach(el => { el.hidden = n === 0; });
    this.querySelector('[data-sf-total]').textContent = fmt(store.total());
  }

  /** Line controls: stepper, Cambiar (edit in the product dialog) and Eliminar, keeping focus inside the cart. */
  #onLineClick(e) {
    const li = e.target.closest('[data-sf-line]');
    if (!li) return;
    const { store } = this.#app;
    const i = Number(li.dataset.sfLine), step = e.target.closest('[data-sf-step]');
    if (step) {
      store.setQty(i, store.lines[i].qty + Number(step.dataset.sfStep));
      (this.querySelector(`[data-sf-line="${i}"] [data-sf-step="${step.dataset.sfStep}"]:not(:disabled)`) || this.querySelector(`[data-sf-line="${i}"] [data-sf-qty] button:not(:disabled)`))?.focus();
    } else if (e.target.closest('[data-sf-edit]')) {
      this.dispatchEvent(new CustomEvent(OPEN_PRODUCT, { bubbles: true, detail: { id: store.lines[i].id, edit: i } }));
    } else if (e.target.closest('[data-sf-remove]')) {
      store.remove(i);
      (this.querySelector('[data-sf-remove]') || this.querySelector('[data-sf-close]')).focus();
    }
  }

  /** Checkout: trims and validates, saves the profile, and opens WhatsApp with a freshly numbered order. */
  #submit(e) {
    e.preventDefault();
    const { data, store, fmt, byId } = this.#app, form = this.#form, fields = form.elements;
    if (!store.lines.length) return;
    // offline, WhatsApp would open as a broken tab; the cart and the typed fields stay as they are
    if (!navigator.onLine) { document.dispatchEvent(new Event(OFFLINE)); return; }
    ['customer', 'address', 'notes'].forEach(k => { fields[k].value = fields[k].value.trim(); });
    if (!form.reportValidity()) return;
    const pin = this.querySelector('location-picker')?.value;
    const info = { name: fields.customer.value, address: fields.address.value, notes: fields.notes.value, location: pin ? mapsUrl(pin) : '' };
    store.saveProfile({ name: info.name, address: info.address });
    // a fresh id on every tap, even for an unchanged order, so staff never see two messages with the same id
    const message = buildMessage(store.lines, { ...info, orderId: orderId(data.orderId) }, { t: data.text, fmt, byId });
    window.open(waUrl(data.whatsapp, message), '_blank', 'noopener');
    this.#status.textContent = data.text.opened;
  }
}

/**
 * <location-picker>: optional delivery pin inside the checkout form. "Compartir ubicación" opens a
 * bottom-sheet map; once confirmed, the row shows Mapa / Cambiar / Quitar and `value` returns the point.
 *
 * The map centres on device GPS, or on data.location.defaultCenter when GPS is denied, unavailable or
 * not in a secure context (https or localhost). Leaflet and OSM tiles load lazily on the first open; if
 * they fail, the address alone still completes the order.
 * Privacy: the pin is per order and kept in memory only, never persisted. Precise coordinates are more
 * sensitive than a typed address, and a stale pin silently attached to a later order is a wrong-delivery
 * risk. Re-pinning costs one tap.
 */
class LocationPicker extends HTMLElement {
  #app; #delivery = null; #picked = null; #map = null; #pin = null;
  #dialog; #hint; #confirm; #share; #set;

  /** The confirmed delivery point { lat, lng }, or null. */
  get value() { return this.#delivery; }

  set app(app) {
    this.#app = app;
    const t = app.data.text;
    this.innerHTML = `
      <button type="button" class="${cls.btn} ${cls.btnMd} w-full bg-white text-ink border-[1.5px] border-dashed border-muted" data-sf-loc-open>${icon('pin')}${esc(t.locShare)}</button>
      <!-- row 1: pin + "Ubicación agregada"; row 2: Mapa · Cambiar · Quitar as pill buttons -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-2.5 p-3 rounded-xl border-[1.5px] border-wa text-[.92rem] leading-[1.3]" data-sf-loc-set hidden>${icon('pin', 'text-wa')}<b class="flex-[1_1_calc(100%_-_32px)]">${esc(t.locAdded)}</b>
        <a class="${cls.link} ${cls.linkWa} flex-[1_1_0] px-2.5" data-sf-loc-link target="_blank" rel="noopener">${esc(t.locView)}</a>
        <button type="button" class="${cls.link} ${cls.linkNeutral} flex-[1_1_0] px-2.5" data-sf-loc-open>${esc(t.locChange)}</button>
        <button type="button" class="${cls.link} ${cls.linkDanger} flex-[1_1_0] px-2.5" data-sf-loc-clear>${esc(t.locRemove)}</button></div>
      <dialog class="${cls.dialog}" aria-labelledby="sf-l-title">
        <div class="${cls.sheet}">
          <div class="${cls.head}"><h2 class="${cls.title}" id="sf-l-title">${esc(t.locTitle)}</h2>
            <button type="button" class="${cls.close} bg-soft" data-sf-close aria-label="${esc(t.close)}">×</button></div>
          <div class="${cls.body}">
            <p class="${cls.hint} ${cls.pad} mt-0.5 mb-2" role="status" data-sf-loc-hint></p>
            <div class="h-[min(55vh,440px)] bg-soft" data-sf-map></div>
          </div>
          <div class="${cls.foot}"><button type="button" class="${cls.btn} ${cls.btnMd} ${cls.btnPrimary} flex-1" data-sf-loc-confirm disabled>${esc(t.locConfirm)}</button></div>
        </div>
      </dialog>`;
    this.#dialog = this.querySelector('dialog');
    this.#hint = this.querySelector('[data-sf-loc-hint]');
    this.#confirm = this.querySelector('[data-sf-loc-confirm]');
    this.#share = this.querySelector(':scope > [data-sf-loc-open]');
    this.#set = this.querySelector('[data-sf-loc-set]');
    wireDialog(this.#dialog);

    this.#confirm.addEventListener('click', () => {
      if (!this.#picked) return;
      this.#delivery = this.#picked;
      this.#dialog.close();
      this.#render();
      this.#set.querySelector('[data-sf-loc-open]').focus();
    });
    this.addEventListener('click', e => {
      if (e.target.closest('[data-sf-loc-open]')) this.#open();
      else if (e.target.closest('[data-sf-loc-clear]')) { this.#delivery = null; this.#render(); this.#share.focus(); }
    });
  }

  /** Opens the map: starts from the confirmed pin ("Cambiar") or GPS, and reports progress in the status hint. */
  async #open() {
    const { text: t, location: loc } = this.#app.data;
    this.#picked = this.#delivery;
    this.#confirm.disabled = !this.#picked;
    this.#hint.textContent = t.locLocating;
    this.#dialog.showModal();
    const geo = this.#delivery ? Promise.resolve(this.#delivery) : locate();
    geo.then(p => { this.#setPoint(p); this.#map?.setView(p, loc.zoom); }, () => {});
    const [g, lib] = await Promise.allSettled([geo, loadLeaflet().then(L => this.#initMap(L))]);
    this.#hint.textContent = lib.status === 'rejected' ? t.locMapFailed : g.status === 'fulfilled' ? t.locFound : t.locDenied;
  }

  /** Records a candidate point. Only GPS or the customer sets one; the default centre is never confirmable on its own. */
  #setPoint(p) {
    this.#picked = { lat: +p.lat, lng: +p.lng };
    this.#pin?.setLatLng(this.#picked);
    this.#confirm.disabled = false;
  }

  /** Creates the map and draggable pin on first use (tap or drag moves the pin), or recentres it later. */
  #initMap(L) {
    const loc = this.#app.data.location, t = this.#app.data.text;
    const start = this.#picked || { lat: loc.defaultCenter[0], lng: loc.defaultCenter[1] };
    if (!this.#map) {
      this.#map = L.map(this.querySelector('[data-sf-map]')).setView(start, loc.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(this.#map);
      this.#pin = L.marker(start, { draggable: true, autoPan: true, title: t.locPin, alt: t.locPin,
        icon: L.divIcon({ className: 'sf-pin', iconSize: [44, 48], iconAnchor: [22, 38] }) }).addTo(this.#map);
      this.#pin.on('dragend', () => this.#setPoint(this.#pin.getLatLng()));
      this.#map.on('click', e => this.#setPoint(e.latlng));
    } else if (this.#picked) { this.#map.setView(this.#picked, loc.zoom); this.#pin.setLatLng(this.#picked); }
    this.#map.invalidateSize(); // the map container was hidden until the dialog opened
  }

  /** Shows either the share button or the confirmed-pin row, and points "Mapa" at Google Maps. */
  #render() {
    const d = this.#delivery;
    this.#share.hidden = !!d;
    this.#set.hidden = !d;
    if (d) this.querySelector('[data-sf-loc-link]').href = mapsUrl(d);
  }
}

customElements.define('cart-bar', CartBar);
customElements.define('cart-dialog', CartDialog);
customElements.define('location-picker', LocationPicker);
