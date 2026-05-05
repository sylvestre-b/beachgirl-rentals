// i18n.js — minimal in-page language switching.
//
// How it works:
//   1. Pick a language: ?lang=fr in URL > localStorage > <html lang> > navigator.language
//   2. Fetch /translations/<lang>.json
//   3. Walk the DOM and swap textContent for any element with [data-i18n="key.path"]
//      - [data-i18n-attr="placeholder:key"] sets attributes instead of text
//      - [data-i18n-html="key"] sets innerHTML (use sparingly, trusted strings only)
//   4. Wire the EN | FR toggle in the header
//
// The cookie banner gates whether we *persist* the choice. If cookies are
// declined, language switching still works for the session but resets next
// visit — this is the correct behavior for a strictly-necessary-only stance.
//
// No dependencies. Vanilla JS. Loads in <14kb of network for both files.

const SUPPORTED = ['en', 'fr'];
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'bg_lang';

let _dict = null;
let _currentLang = null;

// ── language detection ─────────────────────────────────────────────────
function detectLang() {
  // 1. URL override (highest priority — shareable links)
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  if (urlLang && SUPPORTED.includes(urlLang)) return urlLang;

  // 2. localStorage (only if cookies/storage consented)
  if (consentGiven()) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch {
      // localStorage blocked / unavailable; fall through
    }
  }

  // 3. <html lang="..."> attribute
  const htmlLang = (document.documentElement.lang || '').toLowerCase().split('-')[0];
  if (SUPPORTED.includes(htmlLang)) return htmlLang;

  // 4. Browser preference
  const navLang = (navigator.language || '').toLowerCase().split('-')[0];
  if (SUPPORTED.includes(navLang)) return navLang;

  return DEFAULT_LANG;
}

function consentGiven() {
  // The cookie banner sets this before localStorage.setItem is allowed.
  // Default to false (privacy-respecting) until explicit acknowledgment.
  try {
    return localStorage.getItem('bg_consent') === 'ok';
  } catch {
    return false;
  }
}

// ── lookup helper: get('hero.title_em') → "Maine summer" ───────────────
function lookup(key) {
  if (!_dict) return key;
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== null && obj[k] !== undefined ? obj[k] : null), _dict) || key;
}

// ── DOM apply ──────────────────────────────────────────────────────────
function applyTranslations(root = document) {
  // Element text content
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = lookup(key);
    if (typeof val === 'string') el.textContent = val;
  });

  // Element innerHTML (for strings with safe inline tags like <em>)
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const val = lookup(key);
    if (typeof val === 'string') el.innerHTML = val;
  });

  // Attributes — `data-i18n-attr="placeholder:inquiry.name"` (comma-sep allowed)
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr')
      .split(',')
      .forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        const val = lookup(key);
        if (attr && typeof val === 'string') el.setAttribute(attr, val);
      });
  });

  // Document title + meta description (special)
  const t = lookup('meta.title');
  if (typeof t === 'string') document.title = t;
  const md = document.querySelector('meta[name="description"]');
  const d = lookup('meta.description');
  if (md && typeof d === 'string') md.setAttribute('content', d);

  // <html lang>
  document.documentElement.lang = _currentLang;
}

// ── public API ─────────────────────────────────────────────────────────
async function setLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  if (lang === _currentLang && _dict) return;

  try {
    const res = await fetch(`/translations/${lang}.json`, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _dict = await res.json();
    _currentLang = lang;
  } catch (err) {
    console.warn('[i18n] failed to load', lang, err);
    if (lang !== DEFAULT_LANG) return setLang(DEFAULT_LANG);
    return;
  }

  applyTranslations();
  if (consentGiven()) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* swallow */
    }
  }
  updateToggleButtons();
  document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
}

function updateToggleButtons() {
  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    const isActive = btn.getAttribute('data-lang-btn') === _currentLang;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function wireToggle() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-lang-btn]');
    if (!btn) return;
    const lang = btn.getAttribute('data-lang-btn');
    setLang(lang);
  });
}

// ── boot ───────────────────────────────────────────────────────────────
export async function initI18n() {
  wireToggle();
  await setLang(detectLang());
}

// Expose getter for other modules (e.g. dynamic listing rendering)
export function t(key) {
  return lookup(key);
}

export function currentLang() {
  return _currentLang || DEFAULT_LANG;
}
