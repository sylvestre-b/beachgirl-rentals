// main.js — application entry, event delegation, page-glue logic
// All listeners are attached programmatically. No inline `onclick=` survives.

import { loadAll, esc, renderStars } from './data.js';
import { initListings, toggleAvail }  from './listings.js';
import { initForms, openInquiryModal, closeModal } from './forms.js';
import { initMap, updateMapHighlights } from './map.js';
import { initReveal } from './reveal.js';
import { initHero }   from './hero.js';

// Reviews carousel state
let _reviews = [];
let _reviewOffset = 0;
const CARDS_VISIBLE = () => window.innerWidth < 640 ? 1
                          : window.innerWidth < 900 ? 2 : 3;

(async function boot() {
  // Hero motion runs immediately so the hero feels alive even before data loads
  initHero();

  const state = await loadAll();
  _reviews = state.reviews;

  initListings(state);
  initForms(state);
  initMap(state.properties);
  renderReviewsTeaser(state.reviews);
  renderBlogTeaser(state.posts);

  initReveal();
  wireGlobalEvents();
  wireFilterBarVisibility();
})();

function wireGlobalEvents() {
  // Single delegated click handler for the whole document
  document.addEventListener('click', e => {
    // Avail toggle
    const tog = e.target.closest('.avail-toggle, [data-action="toggle-avail"]');
    if (tog) { e.stopPropagation(); toggleAvail(tog); return; }

    // Inquire button inside a card → open modal w/ the property
    const inquireBtn = e.target.closest('[data-action="card-inquire"]');
    if (inquireBtn) {
      e.stopPropagation();
      const slug = inquireBtn.getAttribute('data-slug');
      openInquiryModal(slug);
      return;
    }

    // Reset filters from empty state link
    const reset = e.target.closest('[data-action="reset-filters"]');
    if (reset) {
      e.preventDefault();
      const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
      if (allBtn) allBtn.click();
      return;
    }

    // Card body click → property page
    const card = e.target.closest('.card');
    if (card && !e.target.closest('.avail-section')) {
      const s = card.dataset.slug;
      if (s) window.location.href = '/property/' + encodeURIComponent(s);
    }

    // "See what's available" smooth-scroll
    const seeBtn = e.target.closest('[data-action="scroll-to-listings"]');
    if (seeBtn) {
      const el = document.getElementById('listings');
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 62;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    // Reviews carousel
    if (e.target.matches('[data-action="carousel-prev"]')) slideReviews(-1);
    if (e.target.matches('[data-action="carousel-next"]')) slideReviews(1);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.card');
      if (card && e.target === card) {
        e.preventDefault();
        const s = card.dataset.slug;
        if (s) window.location.href = '/property/' + encodeURIComponent(s);
      }
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

  // Cross-component: when listings are filtered, sync map markers
  document.addEventListener('listings:filtered', e => {
    updateMapHighlights(e.detail.filtered);
  });

  // Window resize for carousel button state
  window.addEventListener('resize', updateCarouselButtons);
}

// ── REVIEWS TEASER (homepage) ───────────────────────────────────────
function renderReviewsTeaser(reviews) {
  const track = document.getElementById('reviews-track');
  if (!track) return;
  if (!reviews.length) {
    track.innerHTML = `<div style="padding:2rem;color:var(--text-muted)">
      No reviews yet — be the first!
    </div>`;
    return;
  }
  track.innerHTML = reviews.map(r => `
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
    </div>`).join('');
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
  const cardW = (cards[0]?.offsetWidth || 320) + 28; // gap = 1.75rem ≈ 28px
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

// ── BLOG TEASER ─────────────────────────────────────────────────────
function renderBlogTeaser(posts) {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  if (!posts.length) { grid.style.display = 'none'; return; }
  const top = posts.slice(0, 2);
  grid.innerHTML = top.map(p => `
    <article class="blog-card" role="listitem" tabindex="0"
             data-href="/blog/${esc(p._slug)}" aria-label="${esc(p.title)}"
             data-reveal>
      <div class="blog-card-img" aria-hidden="true">
        ${p.photo
          ? `<img src="${esc(p.photo)}" alt="" loading="lazy" />`
          : `<span>${esc(p.emoji || '📝')}</span>`}
      </div>
      <div class="blog-card-body">
        <time class="blog-card-date">${esc(p.date || '')}</time>
        <h3 class="blog-card-title">${esc(p.title)}</h3>
        <p class="blog-card-excerpt">${esc(p.excerpt || '')}</p>
      </div>
    </article>`).join('');

  grid.querySelectorAll('.blog-card').forEach(c => {
    c.addEventListener('click', () => { window.location.href = c.dataset.href; });
  });
}

// ── FILTER BAR VISIBILITY (sticky bar hides outside listings range) ──
function wireFilterBarVisibility() {
  const filterBar = document.querySelector('.filter-bar');
  const listingsSection = document.getElementById('listings');
  const reviewsSection  = document.getElementById('reviews');
  if (!filterBar || !listingsSection || !reviewsSection) return;

  function update() {
    const lr = listingsSection.getBoundingClientRect();
    const rr = reviewsSection.getBoundingClientRect();
    const inListings = lr.top <= 130 && rr.top > 130;
    filterBar.classList.toggle('hidden', !inListings);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ── IMAGE FALLBACK ──────────────────────────────────────────────────
document.addEventListener('error', e => {
  if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
    const ph = e.target.closest('.card-photo, .gallery-slide, .blog-card-img');
    if (ph) {
      const d = document.createElement('div');
      d.className = ph.className.includes('card-photo')
        ? 'card-photo-placeholder'
        : 'gallery-placeholder';
      d.setAttribute('aria-hidden', 'true');
      d.textContent = '🏡';
      e.target.replaceWith(d);
    }
  }
}, true);
