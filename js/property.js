// property.js — single property page
// Reads slug from URL, fetches listings + reviews, renders the page.

import { esc, renderStars, loadAll } from './data.js';
import { initPropertyCalendar } from './calendar-init.js';
import { initForms, openInquiryModal, closeModal } from './forms.js';
import { initReveal } from './reveal.js';

const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
let _property = null;
let _allReviews = [];
let _photos = [];

// Pretty labels — keep in sync with listings.js TAG_LABELS.
// 'second-floor' removed.
const TAG_LABELS = {
  'pet-friendly': '🐾 Pet-Friendly',
  'walk-to-beach': '🏖 Walk to beach',
  'family-friendly': '👨‍👩‍👧 Family-friendly',
  'central-air': '❄ Central air',
  newest: '✨ Newest',
  waterfront: '🌊 Waterfront',
  'year-round': '📅 Year-round',
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
    document.getElementById('prop-title').textContent = 'Property not found';
    document.getElementById('bc-title').textContent = 'Not found';
    return;
  }

  renderProperty(_property);
  initForms({ properties, reviews });
  initReveal();
  wireGalleryAndModalGlue();
  wireLightbox();

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

  // Schema.org
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
    address: {
      '@type': 'PostalAddress',
      streetAddress: p.address || '',
      addressRegion: 'ME',
      addressCountry: 'US',
    },
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
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(p.price).replace(/[^0-9.]/g, ''),
        priceCurrency: 'USD',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' },
      },
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
  _photos =
    p.photosAll && p.photosAll.length
      ? p.photosAll
      : p.photos && p.photos.length
        ? p.photos
        : p.photo
          ? [p.photo]
          : [];
  initGallery(_photos, p.title);

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

  // Specs — only show ones that have a value
  const specs = [];
  if (p.bedrooms) specs.push(['Bedrooms', `🛏 ${p.bedrooms}`]);
  if (p.bathrooms) specs.push(['Bathrooms', `🚿 ${p.bathrooms}`]);
  if (p.guests) specs.push(['Max Guests', `👥 ${p.guests}`]);
  if (p.min_nights) specs.push(['Min Stay', `${p.min_nights} nights`]);
  if (p.sqft) specs.push(['Sq. Feet', `📐 ${p.sqft}`]);
  if (p.check_in) specs.push(['Check-in', p.check_in]);
  if (p.check_out) specs.push(['Check-out', p.check_out]);
  document.getElementById('prop-specs').innerHTML = specs
    .map(
      ([l, v]) =>
        `<div class="spec-item"><div class="spec-label">${l}</div><div class="spec-val">${esc(String(v))}</div></div>`
    )
    .join('');

  // Tags — filter out second-floor if present
  document.getElementById('prop-tags').innerHTML = (p.tags || [])
    .filter(t => t !== 'second-floor')
    .map(t => `<span class="tag-pill">${esc(prettyTag(t))}</span>`)
    .join('');

  // Optional special note
  const noteEl = document.getElementById('prop-note');
  if (noteEl) {
    if (p.note) {
      noteEl.textContent = p.note;
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }
  }

  // Booking card
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasAvail = (p.availability || []).some(
    d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
  );
  document.getElementById('book-price').innerHTML = `${esc(p.price)} <span>/ week</span>`;
  document.getElementById('book-avail').innerHTML = hasAvail
    ? '<strong>Dates available</strong> — pick a week from the calendar below.'
    : '<strong>Inquire for available dates</strong> — message Jill and she\u2019ll confirm what\u2019s open.';

  // Fees block — only show pet fee if non-zero, only show cleaning if defined
  const feesEl = document.getElementById('book-fees');
  if (feesEl) {
    const lines = [];
    if (p.cleaning_fee !== undefined && p.cleaning_fee !== null) {
      lines.push(
        `<dt>Cleaning fee</dt><dd>${p.cleaning_fee ? `$${p.cleaning_fee}` : 'Included'}</dd>`
      );
    }
    if (p.pet_fee) lines.push(`<dt>Pet fee</dt><dd>$${p.pet_fee}</dd>`);
    lines.push('<dt>Maine lodging tax</dt><dd>9%*</dd>');
    feesEl.innerHTML = `
      <dl>${lines.join('')}</dl>
      <p class="fees-note">
        *Verify current Maine short-term rental tax rate at booking.
        Security deposit and minimum stay vary — message us for an exact total.
      </p>`;
  }

  // Reviews
  const revList = document.getElementById('prop-reviews-list');
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
  if (!track || !thumbs) return;

  if (!photos.length) {
    track.innerHTML = `<div class="gallery-slide">
      <div class="gallery-placeholder">${esc(title)}</div>
    </div>`;
    thumbs.style.display = 'none';
    return;
  }

  _galleryCount = photos.length;
  track.innerHTML = photos
    .map((src, i) => {
      const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      return `<div class="gallery-slide" data-action="open-lightbox" data-index="${i}" role="button" tabindex="0" aria-label="Enlarge photo ${i + 1}">
      <picture>
        <source type="image/webp"
          srcset="${esc(base)}-800.webp 800w, ${esc(base)}-1200.webp 1200w, ${esc(base)}-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 900px">
        <img src="${esc(src)}" alt="${esc(title)} — photo ${i + 1}" loading="lazy" decoding="async" data-fallback="true" />
      </picture>
      <div class="gallery-zoom-hint" aria-hidden="true">🔍 Click to enlarge</div>
    </div>`;
    })
    .join('');

  thumbs.innerHTML = photos
    .map((src, i) => {
      const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      return `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}"
              data-action="gallery-go" data-index="${i}" aria-label="Show photo ${i + 1}">
      <img src="${esc(base)}-160.webp" alt="" loading="lazy" decoding="async" />
    </button>`;
    })
    .join('');

  document.getElementById('gallery-counter').textContent = `1 / ${_galleryCount}`;

  document
    .querySelector('[data-action="gallery-prev"]')
    ?.addEventListener('click', () => galleryGo(_galleryIndex - 1));
  document
    .querySelector('[data-action="gallery-next"]')
    ?.addEventListener('click', () => galleryGo(_galleryIndex + 1));
  thumbs.querySelectorAll('[data-action="gallery-go"]').forEach(t => {
    t.addEventListener('click', () => galleryGo(parseInt(t.dataset.index, 10)));
  });

  // Touch swipe for mobile
  let touchStartX = 0;
  track.addEventListener(
    'touchstart',
    e => {
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  track.addEventListener(
    'touchend',
    e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) galleryGo(_galleryIndex + (dx < 0 ? 1 : -1));
    },
    { passive: true }
  );

  // Click on a slide opens lightbox (event delegation)
  track.addEventListener('click', e => {
    const slide = e.target.closest('[data-action="open-lightbox"]');
    if (slide) openLightbox(parseInt(slide.dataset.index, 10));
  });
  track.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const slide = e.target.closest('[data-action="open-lightbox"]');
      if (slide) {
        e.preventDefault();
        openLightbox(parseInt(slide.dataset.index, 10));
      }
    }
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
  document.getElementById('gallery-counter').textContent =
    `${_galleryIndex + 1} / ${_galleryCount}`;
}

// ── LIGHTBOX ────────────────────────────────────────────────────────
let _lightboxIndex = 0;

function wireLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  lb.addEventListener('click', e => {
    if (e.target === lb || e.target.closest('[data-action="lightbox-close"]')) {
      closeLightbox();
    }
  });
  document.querySelector('[data-action="lightbox-prev"]')?.addEventListener('click', () => {
    lightboxGo(_lightboxIndex - 1);
  });
  document.querySelector('[data-action="lightbox-next"]')?.addEventListener('click', () => {
    lightboxGo(_lightboxIndex + 1);
  });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxGo(_lightboxIndex - 1);
    if (e.key === 'ArrowRight') lightboxGo(_lightboxIndex + 1);
  });

  // Touch swipe inside lightbox
  let lbStartX = 0;
  lb.addEventListener(
    'touchstart',
    e => {
      lbStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  lb.addEventListener(
    'touchend',
    e => {
      const dx = e.changedTouches[0].clientX - lbStartX;
      if (Math.abs(dx) > 50) lightboxGo(_lightboxIndex + (dx < 0 ? 1 : -1));
    },
    { passive: true }
  );
}

function openLightbox(i) {
  if (!_photos.length) return;
  _lightboxIndex = i;
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  renderLightboxImage();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
}

function lightboxGo(i) {
  _lightboxIndex = (i + _photos.length) % _photos.length;
  renderLightboxImage();
  // Also sync the inline gallery
  galleryGo(_lightboxIndex);
}

function renderLightboxImage() {
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  if (!img) return;
  const src = _photos[_lightboxIndex];
  const base = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  img.srcset = `${base}-1200.webp 1200w, ${base}-1600.webp 1600w`;
  img.src = src;
  img.alt = `Photo ${_lightboxIndex + 1} of ${_photos.length}`;
  if (counter) counter.textContent = `${_lightboxIndex + 1} / ${_photos.length}`;
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
