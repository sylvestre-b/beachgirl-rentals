// main.js — application entry, event delegation, page-glue logic
// All listeners are attached programmatically. No inline `onclick=` survives.

import { loadAll, esc, renderStars } from './data.js';
import { initListings, toggleAvail } from './listings.js';
import { initForms, openInquiryModal, closeModal } from './forms.js';
import { initMap, updateMapHighlights } from './map.js';
import { initReveal } from './reveal.js';
import { initHero } from './hero.js';
import { t } from './i18n.js';

// Reviews carousel state
let _reviewOffset = 0;
const CARDS_VISIBLE = () => (window.innerWidth < 640 ? 1 : window.innerWidth < 900 ? 2 : 3);

// How many "Local Guide" posts to show on the home page teaser. Was 2 — the
// section looked sparse. 4 fills the row on desktop without overflowing.
const HOME_GUIDE_POSTS = 4;

(async function boot() {
  initHero();

  const state = await loadAll();

  if (state.listingsLoadError) {
    const grid = document.getElementById('listings-grid');
    const empty = document.getElementById('listings-empty');
    if (grid) grid.innerHTML = '';
    if (empty) {
      const p = empty.querySelector('[data-i18n="listings.no_match"]');
      if (p) p.setAttribute('data-i18n', 'listings.error');
      const btn = empty.querySelector('[data-action="reset-filters"]');
      if (btn) btn.hidden = true;
      empty.hidden = false;
    }
  }

  initListings(state);
  initForms(state);
  initMap(state.properties);
  renderReviewsTeaser(state.reviews);
  renderBlogTeaser(state.posts);

  initReveal();
  wireGlobalEvents();
  wireFilterBarVisibility();
  wireMapToggleVisibility();
})();

function wireGlobalEvents() {
  document.addEventListener('click', e => {
    const tog = e.target.closest('.avail-toggle, [data-action="toggle-avail"]');
    if (tog) {
      e.stopPropagation();
      toggleAvail(tog);
      return;
    }

    const inquireBtn = e.target.closest('[data-action="card-inquire"]');
    if (inquireBtn) {
      e.stopPropagation();
      const slug = inquireBtn.getAttribute('data-slug');
      openInquiryModal(slug);
      return;
    }

    const reset = e.target.closest('[data-action="reset-filters"]');
    if (reset) {
      e.preventDefault();
      const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
      if (allBtn) allBtn.click();
      return;
    }

    const seeBtn = e.target.closest('[data-action="scroll-to-listings"]');
    if (seeBtn) {
      const el = document.getElementById('listings');
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 62;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    if (e.target.matches('[data-action="carousel-prev"]')) slideReviews(-1);
    if (e.target.matches('[data-action="carousel-next"]')) slideReviews(1);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const blog = e.target.closest('.blog-card');
      if (blog && e.target === blog) {
        e.preventDefault();
        const href = blog.dataset.href;
        if (href) window.location.href = href;
      }
    }
    if (e.key === 'Escape') {
      closeModal('inquiry-overlay');
      closeModal('review-overlay');
    }
  });

  document.addEventListener('listings:filtered', e => {
    updateMapHighlights(e.detail.filtered);
  });

  window.addEventListener('resize', updateCarouselButtons);
}

// ── REVIEWS TEASER ─────────────────────────────────────────────────────
function renderReviewsTeaser(reviews) {
  const track = document.getElementById('reviews-track');
  if (!track) return;
  if (!reviews.length) {
    track.innerHTML = `<p style="padding:2rem;color:var(--text-muted);text-align:center;width:100%">${
      safeT('reviews.empty', 'No reviews yet — be the first!')
    }</p>`;
    return;
  }
  track.innerHTML = reviews
    .map(
      r => `
    <div class="review-card" role="listitem">
      <div class="review-stars" aria-label="${r.rating || 5} stars">${renderStars(r.rating || 5)}</div>
      <blockquote class="review-text">${esc(r.text)}</blockquote>
      <div class="review-meta">
        <div>
          <div class="review-author">${esc(r.author)}</div>
          <div class="review-property">${esc(r.property)}</div>
        </div>
        <time class="review-date">${esc(r.date || '')}</time>
      </div>
    </div>`
    )
    .join('');
  updateCarouselButtons();
}

function slideReviews(dir) {
  const track = document.getElementById('reviews-track');
  if (!track) return;
  const cards = track.querySelectorAll('.review-card');
  if (!cards.length) return;
  const visible = CARDS_VISIBLE();
  const maxOffset = Math.max(0, cards.length - visible);
  _reviewOffset = Math.min(maxOffset, Math.max(0, _reviewOffset + dir));
  const cardW = (cards[0]?.offsetWidth || 320) + 28;
  track.style.transform = `translateX(-${_reviewOffset * cardW}px)`;
  updateCarouselButtons();
}

function updateCarouselButtons() {
  const track = document.getElementById('reviews-track');
  if (!track) return;
  const cards = track.querySelectorAll('.review-card');
  if (!cards.length) return;
  const visible = CARDS_VISIBLE();
  const prev = document.querySelector('[data-action="carousel-prev"]');
  const next = document.querySelector('[data-action="carousel-next"]');
  if (prev) prev.disabled = _reviewOffset === 0;
  if (next) next.disabled = _reviewOffset >= cards.length - visible;
}

// ── LOCAL GUIDE TEASER ─────────────────────────────────────────────────
function renderBlogTeaser(posts) {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  if (!posts.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);text-align:center;padding:2rem">${
      safeT('journal.empty', 'No posts yet — check back soon.')
    }</p>`;
    return;
  }
  const top = posts.slice(0, HOME_GUIDE_POSTS);
  grid.innerHTML = top
    .map(
      p => `
    <article class="blog-card" role="listitem" tabindex="0"
             data-href="/blog/${esc(p._slug)}/" aria-label="${esc(p.title)}"
             data-reveal>
      <div class="blog-card-img" aria-hidden="true">
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

  grid.querySelectorAll('.blog-card').forEach(c => {
    c.addEventListener('click', () => {
      window.location.href = c.dataset.href;
    });
  });
}

// ── FILTER BAR VISIBILITY ─────────────────────────────────────────────
// Show/hide the sticky filter bar based on whether the user is currently
// looking at the listings range. Hardened: runs on load AND scroll AND
// resize so the initial state is always correct.
function wireFilterBarVisibility() {
  const filterBar = document.querySelector('.filter-bar');
  const listingsSection = document.getElementById('listings');
  const reviewsSection = document.getElementById('reviews');
  if (!filterBar || !listingsSection) return;

  function update() {
    const lr = listingsSection.getBoundingClientRect();
    const reviewsTop = reviewsSection
      ? reviewsSection.getBoundingClientRect().top
      : Number.POSITIVE_INFINITY;
    // Visible when the listings header is past the top of the viewport
    // (with a 130px buffer for the sticky header) AND we haven't scrolled
    // past into the reviews section yet.
    const inListings = lr.top <= 130 && reviewsTop > 130;
    filterBar.classList.toggle('hidden', !inListings);
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  // Run once on the next frame so layout has settled.
  requestAnimationFrame(update);
}

// ── MAP FAB VISIBILITY ─────────────────────────────────────────────────
// Mirror the filter-bar logic: the "Show Map" floating button only appears
// while the user is in the listings range (between the listings section
// top and the reviews section). Hides while in the hero, the owner panel,
// or below the reviews section.
function wireMapToggleVisibility() {
  const fab = document.getElementById('map-toggle');
  const listingsSection = document.getElementById('listings');
  const reviewsSection = document.getElementById('reviews');
  if (!fab || !listingsSection) return;

  function update() {
    const lr = listingsSection.getBoundingClientRect();
    const reviewsBottom = reviewsSection
      ? reviewsSection.getBoundingClientRect().bottom
      : Number.POSITIVE_INFINITY;
    // Show when listings has scrolled to within 200px of the top of the
    // viewport AND the reviews section bottom is still on/below the screen.
    const visible =
      lr.top <= window.innerHeight - 100 &&
      lr.bottom > 0 &&
      reviewsBottom > 0;
    // If the fullscreen mobile map is open we never hide the FAB —
    // it becomes the close button.
    const mapOpen = document.getElementById('map-panel')?.classList.contains('mobile-open');
    fab.classList.toggle('fab-hidden', !visible && !mapOpen);
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  requestAnimationFrame(update);
}

// ── IMAGE FALLBACK ──────────────────────────────────────────────────
// Single delegated error handler. Replaces every inline onerror= we had
// scattered through the markup (which would have broken under a strict CSP).
//   data-fallback="hero"           → remove the broken hero image
//   data-fallback="owner-portrait" → swap to the polaroid placeholder span
//   data-fallback="blog"           → swap to the emoji span sibling
//   data-fallback="true"           → existing card-photo replacement (legacy)
document.addEventListener(
  'error',
  e => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    const kind = img.dataset.fallback;
    if (!kind) return;

    if (kind === 'hero') {
      img.style.display = 'none';
      return;
    }

    if (kind === 'owner-portrait') {
      img.style.display = 'none';
      const fb = img.parentElement?.querySelector('.owner-portrait-fallback');
      if (fb) fb.style.display = 'flex';
      return;
    }

    if (kind === 'blog') {
      const wrap = img.closest('.blog-card-img');
      if (wrap) {
        wrap.innerHTML = '<span>📝</span>';
      }
      return;
    }

    // Legacy: card-photo / gallery-slide replacement
    const ph = img.closest('.card-photo, .gallery-slide, .blog-card-img');
    if (ph) {
      const d = document.createElement('div');
      d.className = ph.className.includes('card-photo')
        ? 'card-photo-placeholder'
        : 'gallery-placeholder';
      d.setAttribute('aria-hidden', 'true');
      d.textContent = '🏡';
      img.replaceWith(d);
    }
  },
  true
);

// ── i18n SAFE GETTER ─────────────────────────────────────────────────
// Bug fix: the existing t() returns the literal key string when the dict
// hasn't loaded yet (e.g. "reviews.empty"). That string is truthy, so
// `t('x') || fallback` falls through with the wrong value showing.
// safeT() detects the "key === lookup" miss-case and returns the fallback.
function safeT(key, fallback) {
  const v = t(key);
  return !v || v === key ? fallback : v;
}
