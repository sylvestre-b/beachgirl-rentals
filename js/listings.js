// listings.js — render the home grid + filter behaviour
import { esc, renderStars } from './data.js';
import { initCardCalendar } from './calendar-init.js';

// Pretty labels for tags shown on cards. Any tag not in this map renders
// as Title Case from its kebab-case slug (e.g. `walk-to-beach` → `Walk to beach`).
// Keep this in sync with the filter buttons in index.html and with property.js.
const TAG_LABELS = {
  'pet-friendly': '🐾 Pet-Friendly',
  'walk-to-beach': '🏖 Walk to beach',
  'family-friendly': '👨‍👩‍👧 Family-friendly',
  'central-air': '❄ Central air',
  'second-floor': '⬆ Second floor',
  newest: '✨ Newest',
  waterfront: '🌊 Waterfront',
  'year-round': '📅 Year-round',
};

function prettyTag(t) {
  if (TAG_LABELS[t]) return TAG_LABELS[t];
  // Fallback: kebab-case → "Sentence case"
  return String(t).replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

let _state = null;

export function initListings(state) {
  _state = state;
  renderGrid(state.properties);

  // Filter buttons (event delegation, no inline handlers)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn));
  });
}

function buildSrcset(photo) {
  // Build a responsive srcset if we know the file naming convention.
  // optimize-images.js produces -480.webp / -800.webp / -1200.webp variants.
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
    ? `<div class="card-rating">
         <span class="stars" aria-label="${avg.toFixed(1)} out of 5">${renderStars(avg)}</span>
         <span class="rating-count">${avg.toFixed(1)} (${propRevs.length})</span>
       </div>`
    : '';

  return `
    <article class="card" id="card-${esc(p._slug)}" tabindex="0"
             data-slug="${esc(p._slug)}" aria-label="${esc(p.title)}"
             data-reveal>
      <div class="card-photo">${photoHTML}
        <div class="card-badge ${hasAvail ? 'open' : 'full'}">
          ${hasAvail ? 'Dates available' : 'Inquire for dates'}
        </div>
        <div class="card-tags">${tagsHTML}</div>
      </div>
      <div class="card-body">
        <div class="card-type">${esc(p.type || 'Property')}</div>
        <h3 class="card-title">${esc(p.title)}</h3>
        <p class="card-location">📍 ${esc(p.location)}</p>
        <ul class="card-specs">
          <li class="spec">🛏 ${esc(String(p.bedrooms))} bed</li>
          <li class="spec">🚿 ${esc(String(p.bathrooms))} bath</li>
          <li class="spec">👥 Up to ${esc(String(p.guests))}</li>
        </ul>
        ${ratingHTML}
        <div class="avail-section">
          <button type="button" class="avail-toggle" aria-expanded="false"
                  aria-controls="ap-${esc(p._slug)}" id="at-${esc(p._slug)}"
                  data-action="toggle-avail">
            <span class="avail-toggle-label">Check availability</span>
            <span class="chev" aria-hidden="true">▼</span>
          </button>
          <div class="avail-panel" id="ap-${esc(p._slug)}">
            <div id="cal-${esc(p._slug)}" class="cal-wrap"></div>
            <button type="button" class="card-inquire-btn"
                    data-action="card-inquire" data-slug="${esc(p._slug)}">
              Send Inquiry →
            </button>
          </div>
        </div>
        <div class="card-price-row">
          <div class="card-price">${esc(p.price)} <span>/ week</span></div>
          <span class="card-cta" aria-hidden="true">View &amp; Inquire →</span>
        </div>
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
        <p>No properties match your filters yet —
          <a href="#" data-action="reset-filters">show all</a>.</p>
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
