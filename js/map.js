// map.js — Leaflet map with custom thumbnail pins
// NOTE: Geocoding is now done at BUILD time (build.js). The browser no longer
// hits Nominatim. Properties without lat/lng are simply skipped on the map.

import { esc } from './data.js';

let _mapInstance = null;
const _mapMarkers = {};
let _mapMobileOpen = false;

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
      <div class="map-popup-price">${esc(p.price)}/week</div>
      <button type="button" class="map-popup-btn">View property →</button>`;
    popupEl.querySelector('.map-popup-btn').addEventListener('click', () => {
      window.location.href = `/property/${encodeURIComponent(p._slug)}`;
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
}

function pinHTML(p, avail) {
  const photo = p.photo && p.photo.length ? p.photo : null;
  // optimize-images.js produces -160.webp variants for thumbs
  const thumbBase = photo ? photo.replace(/\.(jpg|jpeg|png|webp)$/i, '') : null;
  const thumbUrl = thumbBase ? `${thumbBase}-160.webp` : null;

  if (thumbUrl) {
    return `<div class="bg-pin ${avail ? '' : 'full'}"
                 style="background-image:url('${esc(thumbUrl)}')"
                 aria-hidden="true"></div>`;
  }
  // Fallback: initial in Playfair italic on driftwood disc
  const letter = (p.title.charAt(0) || '?').toUpperCase();
  return `<div class="bg-pin ${avail ? '' : 'full'}" aria-hidden="true">${esc(letter)}</div>`;
}

function highlightCard(slug) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('highlighted'));
  const c = document.getElementById(`card-${slug}`);
  if (c) {
    c.classList.add('highlighted');
    c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function updateMapHighlights(filtered) {
  if (!_mapInstance) return;
  const set = new Set(filtered.map(p => p._slug));
  Object.entries(_mapMarkers).forEach(([k, m]) => {
    if (_mapInstance.hasLayer(m) && !set.has(k)) _mapInstance.removeLayer(m);
    else if (!_mapInstance.hasLayer(m) && set.has(k)) m.addTo(_mapInstance);
  });
}

// P0 FIX: mobile map toggle now actually works
function wireMobileToggle() {
  const toggleBtn = document.getElementById('map-toggle');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', () => {
    const panel = document.getElementById('map-panel');
    if (!panel) return;
    _mapMobileOpen = !_mapMobileOpen;
    panel.classList.toggle('mobile-open', _mapMobileOpen);
    toggleBtn.setAttribute('aria-expanded', String(_mapMobileOpen));
    toggleBtn.textContent = _mapMobileOpen ? '✕ Close Map' : '🗺  Show Map';
    if (_mapMobileOpen && _mapInstance) {
      // Map must recompute size after layout change
      setTimeout(() => _mapInstance.invalidateSize(), 300);
    }
  });
}
