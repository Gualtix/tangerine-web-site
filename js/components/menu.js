/*
 * Business-specific menu journey (browse and customise): <menu-catalog> and <product-dialog>.
 * Replace this file, order.js and data.js for a different kind of business.
 *
 * Data flow: data.products -> catalog cards -> "Ordenar ahora" -> 'sf:product' event -> product dialog
 *   draft { p, qty, edit } -> store.add / store.update -> cart line { id, qty, removed[] }.
 * Both elements render once js/app.js sets their `app` property ({ data, store, fmt, byId }).
 */
import { esc, clamp } from '../utils.js';
import { cls, icon, stepper, wireDialog } from '../ui.js';

/** Event that asks <product-dialog> to open: detail { id, edit } where edit is a cart line index or null. */
const OPEN = 'sf:product';

/**
 * <menu-catalog>: the WhatsApp ordering notice plus one card per product. "Ordenar ahora" dispatches
 * 'sf:product' so the dialog can live anywhere in the page.
 */
class MenuCatalog extends HTMLElement {
  set app({ data, fmt }) {
    const t = data.text;
    this.innerHTML = `
      <p class="flex items-start gap-3 mt-1 mb-6 px-4 py-3.5 rounded-xl border-l-4 border-wa bg-soft text-[.95rem] leading-normal">${icon('wa', 'text-wa mt-px')}<span><strong>${esc(t.noticeTitle)}</strong> ${esc(t.noticeBody)}</span></p>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 max-phone:grid-cols-1 max-phone:gap-3">${data.products.map(p => `
        <li><article class="h-full flex flex-col overflow-hidden rounded-card border-[1.5px] border-line bg-white max-phone:grid max-phone:grid-cols-[104px_1fr]">
          <img class="block w-full h-auto aspect-[4/3] object-cover max-phone:h-full max-phone:aspect-auto" src="${esc(p.image)}" alt="" loading="lazy" width="400" height="300">
          <div class="flex-1 flex flex-col gap-1 min-w-0 px-4 pt-3.5 pb-4 max-phone:p-3">
            <span class="text-[.72rem] font-semibold tracking-[.08em] uppercase text-muted">${esc(p.category)}</span>
            <h3 class="text-[1.05rem] font-bold leading-[1.3]">${esc(p.name)}</h3>
            <p class="text-[.9rem] leading-[1.45] text-muted max-phone:line-clamp-2">${esc(p.description)}</p>
            <div class="flex items-center justify-between gap-2 mt-auto pt-2.5">
              <span class="font-bold text-[1.05rem] whitespace-nowrap">${fmt(p.price)}</span>
              <button type="button" class="${cls.btn} ${cls.btnMd} ${cls.btnPrimary} max-phone:px-4" data-sf-add="${esc(p.id)}" aria-label="${esc(t.orderNow)}: ${esc(p.name)}">${esc(t.orderNow)}</button>
            </div>
          </div>
        </article></li>`).join('')}
      </ul>`;
  }

  connectedCallback() {
    this.addEventListener('click', e => {
      const btn = e.target.closest('[data-sf-add]');
      if (btn) this.dispatchEvent(new CustomEvent(OPEN, { bubbles: true, detail: { id: btn.dataset.sfAdd, edit: null } }));
    });
  }
}

/**
 * <product-dialog>: product image, description, removable ingredients (checked = included) and a
 * quantity stepper. Adds a new cart line, or, when opened with `edit`, prefills from that line and
 * Save replaces it. Announces the result in its aria-live region.
 */
class ProductDialog extends HTMLElement {
  #app; #draft = null; #dialog; #form; #live;

  set app(app) {
    this.#app = app;
    this.innerHTML = `<dialog class="${cls.dialog}" aria-labelledby="sf-p-name"><form class="${cls.sheet}" novalidate></form></dialog>
      <p class="sr-only" aria-live="polite"></p>`;
    this.#dialog = this.querySelector('dialog');
    this.#form = this.#dialog.firstElementChild;
    this.#live = this.querySelector('[aria-live]');
    wireDialog(this.#dialog);
    this.#form.addEventListener('click', e => this.#step(e));
    this.#form.addEventListener('submit', e => this.#submit(e));
    document.addEventListener(OPEN, e => this.open(e.detail.id, e.detail.edit));
  }

  /** Opens the dialog for product `id`; `edit` is the index of the cart line being changed, or null for a new line. */
  open(id, edit = null) {
    const { data, store, fmt, byId } = this.#app, t = data.text;
    const p = byId.get(id);
    if (!p) return;
    const line = edit === null ? null : store.lines[edit];
    this.#draft = { p, qty: line ? line.qty : 1, edit };
    const ing = p.ingredients || [];
    this.#form.innerHTML = `
      <button type="button" class="${cls.close} absolute top-2.5 right-2.5 z-1 bg-white/92" data-sf-close aria-label="${esc(t.close)}">×</button>
      <div class="${cls.body}">
        <img class="block w-full h-auto aspect-video max-h-[30vh] object-cover" src="${esc(p.image)}" alt="" width="600" height="338">
        <div class="${cls.pad}">
          <h2 class="${cls.title}" id="sf-p-name">${esc(p.name)}</h2>
          <p class="mt-1 text-[.95rem] text-muted">${esc(p.description)}</p>
          ${ing.length ? `<fieldset class="mt-4 min-w-0"><legend class="font-bold">${esc(t.ingredients)}</legend>
            <p class="${cls.hint} mt-0.5 mb-2">${esc(t.ingredientsHint)}</p>
            <div class="grid grid-cols-2 gap-2">${ing.map(i => `<label class="flex items-center gap-2.5 min-h-11 px-3 py-1.5 rounded-xl border-[1.5px] border-line text-[.92rem] leading-[1.25] cursor-pointer has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ink"><input class="peer flex-none size-5 accent-wa" type="checkbox" name="ing" value="${esc(i)}"${line?.removed.includes(i) ? '' : ' checked'}><span class="line-through text-muted peer-checked:no-underline peer-checked:text-ink">${esc(i)}</span></label>`).join('')}</div>
          </fieldset>` : ''}
        </div>
      </div>
      <div class="${cls.foot}">
        ${stepper(t, this.#draft.qty, data.maxQty)}
        <button type="submit" class="${cls.btn} ${cls.btnMd} ${cls.btnPrimary} flex-1">${esc(line ? t.save : t.add)} · <span data-sf-p-total>${fmt(p.price * this.#draft.qty)}</span></button>
      </div>`;
    this.#dialog.showModal();
  }

  /** Stepper click: changes the draft quantity and re-renders the stepper and the button total. */
  #step(e) {
    const step = e.target.closest('[data-sf-step]');
    if (!step) return;
    const { data, fmt } = this.#app, draft = this.#draft, form = this.#form;
    draft.qty = clamp(draft.qty + Number(step.dataset.sfStep), 1, data.maxQty);
    form.querySelector('[data-sf-qty]').outerHTML = stepper(data.text, draft.qty, data.maxQty);
    form.querySelector('[data-sf-p-total]').textContent = fmt(draft.p.price * draft.qty);
    // keep focus inside the stepper even when the pressed button just became disabled
    (form.querySelector(`[data-sf-step="${step.dataset.sfStep}"]:not(:disabled)`) || form.querySelector('[data-sf-qty] button:not(:disabled)'))?.focus();
  }

  /** Add / Save: writes the line to the store, closes, hands focus back to the cart when editing, and announces. */
  #submit(e) {
    e.preventDefault();
    const { data, store, fmt } = this.#app, t = data.text, draft = this.#draft;
    const removed = [...this.#form.querySelectorAll('input[name="ing"]:not(:checked)')].map(i => i.value);
    if (draft.edit === null) store.add(draft.p.id, draft.qty, removed);
    else store.update(draft.edit, draft.qty, removed);
    this.#dialog.close();
    // the Edit button that opened the dialog was re-rendered, so <cart-dialog> moves focus back by hand
    if (draft.edit !== null) this.dispatchEvent(new CustomEvent('sf:line-saved', { bubbles: true, detail: { index: draft.edit } }));
    this.#live.textContent = `${draft.edit === null ? t.added : t.updated}:${draft.qty} × ${draft.p.name}. ${t.itemsLabel(store.count())}, ${fmt(store.total())}.`;
  }
}

customElements.define('menu-catalog', MenuCatalog);
customElements.define('product-dialog', ProductDialog);
