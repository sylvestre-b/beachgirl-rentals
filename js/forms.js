// forms.js — inquiry + review form submission
// P0 FIX: inquiry form now REQUIRES check-in, check-out, and guest count.
// Without this, sister was getting "Not specified" emails and having to ask
// every guest the basics over again.

import { esc } from './data.js';
import { getSelected } from './calendar-init.js';

const INQUIRY_FORM_ID = 'xbdwrlgl';
const REVIEW_FORM_ID  = 'xjglbglj';

// Holds context the inquiry modal needs about the property being asked about
let _modalProperty = null;
let _allProperties = [];
let _lastFocused = null;
let _currentRating = 0;

export function initForms(state) {
  _allProperties = state.properties;
  populateReviewSelect();
  wireStarPicker();
  wireFormButtons();
}

function wireFormButtons() {
  const sendBtn = document.querySelector('[data-action="submit-inquiry"]');
  if (sendBtn) sendBtn.addEventListener('click', submitInquiry);

  const reviewBtn = document.querySelector('[data-action="submit-review"]');
  if (reviewBtn) reviewBtn.addEventListener('click', submitReview);

  // Header / hero buttons that open the generic inquiry modal
  document.querySelectorAll('[data-action="open-inquiry"]').forEach(btn => {
    btn.addEventListener('click', () => openInquiryModal(null));
  });
  document.querySelectorAll('[data-action="open-review"]').forEach(btn => {
    btn.addEventListener('click', openReviewModal);
  });
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.getAttribute('data-target')));
  });

  // Overlay click closes
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
}

export function openInquiryModal(slug) {
  _lastFocused = document.activeElement;
  const p = slug ? _allProperties.find(x => x._slug === slug) : null;
  const sel = slug ? getSelected(slug) : { checkIn: null, checkOut: null };
  _modalProperty = p;

  document.getElementById('inquiry-title').textContent =
    p ? `Let's chat about ${p.title}` : "Let's chat about your stay";

  const sum = document.getElementById('inquiry-summary');
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

  document.getElementById('inquiry-form-view').style.display = 'block';
  document.getElementById('inquiry-success').classList.remove('show');
  ['i-first','i-last','i-email','i-phone','i-message','i-checkin','i-checkout'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const guestsEl = document.getElementById('i-guests');
  if (guestsEl) guestsEl.value = '';

  // Pre-fill dates if calendar already has a selection
  if (p && sel.checkIn && sel.checkOut) {
    const ci = document.getElementById('i-checkin');
    const co = document.getElementById('i-checkout');
    if (ci) ci.value = sel.checkIn;
    if (co) co.value = sel.checkOut;
  }

  const ov = document.getElementById('inquiry-overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  ov.querySelector('.modal-close').focus();
}

export function openReviewModal() {
  _lastFocused = document.activeElement;
  document.getElementById('review-form-view').style.display = 'block';
  document.getElementById('review-success').classList.remove('show');
  const ov = document.getElementById('review-overlay');
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  ov.querySelector('.modal-close').focus();
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  document.body.style.overflow = '';
  if (_lastFocused) { _lastFocused.focus(); _lastFocused = null; }
}

function populateReviewSelect() {
  const sel = document.getElementById('r-property');
  if (!sel) return;
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
  const first   = document.getElementById('i-first').value.trim();
  const last    = document.getElementById('i-last').value.trim();
  const email   = document.getElementById('i-email').value.trim();
  const phone   = document.getElementById('i-phone').value.trim();
  const guests  = document.getElementById('i-guests').value;
  const checkIn = document.getElementById('i-checkin').value;
  const checkOut= document.getElementById('i-checkout').value;
  const message = document.getElementById('i-message').value.trim();
  const inquiryType = (document.querySelector('input[name="inquiry_type"]:checked')?.value) || 'Booking Request';

  // Required field checks — names, email, dates, guest count
  if (!first || !last || !email) {
    return showErr('inquiry', 'Please fill in your name and email.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showErr('inquiry', 'Please enter a valid email address.');
  }
  // For booking requests we require dates + guest count.
  // General questions don't need them.
  if (inquiryType === 'Booking Request') {
    if (!checkIn || !checkOut) {
      return showErr('inquiry', 'Please select a check-in and check-out date so we can confirm availability.');
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      return showErr('inquiry', 'Check-out must be after check-in.');
    }
    if (!guests) {
      return showErr('inquiry', 'How many guests are you planning for?');
    }
  }

  const btn = document.querySelector('[data-action="submit-inquiry"]');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  const payload = {
    name: `${first} ${last}`,
    email, phone,
    guests: guests || 'Not specified',
    inquiry_type: inquiryType,
    property: _modalProperty?.title || 'General inquiry',
    checkIn:  checkIn  || 'Not specified',
    checkOut: checkOut || 'Not specified',
    message,
    _subject: `${inquiryType}: ${_modalProperty?.title || 'General'}`,
  };

  try {
    const res = await fetch(`https://formspree.io/f/${INQUIRY_FORM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) showSuccess('inquiry');
    else throw new Error(res.status);
  } catch (err) {
    showErr('inquiry', 'Something went wrong. Email us at beachgirloob@gmail.com or call (207) 450-7347.');
    btn.textContent = 'Send Message →';
    btn.disabled = false;
  }
}

// ── REVIEW SUBMIT ─────────────────────────────────────────────────────
async function submitReview() {
  const prop   = document.getElementById('r-property').value;
  const dates  = document.getElementById('r-dates').value.trim();
  const name   = document.getElementById('r-name').value.trim();
  const review = document.getElementById('r-review').value.trim();

  if (!prop || !dates || !name || !review || !_currentRating) {
    return showErr('review', 'Please fill in all fields and select a rating.');
  }
  if (review.length > 2000) {
    return showErr('review', 'Review must be under 2000 characters.');
  }

  const btn = document.querySelector('[data-action="submit-review"]');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  const payload = {
    property: prop, dates, author: name,
    rating: _currentRating, review,
    _subject: `Review Submission: ${prop}`,
  };

  try {
    const res = await fetch(`https://formspree.io/f/${REVIEW_FORM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) showSuccess('review');
    else throw new Error(res.status);
  } catch (err) {
    showErr('review', 'Something went wrong. Please try again.');
    btn.textContent = 'Submit Review →';
    btn.disabled = false;
  }
}

function showErr(type, msg) {
  const v = document.getElementById(`${type}-form-view`);
  if (!v) return;
  let e = v.querySelector('.form-err');
  if (!e) {
    e = document.createElement('p');
    e.className = 'form-err';
    e.setAttribute('role', 'alert');
    const submitBtn = v.querySelector('[data-action^="submit-"]');
    if (submitBtn) submitBtn.before(e);
  }
  e.textContent = msg;
}

function showSuccess(type) {
  if (type === 'inquiry') {
    document.getElementById('inquiry-form-view').style.display = 'none';
    document.getElementById('inquiry-success').classList.add('show');
  } else {
    document.getElementById('review-form-view').style.display = 'none';
    document.getElementById('review-success').classList.add('show');
  }
}
