// reviews-page.js — renders the /reviews index. Was inline in
// reviews.html and silently CSP-blocked, leaving "Loading…" stuck.
// External module bypasses the inline-script CSP restriction.

import { loadAll, esc, renderStars } from '/js/data.js';
import { initForms } from '/js/forms.js';
import { initReveal } from '/js/reveal.js';
import { t } from '/js/i18n.js';

function safeT(key, fallback) {
  const v = t(key);
  return !v || v === key ? fallback : v;
}

(async () => {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  try {
    const state = await loadAll();

    if (!state.reviews.length) {
      grid.innerHTML = `
        <div class="reviews-empty">
          <p>No reviews yet — <em>be the first!</em></p>
          <p style="font-size:var(--sm);margin-top:1rem">
            ${safeT('reviews.empty', 'Reviews from our first season on this site are coming soon.')}
          </p>
        </div>`;
    } else {
      grid.innerHTML = state.reviews
        .map(
          r => `
          <div class="review-item">
            <div class="review-stars">${renderStars(r.rating || 5)}</div>
            <div class="review-body" style="margin:.6rem 0">"${esc(r.text)}"</div>
            <div class="review-header" style="margin-top:1rem">
              <div class="review-author-name">${esc(r.author)}</div>
              <div class="review-date">${esc(r.date || '')}</div>
            </div>
            <div style="font-size:var(--xs);color:var(--text-muted);margin-top:.2rem">
              ${esc(r.property || '')}
            </div>
          </div>`
        )
        .join('');
    }

    try {
      initForms(state);
    } catch (e) {
      console.warn('[reviews] initForms failed', e);
    }
    try {
      initReveal();
    } catch (e) {
      console.warn('[reviews] initReveal failed', e);
    }
  } catch (e) {
    console.error('[reviews] page init failed', e);
    grid.innerHTML = `<p class="reviews-empty">Couldn't load reviews right now. Refresh in a moment.</p>`;
  }
})();
