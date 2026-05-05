// listings.js — render the home grid + filter behaviour
import { esc, renderStars } from './data.js';
import { initCardCalendar } from './calendar-init.js';
import { t } from './i18n.js';

// ── TAG_LABELS: single source of truth ────────────────────────────────
// This map drives:
//   1. Pretty labels on property cards (prettyTag helper below)
//   2. Which filter buttons appear in the filter bar (buildFilterBar)
//   3. The order of content-tag filter buttons (TAG_LABELS insertion order)
//
// To add a new tag:
//   a) Add it here.
//   b) Add listings.filter_<tag-slug-underscored> to translations/en.json + fr.json
//      (optional — if missing, TAG_LABELS value is used as the fallback label).
//   c) Tag one or more properties with the kebab-case slug in their markdown.
//
// Keep this in sync with property.js.
export const TAG_LABELS = {
  'pet-friendly':    '🐾 Pet-Friendly',
  'walk-to-beach':   '🏖 Walk to beach',
  'family-friendly': '👨‍👩‍👧 Family-friendly',
  'central-air':     '❄ Central air',
  'second-floor':    '⬆ Second floor',
  newest:            '✨ Newest',
  waterfront:        '🌊 Waterfront',
  'year-round':      '📅 Year-round',
};

// ── i18n key for a content tag ─────────────────────────────────────────
// Converts kebab-case slug → translations key, e.g.:
//   'pet-friendly' → 'listings.filter_pet_friendly'
//   'year-round'   → 'listings.filter_year_round'
//   'newest'       → 'listings.filter_newest'
function tagI18nKey(slug) {
  return 'listings.filter_' + slug.replace(/-/g, '_');
}

// ── Pretty label for a tag (used on cards) ────────────────────────────
function prettyTag(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  // Fallback: kebab-case → "Sentence case"
  return String(tag).replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

// ── Label for a filter button (prefers i18n, falls back to TAG_LABELS) ─
function filterLabel(slug) {
  if (slug === 'all')       return t('listings.filter_all')       || 'All';
  if (slug === 'available') return t('listings.filter_available') || 'Available';
  const i18nVal = t(tagI18nKey(slug));
  // t() returns the key string itself when the key is missing, so check that
  if (i18nVal && i18nVal !== tagI18nKey(slug)) return i18nVal;
  return TAG_LABELS[slug] || prettyTag(slug);
}

let _state = null;

// ── Build the filter bar dynamically ──────────────────────────────────
// Called once after properties are loaded.
// Order: "All", "Available", then content tags in TAG_LABELS insertion order.
function buildFilterBar(properties) {
  const bar = document.querySelector('.filter-inner');
  if (!bar) return;

  // Collect tags used by at least one active property, intersect with TAG_LABELS
  const usedTags = new Set(properties.flatMap(p => p.tags || []));
  const contentTags = Object.keys(TAG_LABELS).filter(tag => usedTags.has(tag));

  // Build button list: static specials first, then content tags
  const slots = [
    { filter: 'all',       label: filterLabel('all'),       pressed: true  },
    { filter: 'available', label: filterLabel('available'),  pressed: false },
    ...contentTags.map(tag => ({
      filter:  tag,
      label:   filterLabel(tag),
      pressed: false,
    })),
  ];

  // Keep the existing filter-label span and filter-count span; replace buttons only
  const labelSpan = bar.querySelector('.filter-label');
  const countSpan = bar.querySelector('.filter-count');

  // Remove old buttons (everything between labelSpan and countSpan)
  bar.querySelectorAll('.filter-btn').forEach(b => b.remove());

  // Insert new buttons before the count span
  const fragment = document.createDocumentFragment();
  for (const slot of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.dataset.filter = slot.filter;
    btn.dataset.label  = slot.filter;
    btn.setAttribute('aria-pressed', slot.pressed ? 'true' : 'false');
    if (slot.pressed) btn.classList.add('active');
    btn.textContent = slot.label;
    // Wire click handler
    btn.addEventListener('click', () => applyFilter(btn));
    fragment.appendChild(btn);
  }

  if (countSpan) {
    bar.insertBefore(fragment, countSpan);
  } else {
    bar.appendChild(fragment);
  }
}

// ── Re-translate filter buttons when language changes ─────────────────
// Listens for i18n:changed so button text updates without a page reload.
function reTranslateFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.textContent = filterLabel(btn.dataset.filter);
  });
}

export function initListings(state) {
  _state = state;

  // Build filter buttons from real data
  buildFilterBar(state.properties);

  // Render initial grid
  renderGrid(state.properties);

  // Re-translate buttons when language switches
  document.addEventListener('i18n:changed', reTranslateFilterBar);
}

function buildSrcset(photo) {
  // Build a responsive srcset if we know the file naming convention.
  // optimize-images.js produces -480.webp / -800.webp / -1200.webp variants.
  if (!photo) return null;
  const base = photo.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  return {
    webp:     `${base}-480.webp 480w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`,
    fallback: photo,
  };
}

function cardHTML(p, allReviews) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasAvail = (p.availability || []).some(
    d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
  );

  const tagsHTML = (p.tags || [])
    .map(t => `<span class="card-tag">${esc(prettyTag(t))}</span>`)
    .join('');

  let photoHTML;
  if (p.photo) {
    const src = buildSrcset(p.photo);
    photoHTML = src
      ? `<picture>
           <source type="image/webp" srcset="${esc(src.webp)}" sizes="(max-width:640px) 100vw, 33vw">
           <img src="${esc(src.fallback)}" alt="${esc(p.title)}" loading="lazy" decoding="async" data-fallback="true" />
         </picture>`
      : `<img src="${esc(p.photo)}" alt="${esc(p.title)}" loading="lazy" decoding="async" data-fallback="true" />`;
  } else {
    photoHTML = `<div class="card-photo-placeholder" aria-hidden="true">${esc(p.title.charAt(0))}</div>`;
  }

  const propRevs = allReviews.filter(r => r.property === p.title);
  const avg = propRevs.length
    ? propRevs.reduce((s, r) => s + (r.rating || 5), 0) / propRevs.length
    : 0;
  const ratingHTML = propRevs.length
    ? `<div class="card-rating" aria-label="${avg.toFixed(1)} stars">
         ${renderStars(avg)}
         <span class="card-review-count">(${propRevs.length})</span>
       </div>`
    : '';

  const availBadge = hasAvail
    ? `<span class="card-badge avail-badge">${esc(t('listings.available_label') || 'Dates available')}</span>`
    : '';

  const price = p.price_per_night
    ? `<div class="card-price">
         <span class="price-label">${esc(t('listings.starting_label') || 'Starting at')}</span>
         <span class="price-amount">$${esc(String(p.price_per_night))}<span class="price-unit">/night</span></span>
       </div>`
    : '';

  return `
    <article class="property-card" data-slug="${esc(p._slug)}">
      <a href="/property/${esc(p._slug)}/" class="card-photo-link" tabindex="-1" aria-hidden="true">
        <div class="card-photo">${photoHTML}</div>
      </a>
      <div class="card-body">
        ${availBadge}
        <div class="card-tags">${tagsHTML}</div>
        <h3 class="card-title">
          <a href="/property/${esc(p._slug)}/">${esc(p.title)}</a>
        </h3>
        ${ratingHTML}
        <p class="card-desc">${esc((p.description || '').slice(0, 120))}…</p>
        ${price}
        <div class="card-actions">
          <button
            type="button"
            class="avail-toggle"
            aria-expanded="false"
            aria-controls="ap-${esc(p._slug)}"
            data-action="toggle-avail"
          >
            <span class="avail-toggle-label">Check availability</span>
          </button>
          <a href="/property/${esc(p._slug)}/" class="btn-pill btn-sm">
            <span class="card-cta" aria-hidden="true">${esc(t('listings.inquire_btn') || 'View & Inquire')} →</span>
          </a>
        </div>
        <div id="ap-${esc(p._slug)}" class="avail-panel" aria-hidden="true"></div>
      </div>
    </article>`;
}

export function renderGrid(properties) {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  if (!properties.length) {
    grid.innerHTML = `
      <div class="state-msg">
        <div class="icon" aria-hidden="true">🌊</div>
        <p>${esc(t('listings.no_match') || 'No properties match your filters yet')} —
          <a href="#" data-action="reset-filters">${esc(t('listings.reset_filters') || 'show all')}</a>.</p>
        <p style="margin-top:1rem;font-size:var(--sm)">
          Or message us at
          <a href="mailto:beachgirloob@gmail.com">beachgirloob@gmail.com</a>
        </p>
      </div>`;
    return;
  }
  grid.innerHTML = properties.map(p => cardHTML(p, _state.reviews)).join('');
  updateCount(properties.length, 'all');
}

function applyFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    b.classList.remove('active');
  });
  btn.setAttribute('aria-pressed', 'true');
  btn.classList.add('active');

  const filter = btn.dataset.filter;
  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  let filtered = _state.properties;
  if (filter === 'available') {
    filtered = filtered.filter(p =>
      (p.availability || []).some(
        d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
      )
    );
  } else if (filter !== 'all') {
    filtered = filtered.filter(p => (p.tags || []).includes(filter));
  }

  renderGrid(filtered);
  updateCount(filtered.length, btn.dataset.label || 'properties');

  // Map highlights are coordinated by main.js
  document.dispatchEvent(new CustomEvent('listings:filtered', { detail: { filtered } }));
}

function updateCount(n, label) {
  const el = document.getElementById('filter-count');
  if (el) el.textContent = `${n} ${label}`;
}

// Open availability panel + lazy-init calendar on first open
export function toggleAvail(togBtn) {
  const panelId = togBtn.getAttribute('aria-controls');
  const panel   = document.getElementById(panelId);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');

  document.querySelectorAll('.avail-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.avail-toggle[aria-expanded="true"]').forEach(t => {
    t.setAttribute('aria-expanded', 'false');
    const lbl = t.querySelector('.avail-toggle-label');
    if (lbl) lbl.textContent = 'Check availability';
  });

  if (!isOpen) {
    panel.classList.add('open');
    togBtn.setAttribute('aria-expanded', 'true');
    const lbl = togBtn.querySelector('.avail-toggle-label');
    if (lbl) lbl.textContent = 'Hide availability';
    const slug = panelId.replace('ap-', '');
    const prop = _state.properties.find(p => p._slug === slug);
    if (prop) initCardCalendar(slug, prop);
  }
}
