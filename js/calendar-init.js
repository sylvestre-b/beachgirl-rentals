// calendar-init.js — wires the BeachGirlCalendar into the page
// Selected dates are stored on a window-scoped object so the inquiry modal
// can read them without tight coupling.

window.__bgSelected = window.__bgSelected || {};

const _instances = {};

export function initCardCalendar(slug, prop) {
  if (_instances[slug]) return;
  const el = document.getElementById('cal-' + slug);
  if (!el || typeof window.BeachGirlCalendar === 'undefined') return;

  _instances[slug] = window.BeachGirlCalendar.create({
    container: el,
    availability: prop.availability || [],
    minNights: prop.min_nights || 1,
    onSelect: (ci, co) => {
      window.__bgSelected[slug] = { checkIn: ci, checkOut: co };
    },
  });
  _instances[slug].render();
}

export function initPropertyCalendar(prop, onChangeUI) {
  const el = document.getElementById('prop-calendar');
  if (!el || typeof window.BeachGirlCalendar === 'undefined') return null;
  const cal = window.BeachGirlCalendar.create({
    container: el,
    availability: prop.availability || [],
    minNights: prop.min_nights || 1,
    onSelect: (ci, co) => {
      window.__bgSelected[prop._slug] = { checkIn: ci, checkOut: co };
      if (onChangeUI) onChangeUI(ci, co);
    },
  });
  cal.render();
  return cal;
}

export function getSelected(slug) {
  return window.__bgSelected[slug] || { checkIn: null, checkOut: null };
}
