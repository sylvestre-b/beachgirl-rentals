// property.js — single property page
// Reads slug from URL, fetches listings + reviews, renders the page.
// Honest CTA: "Send Inquiry", not "Book Now".

import { esc, renderStars, loadAll } from './data.js';
import { initPropertyCalendar }      from './calendar-init.js';
import { initForms, openInquiryModal, closeModal } from './forms.js';
import { initReveal } from './reveal.js';

const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
let _property = null;
let _allReviews = [];

(async function init() {
  const { properties, reviews } = await loadAll();
  _allReviews = reviews;
  _property = properties.find(p => p._slug === slug);

  if (!_property) {
    document.getElementById('prop-title').textContent = 'Property not found';
    document.getElementById('bc-title').textContent = 'Not found';
    return;
  }

  renderProperty(_property);
  initForms({ properties, reviews });
  initReveal();
  wireGalleryAndModalGlue();

  // Show selected dates preview when calendar fires
  initPropertyCalendar(_property, (ci, co) => {
    const prev = document.getElementById('selected-preview');
    if (!prev) return;
    if (ci && co) {
      prev.classList.add('show');
      prev.textContent = `✓ ${ci} → ${co}`;
      // Pre-fill the inquiry form fields too
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

  // Update meta description for SEO
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && p.description) metaDesc.setAttribute('content', p.description);

  // Schema.org VacationRental + Offers + AggregateRating (when reviews exist)
  const propRevs = _allReviews.filter(r => r.property === p.title);
  const avg = propRevs.length
    ? propRevs.reduce((s, r) => s + (r.rating || 5), 0) / propRevs.length
    : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    name: p.title,
    description: p.description,
    url: `https://beachgirlpropertyrentals.com/property/${p._slug}`,
    address: { '@type': 'PostalAddress', streetAddress: p.address || '', addressRegion: 'ME', addressCountry: 'US' },
    numberOfRooms: p.bedrooms,
    occupancy: { '@type': 'QuantitativeValue', maxValue: p.guests },
  };
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    schema.geo = { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng };
  }
  if (p.price) {
    schema.offers = {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: String(p.price).replace(/[^0-9.]/g, ''),
      priceSpecification: { '@type': 'UnitPriceSpecification', price: String(p.price).replace(/[^0-9.]/g, ''), priceCurrency: 'USD', referenceQuantity: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' } },
    };
  }
  if (avg !== null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: propRevs.length,
    };
  }
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(schema);
  document.head.appendChild(s);

  // Gallery
  const photos = p.photosAll && p.photosAll.length ? p.photosAll
                : (p.photos && p.photos.length    ? p.photos
                : (p.photo ? [p.photo] : []));
  initGallery(photos, p.title);

  document.getElementById('bc-title').textContent = p.title;
  document.getElementById('prop-type').textContent = p.type || 'Property';
  document.getElementById('prop-title').textContent = p.title;
  document.getElementById('prop-location').textContent = '📍 ' + (p.location || '');
  document.getElementById('prop-desc').textContent = p.description || '';

  if (avg !== null) {
    document.getElementById('prop-rating').innerHTML = `
      <span class="stars" aria-label="${avg.toFixed(1)} stars">${renderStars(avg)}</span>
      <span class="rating-txt">${avg.toFixed(1)} · ${propRevs.length} review${propRevs.length > 1 ? 's' : ''}</span>`;
  }

  // Specs
  document.getElementById('prop-specs').innerHTML = [
    ['Bedrooms', `🛏 ${p.bedrooms}`],
    ['Bathrooms', `🚿 ${p.bathrooms}`],
    ['Max Guests', `👥 ${p.guests}`],
    ['Min Stay', p.min_nights ? `${p.min_nights} nights` : '—'],
  ].map(([l, v]) =>
    `<div class="spec-item"><div class="spec-label">${l}</div><div class="spec-val">${esc(String(v))}</div></div>`
  ).join('');

  // Tags
  const tagLabels = {
    'pet-friendly': '🐾 Pet-Friendly',
    'waterfront':   '🌊 Waterfront',
    'year-round':   '📅 Year-Round',
  };
  document.getElementById('prop-tags').innerHTML = (p.tags || [])
    .map(t => `<span class="tag-pill">${esc(tagLabels[t] || t)}</span>`)
    .join('');

  // Booking card — price + fees + availability
  const today = new Date(); today.setHours(0,0,0,0);
  const hasAvail = (p.availability || []).some(d =>
    d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
  );
  document.getElementById('book-price').innerHTML = `${esc(p.price)} <span>/ week</span>`;
  document.getElementById('book-avail').innerHTML = hasAvail
    ? '<strong>Dates available</strong> — pick a week from the calendar below.'
    : 'Fully booked for this season — message us for waitlist.';

  // Fees block — explicit transparency
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

  // Reviews
  const revList = document.getElementById('prop-reviews-list');
  if (propRevs.length) {
    revList.innerHTML = propRevs.map(r => `
      <div class="review-item">
        <div class="review-header">
          <div class="review-author-name">${esc(r.author)}</div>
          <div class="review-date">${esc(r.date || '')}</div>
        </div>
        <div class="review-stars">${renderStars(r.rating || 5)}</div>
        <div class="review-body">"${esc(r.text)}"</div>
      </div>`).join('');
  } else {
    const sec = document.getElementById('prop-reviews-section');
    if (sec) sec.style.display = 'none';
  }

  // Mini-map (no in-browser geocoding — uses lat/lng baked at build time)
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
  const map = L.map('prop-mini-map', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 18,
  }).addTo(map);
  L.marker([lat, lng]).addTo(map).bindPopup(esc(title)).openPopup();
}

// ── GALLERY ─────────────────────────────────────────────────────────
let _galleryIndex = 0;
let _galleryCount = 0;

function initGallery(photos, title) {
  const track  = document.getElementById('gallery-track');
  const thumbs = document.getElementById('gallery-thumbs');
  if (!track || !thumbs) return;

  if (!photos.length) {
    track.innerHTML = `<div class="gallery-slide">
      <div class="gallery-placeholder">${esc(title)}</div>
    </div>`;
    thumbs.style.display = 'none';
    return;
  }

  _galleryCount = photos.length;
  track.innerHTML = photos.map(src => {
    const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    return `<div class="gallery-slide">
      <picture>
        <source type="image/webp"
          srcset="${esc(base)}-800.webp 800w, ${esc(base)}-1200.webp 1200w, ${esc(base)}-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 900px">
        <img src="${esc(src)}" alt="${esc(title)}" loading="lazy" decoding="async" data-fallback="true" />
      </picture>
    </div>`;
  }).join('');

  thumbs.innerHTML = photos.map((src, i) => {
    const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    return `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}"
              data-action="gallery-go" data-index="${i}" aria-label="Show photo ${i+1}">
      <img src="${esc(base)}-160.webp" alt="" loading="lazy" decoding="async" />
    </button>`;
  }).join('');

  document.getElementById('gallery-counter').textContent = `1 / ${_galleryCount}`;

  document.querySelector('[data-action="gallery-prev"]')?.addEventListener('click', () => galleryGo(_galleryIndex - 1));
  document.querySelector('[data-action="gallery-next"]')?.addEventListener('click', () => galleryGo(_galleryIndex + 1));
  thumbs.querySelectorAll('[data-action="gallery-go"]').forEach(t => {
    t.addEventListener('click', () => galleryGo(parseInt(t.dataset.index, 10)));
  });
}

function galleryGo(i) {
  if (!_galleryCount) return;
  _galleryIndex = (i + _galleryCount) % _galleryCount;
  const track = document.getElementById('gallery-track');
  if (track) track.style.transform = `translateX(-${_galleryIndex * 100}%)`;
  document.querySelectorAll('.gallery-thumb').forEach((t, idx) =>
    t.classList.toggle('active', idx === _galleryIndex)
  );
  document.getElementById('gallery-counter').textContent = `${_galleryIndex + 1} / ${_galleryCount}`;
}

// ── MODAL GLUE ──────────────────────────────────────────────────────
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
