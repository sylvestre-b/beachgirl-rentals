// reveal.js — IntersectionObserver-based reveal-on-scroll
// Single-fire (once visible, stays visible). Respects prefers-reduced-motion
// via base.css overrides — animations become instant rather than disabled.

export function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  if (typeof IntersectionObserver === 'undefined') {
    // No IO support → just show everything
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.05,
  });

  els.forEach(el => observer.observe(el));

  // For data-reveal-children: each child should also reveal individually,
  // staggered via CSS delay. Mark them as reveal targets too.
  document.querySelectorAll('[data-reveal-children]').forEach(parent => {
    Array.from(parent.children).forEach(child => {
      if (!child.hasAttribute('data-reveal')) {
        child.setAttribute('data-reveal', '');
        observer.observe(child);
      }
    });
  });
}
