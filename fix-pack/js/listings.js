// listings.js — render the home grid + filter behaviour
// 2026-05 fix-pass:
//   - Removed "second-floor" filter (not useful, was junk).
//   - Filter buttons use small SVG icons inline instead of emoji prefixes
//     so they render consistently across systems.
//   - Added date-range picker that filters listings to ones available
//     across the entire requested window.
//   - "View & Inquire" button: dropped the inner <span class="card-cta">
//     wrapper because card-cta forced teal text inside a coral pill.
//     Now the label is the button's own text → contrast just works.
import { esc, renderStars } from './data.js';
import { initCardCalendar } from './calendar-init.js';
import { t } from './i18n.js';

// ── TAG_LABELS: single source of truth ────────────────────────────────
// IMPORTANT: 'second-floor' deliberately removed. The label below is the
// human-readable text shown on cards (no emoji — handled with SVG icons
// in filter buttons).
export const TAG_LABELS = {
  'pet-friendly': 'Pet-friendly',
  'walk-to-beach': 'Walk to beach',
  'family-friendly': 'Family-friendly',
  'central-air': 'Central air',
  newest: 'Newest',
  waterfront: 'Waterfront',
  'year-round': 'Year-round',
};

// ── ICON_FOR_FILTER: small inline SVG sprites used in filter buttons ──
// Same hand-drawn-feeling stroke aesthetic as /icons/trust-icons.svg.
// Each one is 14×14 viewBox with stroke-only paths. Color inherits.
const FILTER_ICONS = {
  all: `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="3.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/>
    <circle cx="3.5" cy="10.5" r="1.4"/><circle cx="10.5" cy="10.5" r="1.4"/>
  </svg>`,
  available: `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2.5 6.5 L6 10 L11.5 4"/>
  </svg>`,
  'pet-friendly': `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <ellipse cx="7" cy="9.5" rx="2.6" ry="2.2"/>
    <ellipse cx="3" cy="5.4" rx="1" ry="1.3"/>
    <ellipse cx="11" cy="5.4" rx="1" ry="1.3"/>
    <ellipse cx="5" cy="3" rx="0.9" ry="1.2"/>
    <ellipse cx="9" cy="3" rx="0.9" ry="1.2"/>
  </svg>`,
  'walk-to-beach': `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M7 2 V7 M2 7 H12 M2 7 Q4 5.5 7 7 T12 7"/>
    <circle cx="7" cy="2" r="0.4" fill="currentColor"/>
  </svg>`,
  'family-friendly': `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 11.5 L7 4 L12 11.5 Z"/>
    <path d="M5.5 11.5 V8.5 H8.5 V11.5"/>
  </svg>`,
  'central-air': `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M7 2 V12 M2 7 H12 M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"/>
  </svg>`,
  newest: `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M7 2 L8.2 5.6 L12 5.8 L9.1 8.1 L10 11.7 L7 9.7 L4 11.7 L4.9 8.1 L2 5.8 L5.8 5.6 Z"/>
  </svg>`,
  waterfront: `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 5 Q4 3.5 6 5 T10 5 T13 5"/>
    <path d="M2 8.5 Q4 7 6 8.5 T10 8.5 T13 8.5"/>
    <path d="M2 11.5 Q4 10 6 11.5 T10 11.5 T13 11.5"/>
  </svg>`,
  'year-round': `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="3" width="10" height="9" rx="1.2"/>
    <path d="M2 6 H12 M5 1.5 V4 M9 1.5 V4"/>
  </svg>`,
  dates: `<svg class="filter-icon" viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="3" width="10" height="9" rx="1.2"/>
    <path d="M2 6 H12 M5 1.5 V4 M9 1.5 V4"/>
    <circle cx="5" cy="9" r="0.6" fill="currentColor"/>
  </svg>`,
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
  if (i18nVal && i18nVal !== tagI18nKey(slug)) {
    // Strip any leading emoji + space the translation file may still have.
    return i18nVal.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, '');
  }
  return TAG_LABELS[slug] || prettyTag(slug);
}

// Build the inner HTML for a filter button: icon + label.
function filterBtnHTML(slug) {
  const icon = FILTER_ICONS[slug] || '';
  return `${icon}<span class="filter-btn-label">${esc(filterLabel(slug))}</span>`;
}

let _state = null;
let _dateRange = { from: null, to: null }; // ISO strings YYYY-MM-DD

// ── Build the filter bar dynamically ──────────────────────────────────
function buildFilterBar(properties) {
  const bar = document.querySelector('.filter-inner');
  if (!bar) return;

  const usedTags = new Set(properties.flatMap(p => p.tags || []));
  const contentTags = Object.keys(TAG_LABELS).filter(tag => usedTags.has(tag));

  const slots = [
    { filter: 'all', pressed: true },
    { filter: 'available', pressed: false },
    ...contentTags.map(tag => ({ filter: tag, pressed: false })),
  ];

  const countSpan = bar.querySelector('.filter-count');
  bar.querySelectorAll('.filter-btn, .filter-dates, .date-popover').forEach(b => b.remove());

  // Date-range pill comes FIRST after the "Filter" label.
  const dateBtn = document.createElement('button');
  dateBtn.type = 'button';
  dateBtn.className = 'filter-dates';
  dateBtn.setAttribute('aria-haspopup', 'dialog');
  dateBtn.setAttribute('aria-expanded', 'false');
  dateBtn.innerHTML = `${FILTER_ICONS.dates}<span class="filter-dates-label">${esc(t('listings.filter_dates') || 'Any dates')}</span>`;
  dateBtn.addEventListener('click', toggleDatePopover);

  // The popover itself.
  const pop = document.createElement('div');
  pop.className = 'date-popover';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `
    <div class="date-popover-row">
      <div class="field">
        <label for="dr-from">Check-in</label>
        <input type="date" id="dr-from" />
      </div>
      <div class="field">
        <label for="dr-to">Check-out</label>
        <input type="date" id="dr-to" />
      </div>
    </div>
    <div class="date-popover-actions">
      <button type="button" class="clear-btn">Clear</button>
      <button type="button" class="apply-btn">Apply</button>
    </div>
  `;

  // Wire popover actions
  pop.querySelector('.apply-btn').addEventListener('click', () => {
    const from = pop.querySelector('#dr-from').value || null;
    const to = pop.querySelector('#dr-to').value || null;
    if (from && to && new Date(to) <= new Date(from)) {
      alert('Check-out must be after check-in.');
      return;
    }
    _dateRange = { from, to };
    updateDateButtonLabel(dateBtn);
    closeDatePopover();
    runActiveFilter();
  });
  pop.querySelector('.clear-btn').addEventListener('click', () => {
    _dateRange = { from: null, to: null };
    pop.querySelector('#dr-from').value = '';
    pop.querySelector('#dr-to').value = '';
    updateDateButtonLabel(dateBtn);
    closeDatePopover();
    runActiveFilter();
  });

  // Standard filter buttons
  const fragment = document.createDocumentFragment();
  fragment.appendChild(dateBtn);
  fragment.appendChild(pop);
  for (const slot of slots) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.dataset.filter = slot.filter;
    btn.setAttribute('aria-pressed', slot.pressed ? 'true' : 'false');
    if (slot.pressed) btn.classList.add('active');
    btn.innerHTML = filterBtnHTML(slot.filter);
    btn.addEventListener('click', () => applyFilter(btn));
    fragment.appendChild(btn);
  }

  if (countSpan) bar.insertBefore(fragment, countSpan);
  else bar.appendChild(fragment);
}

function toggleDatePopover() {
  const pop = document.querySelector('.date-popover');
  if (!pop) return;
  const isOpen = pop.classList.toggle('open');
  const btn = document.querySelector('.filter-dates');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (isOpen) {
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', outsideClickClose, { once: true });
    }, 0);
  }
}
function outsideClickClose(e) {
  const pop = document.querySelector('.date-popover');
  const btn = document.querySelector('.filter-dates');
  if (!pop || !pop.classList.contains('open')) return;
  if (pop.contains(e.target) || (btn && btn.contains(e.target))) {
    document.addEventListener('click', outsideClickClose, { once: true });
    return;
  }
  closeDatePopover();
}
function closeDatePopover() {
  const pop = document.querySelector('.date-popover');
  if (pop) pop.classList.remove('open');
  const btn = document.querySelector('.filter-dates');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function updateDateButtonLabel(btn) {
  const label = btn.querySelector('.filter-dates-label');
  if (!label) return;
  if (_dateRange.from && _dateRange.to) {
    label.textContent = `${_dateRange.from} → ${_dateRange.to}`;
    btn.classList.add('has-dates');
  } else {
    label.textContent = t('listings.filter_dates') || 'Any dates';
    btn.classList.remove('has-dates');
  }
}

function reTranslateFilterBar() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.innerHTML = filterBtnHTML(btn.dataset.filter);
  });
  const dateBtn = document.querySelector('.filter-dates');
  if (dateBtn) updateDateButtonLabel(dateBtn);
}

export function initListings(state) {
  _state = state;
  buildFilterBar(state.properties);
  renderGrid(state.properties);
  document.addEventListener('i18n:changed', reTranslateFilterBar);
}

function buildSrcset(photo) {
  if (!photo) return null;
  const base = photo.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  return `${base}-480.webp 480w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`;
}

// Card HTML — note: NO inner span.card-cta wrapper inside the pill.
function cardHTML(p, allReviews) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const propRevs = allReviews.filter(r => r.property === p.title);
  const avg = propRevs.length
    ? propRevs.reduce((s, r) => s + (r.rating || 5), 0) / propRevs.length
    : 0;

  const hasAvail = (p.availability || []).some(
    d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
  );

  const tagsHTML = (p.tags || [])
    .filter(tag => TAG_LABELS[tag])
    .map(tag => `<span class="card-tag">${esc(prettyTag(tag))}</span>`)
    .join('');

  const photoSrc = p.photo;
  const srcset = buildSrcset(photoSrc);
  const photoHTML = photoSrc
    ? `<img src="${esc(photoSrc)}" alt="${esc(p.title)}"
            ${srcset ? `srcset="${srcset}" sizes="(max-width:900px) 100vw, 33vw"` : ''}
            loading="lazy" decoding="async" data-fallback="card" width="600" height="400" />`
    : `<div class="card-photo-placeholder" aria-hidden="true"><span>${esc((p.title || '?').charAt(0))}</span></div>`;

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

  const inquireLabel = t('listings.inquire_btn') || 'View & Inquire';

  return `
    <article class="property-card" data-slug="${esc(p._slug)}">
      <a href="/property/${esc(p._slug)}/" class="card-photo-link" tabindex="-1" aria-hidden="true">
        <div class="card-photo">${photoHTML}</div>
      </a>
      <div class="card-body">
        ${availBadge}
        ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
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
          <a href="/property/${esc(p._slug)}/" class="btn-pill btn-sm">${esc(inquireLabel)} →</a>
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
      <div class="state-msg" style="grid-column:1/-1;text-align:center;padding:2.5rem 1rem">
        <div class="icon" aria-hidden="true" style="font-size:1.6rem;margin-bottom:0.6rem">🌊</div>
        <p>${esc(t('listings.no_match') || 'No properties match your filters yet')} —
          <a href="#" data-action="reset-filters">${esc(t('listings.reset_filters') || 'show all')}</a>.</p>
        <p style="margin-top:1rem;font-size:var(--sm);color:var(--text-muted)">
          Or message us at
          <a href="mailto:beachgirloob@gmail.com">beachgirloob@gmail.com</a>
        </p>
      </div>`;
    updateCount(0, 'all');
    return;
  }
  grid.innerHTML = properties.map(p => cardHTML(p, _state.reviews)).join('');
  const activeBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
  const labelKey = activeBtn ? activeBtn.dataset.filter : 'all';
  updateCount(properties.length, labelKey);
}

// Date-aware availability check. A property "matches" a range if every
// night between checkIn (inclusive) and checkOut (exclusive) is marked
// 'available' in its availability array.
function matchesDateRange(p, fromISO, toISO) {
  if (!fromISO || !toISO) return true;
  const avail = (p.availability || []).reduce((m, d) => {
    m[d.date] = d.status;
    return m;
  }, {});
  const start = new Date(fromISO + 'T00:00:00');
  const end = new Date(toISO + 'T00:00:00');
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (avail[key] !== 'available') return false;
  }
  return true;
}

function applyFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.setAttribute('aria-pressed', 'false');
    b.classList.remove('active');
  });
  btn.setAttribute('aria-pressed', 'true');
  btn.classList.add('active');
  runActiveFilter();
}

function runActiveFilter() {
  const activeBtn = document.querySelector('.filter-btn[aria-pressed="true"]');
  const filter = activeBtn ? activeBtn.dataset.filter : 'all';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let filtered = _state.properties;

  // Tag filter first
  if (filter === 'available') {
    filtered = filtered.filter(p =>
      (p.availability || []).some(
        d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
      )
    );
  } else if (filter !== 'all') {
    filtered = filtered.filter(p => (p.tags || []).includes(filter));
  }

  // Then date range
  if (_dateRange.from && _dateRange.to) {
    filtered = filtered.filter(p => matchesDateRange(p, _dateRange.from, _dateRange.to));
  }

  renderGrid(filtered);
  document.dispatchEvent(new CustomEvent('listings:filtered', { detail: { filtered } }));
}

function updateCount(n, label) {
  const el = document.getElementById('filter-count');
  if (!el) return;
  const noun = n === 1 ? 'property' : 'properties';
  el.textContent = `Showing ${n} ${noun}`;
}

// Open availability panel + lazy-init calendar on first open
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
