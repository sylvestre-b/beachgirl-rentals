// blog-page.js — renders the /blog index. Was an inline module in
// blog.html, but inline scripts are blocked by our public CSP
// (script-src 'self' https://unpkg.com, no 'unsafe-inline'). That
// block silently failed and left the page stuck on "Loading…".
// Moving it to an external module fixes the load.

import { loadAll, esc } from '/js/data.js';
import { initReveal } from '/js/reveal.js';
import { t } from '/js/i18n.js';

function safeT(key, fallback) {
  const v = t(key);
  return !v || v === key ? fallback : v;
}

(async () => {
  const list = document.getElementById('blog-list');
  if (!list) return;

  try {
    const { posts } = await loadAll();

    if (!posts || !posts.length) {
      list.innerHTML = `<p class="blog-empty">${safeT(
        'journal.empty',
        'No posts yet — check back soon.'
      )}</p>`;
    } else {
      list.innerHTML = posts
        .map(
          p => `
            <article class="blog-card" tabindex="0" data-href="/blog/${esc(p._slug)}/">
              <div class="blog-card-img">
                ${
                  p.photo
                    ? `<img src="${esc(p.photo)}" alt="" loading="lazy" data-fallback="blog" />`
                    : `<span>${esc(p.emoji || '📝')}</span>`
                }
              </div>
              <div class="blog-card-body">
                <time class="blog-card-date">${esc(p.date || '')}</time>
                <h3 class="blog-card-title">${esc(p.title)}</h3>
                <p class="blog-card-excerpt">${esc(p.excerpt || '')}</p>
              </div>
            </article>`
        )
        .join('');

      list.querySelectorAll('.blog-card').forEach(c => {
        c.addEventListener('click', () => {
          window.location.href = c.dataset.href;
        });
        c.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = c.dataset.href;
          }
        });
      });
    }

    try {
      initReveal();
    } catch (e) {
      console.warn('[blog] initReveal failed', e);
    }
  } catch (e) {
    console.error('[blog] page init failed', e);
    list.innerHTML = `<p class="blog-empty">${safeT(
      'journal.error',
      "Couldn't load posts right now. Refresh in a moment."
    )}</p>`;
  }
})();
