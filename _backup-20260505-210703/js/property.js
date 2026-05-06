// property.js — single property page
// 2026-05 fix-pass:
//   - Gallery: photos now use object-fit:contain (set in extras.css) so
//     portrait/landscape mixes never distort. Carousel is a clean
//     translateX track with thumbnails. Keyboard support: ← → arrow keys.
//   - "Inquire for available dates" copy: replaces "message Jill" with
//     "message the owner".

import { esc, renderStars, loadAll } from './data.js';
import { initPropertyCalendar } from './calendar-init.js';
import { initForms, openInquiryModal, closeModal } from './forms.js';
import { initReveal } from './reveal.js';

const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
let _property = null;
let _allReviews = [];

// Pretty labels — match listings.js TAG_LABELS (also stripped of emoji).
const TAG_LABELS = {
  'pet-friendly': 'Pet-friendly',
  'walk-to-beach': 'Walk to beach',
  'family-friendly': 'Family-friendly',
  'central-air': 'Central air',
  newest: 'Newest',
  waterfront: 'Waterfront',
  'year-round': 'Year-round',
};
function prettyTag(t) {
  if (TAG_LABELS[t]) return TAG_LABELS[t];
  return String(t)
    .replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

(async function init() {
  const { properties, reviews } = await loadAll();
  _allReviews = reviews;
  _property = properties.find(p => p._slug === slug);

  if (!_property) {
    const titleEl = document.getElementById('prop-title');
    const bcEl = document.getElementById('bc-title');
    if (titleEl) titleEl.textContent = 'Property not found';
    if (bcEl) bcEl.textContent = 'Not found';
    return;
  }

  renderProperty(_property);
  initForms({ properties, reviews });
  initReveal();
  wireGalleryAndModalGlue();

  initPropertyCalendar(_property, (ci, co) => {
    const prev = document.getElementById('selected-preview');
    if (!prev) return;
    if (ci && co) {
      prev.classList.add('show');
      prev.textContent = `✓ ${ci} → ${co}`;
      const ciIn = document.getElementById('i-checkin');
      const coIn = document.getElementById('i-checkout');
      if (ciIn) ciIn.value = ci;
      if (coIn) coIn.value = co;
    } else {
      prev.classList.remove('show');
    }
  });
})();

function renderProperty(p) {
  document.title = `${p.title} — Beach Girl Property Rentals`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && p.description) metaDesc.setAttribute('content', p.description);

  const propRevs = _allReviews.filter(r => r.property === p.title);
  const avg = propRevs.length
    ? propRevs.reduce((s, r) => s + (r.rating || 5), 0) / propRevs.length
    : 0;

  // Title + breadcrumb
  const propTitle = document.getElementById('prop-title');
  const bcTitle = document.getElementById('bc-title');
  if (propTitle) propTitle.textContent = p.title;
  if (bcTitle) bcTitle.textContent = p.title;

  // Description
  const desc = document.getElementById('prop-desc');
  if (desc) desc.textContent = p.description || '';

  // Body
  const body = document.getElementById('prop-body');
  if (body) body.innerHTML = p.bodyHTML || (p.body ? `<p>${esc(p.body)}</p>` : '');

  // Rating
  if (propRevs.length) {
    const r = document.getElementById('prop-rating');
    if (r) {
      r.innerHTML = `${renderStars(avg)} <span>(${propRevs.length})</span>`;
    }
  }

  // Specs
  const specs = document.getElementById('prop-specs');
  if (specs) {
    specs.innerHTML = [
      ['Bedrooms', `🛏 ${p.bedrooms}`],
      ['Bathrooms', `🚿 ${p.bathrooms}`],
      ['Max Guests', `👥 ${p.guests}`],
      ['Min Stay', p.min_nights ? `${p.min_nights} nights` : '—'],
    ]
      .map(
        ([l, v]) =>
          `<div class="spec-item"><div class="spec-label">${l}</div><div class="spec-val">${esc(String(v))}</div></div>`
      )
      .join('');
  }

  // Tags
  const tagsEl = document.getElementById('prop-tags');
  if (tagsEl) {
    tagsEl.innerHTML = (p.tags || [])
      .filter(t => TAG_LABELS[t])
      .map(t => `<span class="tag-pill">${esc(prettyTag(t))}</span>`)
      .join('');
  }

  // Booking card
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasAvail = (p.availability || []).some(
    d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
  );

  const priceEl = document.getElementById('book-price');
  if (priceEl) {
    priceEl.innerHTML = `${esc(p.price || 'Inquire for rates')} <span>/ week</span>`;
  }

  const availEl = document.getElementById('book-avail');
  if (availEl) {
    // Copy fix: "message the owner" — not "message Jill and she'll confirm".
    availEl.innerHTML = hasAvail
      ? '<strong>Dates available</strong> — pick a week from the calendar below.'
      : '<strong>Inquire for available dates</strong> — message the owner directly.';
  }

  const feesEl = document.getElementById('book-fees');
  if (feesEl) {
    feesEl.innerHTML = `
      <dl>
        <dt>Cleaning fee</dt>      <dd>${p.cleaning_fee ? `$${p.cleaning_fee}` : 'Included'}</dd>
        ${p.pet_fee ? `<dt>Pet fee</dt><dd>$${p.pet_fee}</dd>` : ''}
        <dt>Maine lodging tax</dt> <dd>9%*</dd>
      </dl>
      <p class="fees-note">
        *Verify current Maine short-term rental tax rate at booking.
        Security deposit and minimum stay vary — message us for an exact total.
      </p>`;
  }

  // Gallery: build with all photos (cover photo first, then gallery)
  const photos = [];
  if (p.photo) photos.push(p.photo);
  if (Array.isArray(p.photos)) {
    for (const x of p.photos) {
      const src = typeof x === 'string' ? x : x?.image;
      if (src && !photos.includes(src)) photos.push(src);
    }
  }
  initGallery(photos, p.title);

  // Reviews
  const revList = document.getElementById('prop-reviews-list');
  if (revList) {
    if (propRevs.length) {
      revList.innerHTML = propRevs
        .map(
          r => `
        <div class="review-item">
          <div class="review-header">
            <div class="review-author-name">${esc(r.author)}</div>
            <div class="review-date">${esc(r.date || '')}</div>
          </div>
          <div class="review-stars">${renderStars(r.rating || 5)}</div>
          <div class="review-body">"${esc(r.text)}"</div>
        </div>`
        )
        .join('');
    } else {
      const sec = document.getElementById('prop-reviews-section');
      if (sec) sec.style.display = 'none';
    }
  }

  if (p.lat && p.lng) initMiniMap(p.lat, p.lng, p.title);
  else {
    const ml = document.getElementById('map-loading');
    if (ml) ml.textContent = '📍 Map coordinates pending';
  }
}

function initMiniMap(lat, lng, title) {
  const ml = document.getElementById('map-loading');
  if (ml) ml.style.display = 'none';
  const mapEl = document.getElementById('prop-mini-map');
  if (!mapEl || typeof L === 'undefined') return;
  mapEl.style.display = 'block';
  const map = L.map('prop-mini-map', { zoomControl: true, scrollWheelZoom: false }).setView(
    [lat, lng],
    14
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);
  L.marker([lat, lng]).addTo(map).bindPopup(esc(title)).openPopup();
}

// ── GALLERY ─────────────────────────────────────────────────────────
let _galleryIndex = 0;
let _galleryCount = 0;

function initGallery(photos, title) {
  const track = document.getElementById('gallery-track');
  const thumbs = document.getElementById('gallery-thumbs');
  if (!track) return;

  if (!photos.length) {
    track.innerHTML = `<div class="gallery-slide">
      <div class="gallery-placeholder">${esc(title)}</div>
    </div>`;
    if (thumbs) thumbs.style.display = 'none';
    const counter = document.getElementById('gallery-counter');
    if (counter) counter.style.display = 'none';
    document.querySelectorAll('.gallery-btn').forEach(b => (b.style.display = 'none'));
    return;
  }

  _galleryCount = photos.length;
  _galleryIndex = 0;

  track.innerHTML = photos
    .map((src, i) => {
      const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      // Use srcset for responsive sizes; the image fits naturally
      // inside the slide via object-fit:contain (set in extras.css).
      return `<div class="gallery-slide">
      <picture>
        <source type="image/webp"
          srcset="${esc(base)}-800.webp 800w, ${esc(base)}-1200.webp 1200w, ${esc(base)}-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 1200px">
        <img src="${esc(src)}" alt="${esc(title)} photo ${i + 1}"
             loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"
             data-fallback="gallery" />
      </picture>
    </div>`;
    })
    .join('');

  if (thumbs) {
    thumbs.style.display = photos.length > 1 ? 'flex' : 'none';
    thumbs.innerHTML = photos
      .map((src, i) => {
        const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        return `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}"
                data-action="gallery-go" data-index="${i}" aria-label="Show photo ${i + 1}">
          <img src="${esc(base)}-160.webp" alt="" loading="lazy" decoding="async" />
        </button>`;
      })
      .join('');
    thumbs.querySelectorAll('[data-action="gallery-go"]').forEach(t => {
      t.addEventListener('click', () => galleryGo(parseInt(t.dataset.index, 10)));
    });
  }

  const counter = document.getElementById('gallery-counter');
  if (counter) counter.textContent = `1 / ${_galleryCount}`;

  // Hide nav buttons if only one photo
  document.querySelectorAll('.gallery-btn').forEach(b => {
    b.style.display = _galleryCount > 1 ? 'flex' : 'none';
  });

  document
    .querySelector('[data-action="gallery-prev"]')
    ?.addEventListener('click', () => galleryGo(_galleryIndex - 1));
  document
    .querySelector('[data-action="gallery-next"]')
    ?.addEventListener('click', () => galleryGo(_galleryIndex + 1));

  // Keyboard support
  document.addEventListener('keydown', e => {
    if (!_galleryCount) return;
    // Only react when no input/textarea has focus (so typing doesn't navigate)
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'ArrowLeft') galleryGo(_galleryIndex - 1);
    if (e.key === 'ArrowRight') galleryGo(_galleryIndex + 1);
  });

  // Swipe support
  let touchStart = null;
  track.addEventListener('touchstart', e => {
    touchStart = e.touches[0].clientX;
  }, { passive: true });
  track.addEventListener('touchend', e => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(dx) > 40) galleryGo(_galleryIndex + (dx < 0 ? 1 : -1));
    touchStart = null;
  });
}

function galleryGo(i) {
  if (!_galleryCount) return;
  _galleryIndex = (i + _galleryCount) % _galleryCount;
  const track = document.getElementById('gallery-track');
  if (track) track.style.transform = `translateX(-${_galleryIndex * 100}%)`;
  document
    .querySelectorAll('.gallery-thumb')
    .forEach((t, idx) => t.classList.toggle('active', idx === _galleryIndex));
  const counter = document.getElementById('gallery-counter');
  if (counter) counter.textContent = `${_galleryIndex + 1} / ${_galleryCount}`;
}

function wireGalleryAndModalGlue() {
  document.querySelectorAll('[data-action="open-inquiry-here"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (_property) openInquiryModal(_property._slug);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal('inquiry-overlay');
  });
}
