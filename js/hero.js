// hero.js — Ken Burns cross-fade between hero images + subtle FG parallax
// Reads markup like:
//   .hero-img-stack > img.hero-img[data-hero-img]   (any number)
//   .hero-fg                                         (foreground SVG, optional)
//
// First image starts active; if a second exists, it fades in at FADE_AT.

const FADE_AT     = 6500;  // ms — cross-fade kicks in

export function initHero() {
  const stack = document.querySelector('.hero-img-stack');
  if (!stack) return;
  const slides = Array.from(stack.querySelectorAll('.hero-img'));
  if (!slides.length) return;

  // Reduced motion: just show first, no animation
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    slides[0].classList.add('is-visible-static');
    slides[0].style.opacity = '1';
    slides[0].style.animation = 'none';
    return;
  }

  // Show the first slide
  slides[0].classList.add('is-active');

  // Cross-fade if there's a second
  if (slides.length > 1) {
    setTimeout(() => {
      slides[0].classList.remove('is-active');
      slides[1].classList.add('is-active');
    }, FADE_AT);
  }

  // Foreground parallax on mouse move (desktop only)
  const fg = document.querySelector('.hero-fg');
  if (fg && window.matchMedia('(pointer: fine)').matches) {
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.addEventListener('mousemove', e => {
        const rect = hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 .. 0.5
        const offset = (x * 12).toFixed(1);  // ±6px
        fg.style.setProperty('--fg-x', `${offset}px`);
      });
      hero.addEventListener('mouseleave', () => {
        fg.style.setProperty('--fg-x', '0px');
      });
    }
  }
}
