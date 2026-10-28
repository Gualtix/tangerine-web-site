/*
 * Generic landing chrome. These elements enhance markup that already sits in index.html (progressive
 * enhancement: the page reads and indexes without JavaScript), so nothing here knows what the business
 * sells. Light DOM only, so Tailwind classes and the :root tokens reach the markup.
 *
 *   <site-header>     transparent over the hero, solid after scrolling; mobile menu toggle
 *   <dish-marquee>    duplicates its track for a seamless CSS loop
 *   <review-carousel> prev/next buttons for a scroll-snap row
 *   <reserve-form>    front-end-only reservation demo (no booking is made)
 *   revealOnScroll()  fades .rv elements in as they enter the viewport
 */

/**
 * <site-header>: wraps the page <header>. Sets [data-solid] on it once the page scrolls past 60px or the
 * mobile menu is open, and toggles the menu ([data-open] on the nav named by the burger's aria-controls).
 * Link clicks and Esc close the menu.
 */
class SiteHeader extends HTMLElement {
  connectedCallback() {
    const bar = this.querySelector('header');
    const burger = this.querySelector('[aria-controls]');
    const links = this.querySelector('#' + burger.getAttribute('aria-controls'));
    const onScroll = () => bar.toggleAttribute('data-solid', scrollY > 60);
    const setMenu = open => {
      links.toggleAttribute('data-open', open);
      burger.setAttribute('aria-expanded', open);
      bar.toggleAttribute('data-solid', open || scrollY > 60);
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    burger.addEventListener('click', () => setMenu(!links.hasAttribute('data-open')));
    links.addEventListener('click', e => e.target.closest('a') && setMenu(false));
    addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));
  }
}

/**
 * <dish-marquee>: its first child is the track. Appends a copy of the items (aria-hidden, so screen
 * readers hear each dish once) so the CSS `marquee` animation can slide by half and loop seamlessly.
 */
class DishMarquee extends HTMLElement {
  connectedCallback() {
    const track = this.firstElementChild;
    track.innerHTML += track.innerHTML;
    [...track.children].slice(track.children.length / 2).forEach(el => el.setAttribute('aria-hidden', 'true'));
  }
}

/** <review-carousel>: [data-prev] / [data-next] scroll the [data-slides] row by one card plus its 20px gap. */
class ReviewCarousel extends HTMLElement {
  connectedCallback() {
    const slides = this.querySelector('[data-slides]');
    const step = () => slides.firstElementChild.getBoundingClientRect().width + 20;
    this.querySelector('[data-next]').addEventListener('click', () => slides.scrollBy({ left: step(), behavior: 'smooth' }));
    this.querySelector('[data-prev]').addEventListener('click', () => slides.scrollBy({ left: -step(), behavior: 'smooth' }));
  }
}

/**
 * <reserve-form>: wraps a form with date, time and people fields and a [role=status] message. Defaults
 * the date to today (also the minimum), rejects past dates and shows a demo availability message.
 * Copy and locale come from the `app` property set by js/app.js.
 */
class ReserveForm extends HTMLElement {
  #app;
  set app(app) { this.#app = app; }

  connectedCallback() {
    const form = this.querySelector('form'), { date, time, people } = form.elements;
    const msg = form.querySelector('[role="status"]');
    const today = new Date().toISOString().slice(0, 10);
    date.min = today; date.value = today;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const { locale, text: t } = this.#app.data;
      const bad = !date.value || date.value < today;
      msg.toggleAttribute('data-error', bad);
      if (bad) { msg.textContent = t.reserveInvalid; date.focus(); return; }
      msg.textContent = t.reserveFound(people.value, new Date(date.value + 'T00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long' }), time.value);
    });
  }
}

/** Adds .in to each .rv element the first time 15% of it is visible (see styles.css), then stops watching it. */
export function revealOnScroll() {
  const io = new IntersectionObserver(es => es.forEach(x => x.isIntersecting && (x.target.classList.add('in'), io.unobserve(x.target))), { threshold: .15 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
}

customElements.define('site-header', SiteHeader);
customElements.define('dish-marquee', DishMarquee);
customElements.define('review-carousel', ReviewCarousel);
customElements.define('reserve-form', ReserveForm);
