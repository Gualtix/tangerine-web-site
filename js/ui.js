/*
 * Shared UI helpers for the components: Tailwind class sets, icons, the quantity stepper and dialog
 * wiring. Business-agnostic, and defines no custom elements.
 *
 * Accessibility: dialogs are native <dialog> opened with showModal(), which gives a focus trap, Esc to
 * close and focus returning to the opener for free. Controls are labelled, and every touch target is
 * 44px or more (min-h-11 / size-11).
 */
import { esc } from './utils.js';

/*
 * Tailwind class sets reused across component templates. Each set leaves out the properties its
 * variants change (size, colour, padding), so combining sets never produces two conflicting utilities.
 */
export const cls = {
  // button shell; add one size and one colour below
  btn: 'inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-[1.2] no-underline cursor-pointer transition-[scale,filter] duration-150 hover:brightness-106 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
  btnMd: 'min-h-11 px-5 text-[.95rem]',
  btnLg: 'min-h-[52px] px-5 text-base',
  btnPrimary: 'bg-tangerine text-ink',
  btnWa: 'bg-wa text-white',
  btnOutline: 'bg-white text-ink border-[1.5px] border-ink',
  // secondary pill button ("Cambiar", "Eliminar", "Mapa"); add a padding and one tone
  link: 'inline-flex items-center justify-center min-h-11 border-[1.5px] rounded-full bg-white text-[.9rem] font-semibold whitespace-nowrap no-underline cursor-pointer transition-[background-color,border-color] duration-200 hover:bg-soft active:scale-[.97]',
  linkNeutral: 'text-ink border-line hover:border-ink',
  linkDanger: 'text-burnt-d border-burnt-d/35 hover:border-burnt-d',
  linkWa: 'text-wa border-wa',
  // round × close button; add a background
  close: 'flex-none size-11 rounded-full text-ink text-[1.6rem] leading-none cursor-pointer',
  // dialog: bottom sheet on mobile, centred card from 640px; flex only while open so a closed dialog stays hidden
  dialog: 'm-auto mb-0 w-full max-w-full max-h-[92dvh] overflow-hidden rounded-t-card bg-white text-ink open:flex open:flex-col backdrop:bg-[rgba(20,15,10,.6)] sm:mb-auto sm:max-w-[460px] sm:max-h-[88vh] sm:rounded-card',
  sheet: 'flex-1 min-h-0 flex flex-col', // header / scrolling body / footer column
  body: 'flex-1 min-h-0 overflow-y-auto overscroll-contain', // the only scrolling part of a sheet
  pad: 'px-5 py-4',
  head: 'flex items-center justify-between gap-3 py-2.5 pr-3 pl-5 border-b border-line',
  title: 'text-[1.2rem] font-bold leading-[1.3]',
  foot: 'flex flex-wrap items-center gap-x-3 gap-y-2.5 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] border-t border-line bg-white',
  hint: 'text-[.85rem] text-muted',
  field: 'block mt-3',
  label: 'block text-[.85rem] font-semibold mb-1',
  // text-base (16px) keeps iOS from zooming into the field
  input: 'w-full min-h-12 px-3.5 py-3 border-[1.5px] border-line rounded-xl bg-white text-ink text-base leading-[1.4] resize-y focus:outline-none focus:border-ink focus:ring-3 focus:ring-tangerine/50'
};

const ICONS = {
  wa: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
};

/** Decorative 20px line icon ('wa' or 'pin'); extra classes tint or nudge it. */
export const icon = (name, extra = '') =>
  `<svg class="size-5 flex-none ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/**
 * Quantity stepper markup: − output +. Buttons carry data-sf-step="-1|1" for the caller's click handler,
 * disable at the limits, and the output is aria-live so the new value is announced.
 * @param t  copy with quantity, decrease and increase labels
 */
export const stepper = (t, qty, max) => {
  const b = 'size-11 rounded-full text-ink text-[1.3rem] cursor-pointer disabled:opacity-35 disabled:cursor-default';
  return `<div class="flex-none inline-flex items-center border-[1.5px] border-line rounded-full" data-sf-qty role="group" aria-label="${esc(t.quantity)}">
      <button type="button" class="${b}" data-sf-step="-1" aria-label="${esc(t.decrease)}"${qty <= 1 ? ' disabled' : ''}>−</button>
      <output class="min-w-[2ch] text-center font-bold" aria-live="polite">${qty}</output>
      <button type="button" class="${b}" data-sf-step="1" aria-label="${esc(t.increase)}"${qty >= max ? ' disabled' : ''}>+</button></div>`;
};

/**
 * Closes a dialog on a backdrop click or on any [data-sf-close] button inside it. The closest('dialog')
 * check keeps a close button in a nested dialog from also closing its parent. Esc is native.
 */
export const wireDialog = dialog => dialog.addEventListener('click', e => {
  if (e.target === dialog || (e.target.closest('[data-sf-close]') && e.target.closest('dialog') === dialog)) dialog.close();
});
