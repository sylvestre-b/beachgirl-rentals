// listings.js — render the home grid + filter behaviour
import { esc, renderStars } from './data.js';
import { initCardCalendar } from './calendar-init.js';
import { t } from './i18n.js';

// ── TAG_LABELS: single source of truth ────────────────────────────────
// 'second-floor' removed — was only on one unit and not useful as a filter.
export const TAG_LABELS = {
  'pet-friendly': '🐾 Pet-Friendly',
  'walk-to-beach': '🏖 Walk to beach',
  'family-friendly': '👨‍👩‍👧 Family-friendly',
  'central-air': '❄ Central air',
  newest: '✨ Newest',
  waterfront: '🌊 Waterfront',
  'year-round': '📅 Year-round',
};

function tagI18nKey(slug) {
  return 'listings.filter_' + slug.replace(/-/g, '_');
}

function prettyTag(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  return String(tag)
    .replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

function filterLabel(slug) {
  if (slug === 'all') return t('listings.filter_all') || 'All';
  if (slug === 'available') return t('listings.filter_available') || 'Available';
  const i18nVal = t(tagI18nKey(slug));
  if (i18nVal && i18nVal !== tagI18nKey(slug)) return i18nVal;
  return TAG_LABELS[slug] || prettyTag(slug);
}

let _state = null;
let _dateRange = { from: null, to: null }; // YYYY-MM-DD strings

function buildFilterBar(properties) {
  const bar = document.querySelector('.filter-inner');
  if (!bar) return;

  const usedTags = new Set(properties.flatMap(p => p.tags || []));
  const contentTags = Object.keys(TAG_LABELS).filter(tag => usedTags.has(tag));

  const slots = [
    { filter: 'all', label: filterLabel('all'), pressed: true },
    { filter: 'available', label: filterLabel('available'), pressed: false },
    ...contentTags.map(tag => ({ filter: tag, label: filterLabel(tag), pressed: false })),
  ];

  const countSpan = bar.querySelector('.filter-count');
  bar.querySelectorAll('.filter-btn').forEach(b => b.remove());

  const fragment = document.createDocumentFragment();
  for (const slot of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.dataset.filter = slot.filter;
    btn.dataset.label = slot.filter;
    btn.setAttribute('aria-pressed', slot.pressed ? 'true' : 'false');
    if (slot.pressed) btn.classList.add('active');
    btn.textContent = slot.label;
    btn.addEventListener('click', () => applyFilter(btn));
    fragment.appendChild(btn);
  }

  if (countSpan) bar.insertBefore(fragment, countSpan);
  else bar.appendChild(fragment);
}

function reTranslateFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.textContent = filterLabel(btn.dataset.filter);
  });
}

// ── Date-range filter ─────────────────────────────────────────────────
// Wires the two date inputs (#date-from / #date-to) inside .filter-bar.
// Re-applies the active tag/availability filter whenever dates change.
function wireDateRangeFilter() {
  const fromEl = document.getElementById('date-from');
  const toEl = document.getElementById('date-to');
  const clearBtn = document.getElementById('date-clear');
  if (!fromEl || !toEl) return;

  const today = new Date().toISOString().slice(0, 10);
  fromEl.min = today;
  toEl.min = today;

  const onChange = () => {
    _dateRange.from = fromEl.value || null;
    _dateRange.to = toEl.value || null;
    if (_dateRange.from && _dateRange.to && _dateRange.to < _dateRange.from) {
      toEl.value = '';
      _dateRange.to = null;
    }
    if (toEl.value) toEl.min = fromEl.value || today;
    reapplyActiveFilter();
  };

  fromEl.addEventListener('change', onChange);
  toEl.addEventListener('change', onChange);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      fromEl.value = '';
      toEl.value = '';
      _dateRange = { from: null, to: null };
      reapplyActiveFilter();
    });
  }
}

function reapplyActiveFilter() {
  const active =
    document.querySelector('.filter-btn.active') || document.querySelector('[data-filter="all"]');
  if (active) applyFilter(active);
}

// Count number of available nights between [from, to) inclusive of from, exclusive of to.
function countAvailableNights(p, from, to) {
  if (!from || !to) return null;
  const avail = (p.availability || []).filter(d => d.status === 'available');
  if (!avail.length) return 0;
  const set = new Set(avail.map(d => d.date));
  let n = 0;
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur < end) {
    if (set.has(cur.toISOString().slice(0, 10))) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

export function initListings(state) {
  _state = state;
  buildFilterBar(state.properties);
  wireDateRangeFilter();
  renderGrid(state.properties);
  document.addEventListener('i18n:changed', reTranslateFilterBar);
}

function buildSrcset(photo) {
  if (!photo) return null;
  const base = photo.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  return {
    webp: `${base}-480.webp 480w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`,
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
    .filter(t => t !== 'second-floor') // hide leftover tag if present
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

  // Date-range badge: when user has picked dates, show how many nights match
  let dateBadge = '';
  if (_dateRange.from && _dateRange.to) {
    const nights = countAvailableNights(p, _dateRange.from, _dateRange.to);
    if (nights > 0) {
      dateBadge = `<span class="card-badge avail-badge">${nights} night${nights === 1 ? '' : 's'} available</span>`;
    } else {
      dateBadge = `<span class="card-badge inquire-badge">Inquire to confirm</span>`;
    }
  } else if (hasAvail) {
    dateBadge = `<span class="card-badge avail-badge">${esc(t('listings.available_label') || 'Dates available')}</span>`;
  }

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
        ${dateBadge}
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
  const today = new Date();
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

  // Apply date range on top of the tag filter.
  if (_dateRange.from && _dateRange.to) {
    filtered = filtered
      .map(p => ({ p, n: countAvailableNights(p, _dateRange.from, _dateRange.to) }))
      .sort((a, b) => b.n - a.n)
      .map(x => x.p);
  }

  renderGrid(filtered);
  updateCount(filtered.length, btn.dataset.label || 'properties');

  document.dispatchEvent(new CustomEvent('listings:filtered', { detail: { filtered } }));
}

function updateCount(n, label) {
  const el = document.getElementById('filter-count');
  if (el) el.textContent = `${n} ${label}`;
}

export function toggleAvail(togBtn) {
  const panelId = togBtn.getAttribute('aria-controls');
  const panel = document.getElementById(panelId);
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
