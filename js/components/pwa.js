/*
 * Installable-app chrome: <app-install> (the "Instalar App" button and the iOS "Agregar a Inicio" sheet)
 * and <offline-notice> (full-screen message while the device is offline). Business-agnostic: copy comes
 * from data.text through the `app` property set by js/app.js. The service worker (../../sw.js) only
 * swaps in offline.html for page loads that fail; nothing is cached for offline use.
 *
 * Install flow, mobile and tablets only, never once the site runs installed:
 *   Android / Chromium: the button appears only after 'beforeinstallprompt' and opens the native prompt.
 *   iOS / iPadOS: no install API, so the button opens a two-step "Share, then Agregar a inicio" sheet.
 *     iOS also never reports an install, so closing the sheet snoozes the button for later visits.
 */
import { esc } from '../utils.js';
import { cls } from '../ui.js';
import { storage } from '../store.js';

/** Order components dispatch this on document when they need the network and the device is offline. */
const OFFLINE = 'sf:offline';
const SNOOZE_MS = 30 * 864e5; // 30 days

/**
 * Which install path fits this browser: 'ios' (instructions sheet), 'prompt' (Chromium install prompt,
 * shown only if the browser offers it) or '' (no button: desktop, installed, or an in-app webview).
 * @param env { ua, uaData (navigator.userAgentData), touchPoints (navigator.maxTouchPoints), standalone }
 */
export function installMode({ ua = '', uaData, touchPoints = 0, standalone = false }) {
  if (standalone || /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|; wv\)/.test(ua)) return '';
  // iPadOS Safari reports a Mac; only the touch points tell them apart
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  // userAgentData.mobile is false on Android tablets, hence the platform check; it is blank when the UA
  // is overridden (DevTools device emulation), so fall back to the UA string then
  const mobile = uaData?.platform ? uaData.mobile || uaData.platform === 'Android' : /Android|iPhone|iPod/.test(ua);
  return mobile ? 'prompt' : '';
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// iOS Share glyph (square with an up arrow), drawn inline so the sheet matches what Safari shows
const SHARE = '<svg class="inline size-5 -mt-1 mx-0.5 align-middle text-[#007aff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 11H6v10h12V11h-2"/></svg>';

/**
 * <app-install>: sits in the header nav and renders a hidden button that shows only when installMode()
 * and the browser allow it. The iOS sheet is appended to <body>, outside the nav, so the mobile menu's
 * hidden state never hides it.
 */
class AppInstall extends HTMLElement {
  set app({ data }) {
    const t = data.text, store = storage(data.storageKey);
    const mode = installMode({ ua: navigator.userAgent, uaData: navigator.userAgentData, touchPoints: navigator.maxTouchPoints, standalone: standalone() });
    this.innerHTML = `<button type="button" class="ml-1 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-current px-4 py-2.5 text-[.95rem] leading-[normal] font-medium transition-colors duration-200 hover:bg-white/18 group-data-solid:hover:bg-soft max-nav:mx-0 max-nav:mt-2 max-nav:py-3.5" hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/></svg>${esc(t.install)}</button>`;
    const btn = this.firstElementChild;
    const hide = () => { btn.hidden = true; };
    addEventListener('appinstalled', hide);

    if (mode === 'prompt') {
      let deferred = null;
      addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; });
      btn.addEventListener('click', async () => {
        if (!deferred) return;
        deferred.prompt();
        await deferred.userChoice;
        // a prompt event works once; if the user said no, the browser may offer a fresh one later
        deferred = null; hide();
      });
    } else if (mode === 'ios') {
      const sheet = document.createElement('dialog');
      sheet.className = cls.dialog;
      sheet.setAttribute('aria-labelledby', 'sf-i-title');
      const step = 'flex gap-3 py-2.5 before:grid before:flex-none before:size-7 before:place-items-center before:rounded-full before:bg-tangerine before:text-[.9rem] before:font-bold before:content-[counter(step)] [counter-increment:step]';
      sheet.innerHTML = `<div class="${cls.sheet}">
          <div class="${cls.head}"><h2 class="${cls.title}" id="sf-i-title">${esc(t.iosTitle)}</h2>
            <button type="button" class="${cls.close} bg-soft" data-sf-close aria-label="${esc(t.close)}">×</button></div>
          <div class="${cls.body} ${cls.pad} pb-[calc(16px+env(safe-area-inset-bottom))]">
            <p class="${cls.hint} mb-1">${esc(t.iosIntro)}</p>
            <ol class="[counter-reset:step]">
              <li class="${step}"><span>${esc(t.iosShare).replace('{share}', SHARE)}</span></li>
              <li class="${step}"><span>${esc(t.iosAdd)}</span></li>
            </ol>
          </div>
        </div>`;
      document.body.append(sheet);
      sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-sf-close]')) sheet.close(); });
      sheet.addEventListener('close', () => store.set('install-hint', Date.now()));
      // Esc closes only the sheet: <site-header> would also close the mobile menu and strand focus
      sheet.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });
      btn.addEventListener('click', () => sheet.showModal());
      btn.hidden = Date.now() - store.get('install-hint', 0) < SNOOZE_MS;
    }
  }
}

/**
 * <offline-notice>: full-screen modal shown while the device is offline (on load, on the 'offline'
 * event, and when an order needs the network). It closes itself when the connection returns; Reintentar
 * reloads, which the service worker answers with offline.html while still offline. Esc also closes it,
 * so nobody is trapped; it comes back on the next offline event or order attempt.
 */
class OfflineNotice extends HTMLElement {
  set app({ data }) {
    const t = data.text;
    this.innerHTML = `<dialog class="m-0 size-full max-h-none max-w-none bg-bg p-(--gutter) text-ink open:grid open:place-items-center backdrop:bg-bg" role="alertdialog" aria-labelledby="sf-o-title" aria-describedby="sf-o-body">
        <div class="max-w-[24rem] text-center">
          <div class="relative mx-auto mb-6 grid size-24 place-items-center rounded-[26px] bg-tangerine">
            <svg class="size-15" viewBox="5 1.5 22 28" aria-hidden="true"><circle cx="16" cy="18" r="11" fill="#fff"/><path d="M16 7c0-3 2-5 5-5-1 3-2 5-5 5z" fill="#fff"/><path d="M10 15c1-3 4-4 6-4" stroke="var(--tangerine)" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
            <span class="absolute -right-2 -bottom-2 grid size-10 place-items-center rounded-full border-4 border-bg bg-ink text-white"><svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r=".8" fill="currentColor"/><path d="M3 3l18 18"/></svg></span>
          </div>
          <h2 class="text-[1.6rem] leading-[1.2] font-extrabold" id="sf-o-title">${esc(t.offlineTitle)}</h2>
          <p class="mt-3 text-muted" id="sf-o-body">${esc(t.offlineBody)}</p>
          <button type="button" class="${cls.btn} ${cls.btnLg} ${cls.btnPrimary} mt-7 w-full max-w-[16rem]" autofocus>${esc(t.retry)}</button>
          <p class="${cls.hint} mt-4">${esc(t.offlineAuto)}</p>
        </div>
      </dialog>`;
    const dialog = this.firstElementChild;
    const show = () => { if (!dialog.open) dialog.showModal(); };
    dialog.querySelector('button').addEventListener('click', () => (navigator.onLine ? dialog.close() : location.reload()));
    addEventListener('offline', show);
    addEventListener('online', () => dialog.close());
    document.addEventListener(OFFLINE, show);
    if (!navigator.onLine) show();
  }
}

customElements.define('app-install', AppInstall);
customElements.define('offline-notice', OfflineNotice);
