// map.js — Leaflet map with custom thumbnail pins
//
// Changes in this revision (2026-05):
//   • Desktop: clicking a property card flies the map to that pin and opens
//     its popup. Hovering a card also pans-and-highlights (debounced).
//   • Desktop: the floating ✕ close button is no longer rendered (it was
//     ghosting outside the panel because .map-panel is position:sticky and
//     the absolutely-positioned ✕ had no offset parent at desktop widths).
//   • Mobile: ✕ enlarged to a 44x44 hit target; FAB toggles "Show Map" /
//     "✕ Close Map" cleanly. The FAB visibility (show only inside the
//     listings range) is wired in main.js's wireMapToggleVisibility().
//   • Cards expose .selected state when clicked outside link/button areas,
//     making "selector-first" UX possible without a separate mode toggle.

import { esc } from './data.js';

let _mapInstance = null;
const _mapMarkers = {};
let _mapMobileOpen = false;
let _hoverDebounce = null;

export function initMap(properties) {
  if (_mapInstance || typeof L === 'undefined') return;

  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  _mapInstance = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView(
    [43.51, -70.38],
    11
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_mapInstance);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bounds = [];

  properties.forEach(p => {
    if (!p.lat || !p.lng) return;
    const avail = (p.availability || []).some(
      d => d.status === 'available' && new Date(d.date + 'T00:00:00') >= today
    );

    const icon = L.divIcon({
      className: 'bg-pin-wrap',
      html: pinHTML(p, avail),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      popupAnchor: [0, -24],
    });

    const popupEl = document.createElement('div');
    popupEl.className = 'map-popup';
    popupEl.innerHTML = `
      <div class="map-popup-title">${esc(p.title)}</div>
      <div class="map-popup-loc">📍 ${esc(p.location)}</div>
      <div class="map-popup-price">${esc(p.price || 'Inquire for rates')}/week</div>
      <button type="button" class="map-popup-btn">View property →</button>`;
    popupEl.querySelector('.map-popup-btn').addEventListener('click', () => {
      window.location.href = `/property/${encodeURIComponent(p._slug)}/`;
    });

    const marker = L.marker([p.lat, p.lng], { icon, title: p.title })
      .addTo(_mapInstance)
      .bindPopup(popupEl);
    marker.on('click', () => highlightCard(p._slug));
    _mapMarkers[p._slug] = marker;
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 1) _mapInstance.fitBounds(bounds, { padding: [40, 40] });
  else if (bounds.length === 1) _mapInstance.setView(bounds[0], 14);

  wireMobileToggle();
  wireCardSelection();
}

function pinHTML(p, avail) {
  const photo = p.photo && p.photo.length ? p.photo : null;
  const thumbBase = photo ? photo.replace(/\.(jpg|jpeg|png|webp)$/i, '') : null;
  const thumbUrl = thumbBase ? `${thumbBase}-160.webp` : null;

  if (thumbUrl) {
    return `<div class="bg-pin ${avail ? '' : 'full'}"
                 style="background-image:url('${esc(thumbUrl)}')"
                 aria-hidden="true"></div>`;
  }
  const letter = (p.title.charAt(0) || '?').toUpperCase();
  return `<div class="bg-pin ${avail ? '' : 'full'}" aria-hidden="true">${esc(letter)}</div>`;
}

// Highlight a card on the page and (on desktop only) scroll it into view.
function highlightCard(slug) {
  document
    .querySelectorAll('.property-card, .card')
    .forEach(c => c.classList.remove('highlighted'));
  const c = document.querySelector(`.property-card[data-slug="${slug}"]`);
  if (c) {
    c.classList.add('highlighted');
    if (window.matchMedia('(min-width: 1025px)').matches) {
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Mark a card as "selected" (selector-first UX).
function setSelectedCard(slug) {
  document.querySelectorAll('.property-card, .card').forEach(c => c.classList.remove('selected'));
  const c = document.querySelector(`.property-card[data-slug="${slug}"]`);
  if (c) c.classList.add('selected');
}

// Pan + zoom the map onto a specific listing and open its popup.
export function focusMapOn(slug) {
  if (!_mapInstance) return;
  const marker = _mapMarkers[slug];
  if (!marker) return;
  const latlng = marker.getLatLng();
  // 16 is close enough to see surroundings without losing context
  _mapInstance.flyTo(latlng, 16, { duration: 0.7 });
  marker.openPopup();
}

export function updateMapHighlights(filtered) {
  if (!_mapInstance) return;
  const set = new Set(filtered.map(p => p._slug));
  Object.entries(_mapMarkers).forEach(([k, m]) => {
    if (_mapInstance.hasLayer(m) && !set.has(k)) _mapInstance.removeLayer(m);
    else if (!_mapInstance.hasLayer(m) && set.has(k)) m.addTo(_mapInstance);
  });
}

// ── CARD SELECTION (selector-first) ───────────────────────────────────────
// Click on a card body (not the photo, the avail-toggle, or the View &
// Inquire button) selects that card. On desktop this also flies the map
// to it. On mobile, we change the FAB label so the next "Show Map" tap
// opens the map already focused on that listing.
function wireCardSelection() {
  document.addEventListener('click', e => {
    const card = e.target.closest('.property-card');
    if (!card) return;
    // Ignore clicks on inner links / buttons / images — those have their
    // own behaviour (navigate, toggle availability, etc.).
    if (
      e.target.closest('a, button, .card-photo, .card-photo-link, .avail-section, .avail-panel')
    ) {
      return;
    }
    e.preventDefault();
    const slug = card.dataset.slug;
    if (!slug) return;
    setSelectedCard(slug);

    // Desktop: fly the map to it.
    if (window.matchMedia('(min-width: 1025px)').matches) {
      focusMapOn(slug);
    } else {
      // Mobile: stash the focus target so opening the map zooms in.
      const toggle = document.getElementById('map-toggle');
      if (toggle) {
        toggle.dataset.focusSlug = slug;
        const lbl = toggle.querySelector('.map-toggle-label') || toggle;
        // Re-label so user knows the next tap brings them to *this* unit.
        if (toggle.querySelector('.map-toggle-label')) {
          toggle.querySelector('.map-toggle-label').textContent = 'Show on Map';
        } else {
          toggle.textContent = '🗺  Show on Map';
        }
      }
    }
  });

  // Hover-to-focus on desktop (debounced 220ms so the map doesn't jump
  // while the user is moving the mouse across the grid).
  document.addEventListener(
    'mouseenter',
    e => {
      if (!window.matchMedia('(min-width: 1025px) and (hover: hover)').matches) return;
      const card = e.target.closest && e.target.closest('.property-card');
      if (!card) return;
      const slug = card.dataset.slug;
      if (!slug) return;
      clearTimeout(_hoverDebounce);
      _hoverDebounce = setTimeout(() => {
        // Only pan, don't zoom — full fly-to is reserved for explicit click.
        const marker = _mapMarkers[slug];
        if (marker && _mapInstance) {
          _mapInstance.panTo(marker.getLatLng(), { animate: true, duration: 0.45 });
        }
      }, 220);
    },
    true
  );
}

// ── MOBILE MAP TOGGLE ─────────────────────────────────────────────────────
function wireMobileToggle() {
  const toggleBtn = document.getElementById('map-toggle');
  const closeBtn = document.getElementById('map-close');
  const panel = document.getElementById('map-panel');
  if (!toggleBtn || !panel) return;

  function openMap() {
    _mapMobileOpen = true;
    panel.classList.add('mobile-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.textContent = '✕  Close Map';
    document.body.style.overflow = 'hidden';
    if (_mapInstance) {
      setTimeout(() => {
        _mapInstance.invalidateSize();
        // If a card was selected before opening the map, fly to it.
        const focusSlug = toggleBtn.dataset.focusSlug;
        if (focusSlug) {
          focusMapOn(focusSlug);
          delete toggleBtn.dataset.focusSlug;
        }
      }, 220);
    }
    if (closeBtn) closeBtn.focus();
  }

  function closeMap() {
    _mapMobileOpen = false;
    panel.classList.remove('mobile-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    // Restore label based on selection state
    const hasSelected = !!document.querySelector('.property-card.selected');
    toggleBtn.textContent = hasSelected ? '🗺  Show on Map' : '🗺  Show Map';
    document.body.style.overflow = '';
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', () => (_mapMobileOpen ? closeMap() : openMap()));
  if (closeBtn) closeBtn.addEventListener('click', closeMap);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _mapMobileOpen) closeMap();
  });
}
