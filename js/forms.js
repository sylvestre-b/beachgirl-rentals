// forms.js — inquiry + review form submission
// 2026-05 fix-pass:
//   - Header "Inquire" button works even if loadAll() is still pending
//     (module-level delegated click handler, attached as soon as file is parsed).
//   - openInquiryModal() is null-safe on every DOM access.
//   - Both forms now populate their property selects from real data:
//       • Review form  → r-property
//       • Inquiry form → iq-property  (was empty before — bug fix)

import { getSelected } from './calendar-init.js';

const INQUIRY_FORM_ID = 'xbdwrlgl';
const REVIEW_FORM_ID = 'xjglbglj';

let _modalProperty = null;
let _allProperties = [];
let _lastFocused = null;
let _currentRating = 0;

// ── Module-level delegated listener ──────────────────────────────────
document.addEventListener('click', e => {
  const open = e.target.closest('[data-action="open-inquiry"]');
  if (open) {
    e.preventDefault();
    openInquiryModal(null);
    return;
  }
  const close = e.target.closest('[data-action="close-modal"]');
  if (close) {
    e.preventDefault();
    closeModal(close.getAttribute('data-target'));
    return;
  }
});

export function initForms(state) {
  _allProperties = state.properties || [];
  populateInquirySelect();
  populateReviewSelect();
  wireStarPicker();
  wireFormButtons();
}

function wireFormButtons() {
  const sendBtn = document.querySelector('[data-action="submit-inquiry"]');
  if (sendBtn) sendBtn.addEventListener('click', submitInquiry);

  const reviewBtn = document.querySelector('[data-action="submit-review"]');
  if (reviewBtn) reviewBtn.addEventListener('click', submitReview);

  document.querySelectorAll('[data-action="open-review"]').forEach(btn => {
    btn.addEventListener('click', openReviewModal);
  });

  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov) closeModal(ov.id);
    });
  });
}

export function openInquiryModal(slug) {
  const ov = document.getElementById('inquiry-overlay');
  if (!ov) {
    console.warn('[forms] No inquiry-overlay on this page; cannot open inquiry modal.');
    return;
  }

  _lastFocused = document.activeElement;
  const p = slug ? _allProperties.find(x => x._slug === slug) : null;
  const sel = slug ? getSelected(slug) : { checkIn: null, checkOut: null };
  _modalProperty = p;

  const title = document.getElementById('inquiry-title');
  if (title) {
    title.textContent = p ? `Let's chat about ${p.title}` : "Let's chat about your stay";
  }

  const sum = document.getElementById('inquiry-summary');
  if (sum) {
    sum.innerHTML = '';
    if (p) {
      const s = document.createElement('strong');
      s.textContent = p.title;
      sum.appendChild(s);
      sum.appendChild(document.createTextNode(` · ${p.location} · ${p.price}/week`));
      if (sel.checkIn && sel.checkOut) {
        sum.appendChild(document.createElement('br'));
        const sw = document.createElement('strong');
        sw.textContent = 'Selected: ';
        sum.appendChild(sw);
        sum.appendChild(document.createTextNode(`${sel.checkIn} → ${sel.checkOut}`));
      }
    } else {
      sum.textContent = "Fill in your details and we'll get back to you quickly.";
    }
  }

  const formView = document.getElementById('inquiry-form-view');
  if (formView) formView.style.display = 'block';
  const successView = document.getElementById('inquiry-success');
  if (successView) successView.classList.remove('show');

  // Reset fields (tolerate either i-* or iq-* naming).
  [
    'i-first',
    'i-last',
    'i-email',
    'i-phone',
    'i-message',
    'i-checkin',
    'i-checkout',
    'iq-name',
    'iq-email',
    'iq-message',
    'iq-checkin',
    'iq-checkout',
    'iq-guests',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const guestsEl = document.getElementById('i-guests');
  if (guestsEl) guestsEl.value = '';

  // Pre-select the property in the dropdown if we have one
  const propSelect = document.getElementById('iq-property');
  if (propSelect && p) {
    propSelect.value = p.title;
  } else if (propSelect) {
    propSelect.value = '';
  }

  if (p && sel.checkIn && sel.checkOut) {
    const ci = document.getElementById('i-checkin') || document.getElementById('iq-checkin');
    const co = document.getElementById('i-checkout') || document.getElementById('iq-checkout');
    if (ci) ci.value = sel.checkIn;
    if (co) co.value = sel.checkOut;
  }

  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = ov.querySelector('.modal-close');
  if (closeBtn) closeBtn.focus();
}

export function openReviewModal() {
  const ov = document.getElementById('review-overlay');
  if (!ov) return;
  _lastFocused = document.activeElement;
  const formView = document.getElementById('review-form-view');
  if (formView) formView.style.display = 'block';
  const successView = document.getElementById('review-success');
  if (successView) successView.classList.remove('show');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = ov.querySelector('.modal-close');
  if (closeBtn) closeBtn.focus();
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
  if (_lastFocused) {
    try {
      _lastFocused.focus();
    } catch (_) {
      /* noop */
    }
    _lastFocused = null;
  }
}

// ── Populate inquiry property dropdown (FIX: was empty before) ───────
function populateInquirySelect() {
  const sel = document.getElementById('iq-property');
  if (!sel) return;
  sel.innerHTML =
    '<option value="">— Select a property —</option>' +
    '<option value="General inquiry">General inquiry (no specific property)</option>';
  _allProperties.forEach(p => {
    const o = document.createElement('option');
    o.value = p.title;
    o.textContent = p.title;
    sel.appendChild(o);
  });
}

function populateReviewSelect() {
  const sel = document.getElementById('r-property');
  if (!sel) return;
  sel.innerHTML =
    '<option value="">Select…</option>' +
    '<option value="General">General (not about a specific property)</option>';
  _allProperties.forEach(p => {
    const o = document.createElement('option');
    o.value = p.title;
    o.textContent = p.title;
    sel.appendChild(o);
  });
}

function wireStarPicker() {
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => setRating(i + 1));
  });
}

function setRating(val) {
  _currentRating = val;
  document.querySelectorAll('.star-btn').forEach((b, i) => {
    b.classList.toggle('active', i < val);
    b.setAttribute('aria-pressed', i < val ? 'true' : 'false');
  });
}

// ── INQUIRY SUBMIT ────────────────────────────────────────────────────
async function submitInquiry() {
  const firstEl = document.getElementById('i-first');
  const lastEl = document.getElementById('i-last');
  const nameEl = document.getElementById('iq-name');

  let name;
  if (firstEl && lastEl) {
    name = `${firstEl.value.trim()} ${lastEl.value.trim()}`.trim();
  } else if (nameEl) {
    name = nameEl.value.trim();
  } else {
    name = '';
  }

  const email =
    (document.getElementById('i-email') || document.getElementById('iq-email'))?.value.trim() || '';
  const phone = document.getElementById('i-phone')?.value.trim() || '';
  const guests =
    (document.getElementById('i-guests') || document.getElementById('iq-guests'))?.value || '';
  const checkIn =
    (document.getElementById('i-checkin') || document.getElementById('iq-checkin'))?.value || '';
  const checkOut =
    (document.getElementById('i-checkout') || document.getElementById('iq-checkout'))?.value || '';
  const message =
    (document.getElementById('i-message') || document.getElementById('iq-message'))?.value.trim() ||
    '';
  const propertySelect = document.getElementById('iq-property');
  const propertyOverride = propertySelect ? propertySelect.value : '';

  const inquiryType =
    document.querySelector('input[name="inquiry_type"]:checked')?.value || 'Booking Request';

  if (!name || !email) {
    return showErr('inquiry', 'Please fill in your name and email.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showErr('inquiry', 'Please enter a valid email address.');
  }
  if (inquiryType === 'Booking Request' && checkIn && checkOut) {
    if (new Date(checkOut) <= new Date(checkIn)) {
      return showErr('inquiry', 'Check-out must be after check-in.');
    }
  }

  const btn = document.querySelector('[data-action="submit-inquiry"]');
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'Sending…';
    btn.disabled = true;
  }

  const propertyTitle = _modalProperty?.title || propertyOverride || 'General inquiry';
  const payload = {
    name,
    email,
    phone,
    guests: guests || 'Not specified',
    inquiry_type: inquiryType,
    property: propertyTitle,
    checkIn: checkIn || 'Not specified',
    checkOut: checkOut || 'Not specified',
    message,
    _subject: `${inquiryType}: ${propertyTitle}`,
  };

  try {
    const res = await fetch(`https://formspree.io/f/${INQUIRY_FORM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) showSuccess('inquiry');
    else throw new Error(res.status);
  } catch (err) {
    showErr(
      'inquiry',
      'Something went wrong. Email us at beachgirloob@gmail.com or call (207) 450-7347.'
    );
    if (btn) {
      btn.textContent = originalLabel || 'Send Message →';
      btn.disabled = false;
    }
  }
}

// ── REVIEW SUBMIT ─────────────────────────────────────────────────────
async function submitReview() {
  const propEl = document.getElementById('r-property');
  const datesEl = document.getElementById('r-dates');
  const nameEl = document.getElementById('r-name') || document.getElementById('r-author');
  const reviewEl = document.getElementById('r-review');

  const prop = propEl?.value || '';
  const dates = datesEl?.value.trim() || '';
  const name = nameEl?.value.trim() || '';
  const review = reviewEl?.value.trim() || '';

  if (!prop || !name || !review || !_currentRating) {
    return showErr('review', 'Please fill in all required fields and select a rating.');
  }
  if (review.length > 2000) {
    return showErr('review', 'Review must be under 2000 characters.');
  }

  const btn = document.querySelector('[data-action="submit-review"]');
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'Submitting…';
    btn.disabled = true;
  }

  const payload = {
    property: prop,
    dates: dates || 'Not specified',
    author: name,
    rating: _currentRating,
    review,
    _subject: `Review Submission: ${prop}`,
  };

  try {
    const res = await fetch(`https://formspree.io/f/${REVIEW_FORM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) showSuccess('review');
    else throw new Error(res.status);
  } catch (err) {
    showErr('review', 'Something went wrong. Please try again.');
    if (btn) {
      btn.textContent = originalLabel || 'Submit Review →';
      btn.disabled = false;
    }
  }
}

function showErr(type, msg) {
  const v = document.getElementById(`${type}-form-view`);
  if (!v) {
    console.warn(`[forms] missing ${type}-form-view`);
    return;
  }
  let e = v.querySelector('.form-err');
  if (!e) {
    e = document.createElement('p');
    e.className = 'form-err';
    e.setAttribute('role', 'alert');
    const submitBtn = v.querySelector('[data-action^="submit-"]');
    if (submitBtn) submitBtn.before(e);
    else v.prepend(e);
  }
  e.textContent = msg;
}

function showSuccess(type) {
  const view = document.getElementById(`${type}-form-view`);
  const success = document.getElementById(`${type}-success`);
  if (view) view.style.display = 'none';
  if (success) success.classList.add('show');
}
