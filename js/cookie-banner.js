// cookie-banner.js — minimal, transparent, one-tap dismiss.
//
// Philosophy: this site uses no advertising, no behavioral tracking, no
// analytics. The only browser storage we touch is:
//   - bg_consent     (this banner)
//   - bg_lang        (language preference)
//
// We disclose it, the visitor acknowledges once, and we move on. If they
// never click anything, the banner stays out of the way at the bottom and
// the site still works — language preferences just don't persist between
// visits, which is the privacy-respecting default.
//
// We do NOT block fonts, maps, or form submission. Those are essential for
// the site to function and are not behavioral trackers.
//
// To accept: tap the button. To learn more: read the privacy policy.

import { t, currentLang } from './i18n.js';

const STORAGE_KEY = 'bg_consent';

function alreadyAcknowledged() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ok';
  } catch {
    return true; // localStorage unavailable → don't pester the user
  }
}

function acknowledge() {
  try {
    localStorage.setItem(STORAGE_KEY, 'ok');
  } catch {
    /* ignore */
  }
  const banner = document.getElementById('cookie-banner');
  if (banner) {
    banner.classList.add('is-leaving');
    setTimeout(() => banner.remove(), 350);
  }
  // Notify other modules (i18n) that consent is granted so they can persist.
  document.dispatchEvent(new CustomEvent('consent:granted'));
}

function render() {
  const wrap = document.createElement('div');
  wrap.id = 'cookie-banner';
  wrap.className = 'cookie-banner';
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', currentLang() === 'fr' ? 'Avis sur les témoins' : 'Cookie notice');

  wrap.innerHTML = `
    <p class="cookie-msg" data-i18n="cookie.message">${t('cookie.message')}</p>
    <div class="cookie-actions">
      <a class="cookie-link" href="/legal/privacy.html" data-i18n="cookie.learn">${t('cookie.learn')}</a>
      <button type="button" class="cookie-accept" data-cookie-accept data-i18n="cookie.accept">${t('cookie.accept')}</button>
    </div>
  `;
  document.body.appendChild(wrap);

  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-cookie-accept]')) acknowledge();
  });

  // Update copy when language changes mid-banner-visible
  document.addEventListener('i18n:changed', () => {
    const msg = wrap.querySelector('.cookie-msg');
    const link = wrap.querySelector('.cookie-link');
    const btn = wrap.querySelector('.cookie-accept');
    if (msg) msg.textContent = t('cookie.message');
    if (link) link.textContent = t('cookie.learn');
    if (btn) btn.textContent = t('cookie.accept');
  });
}

export function initCookieBanner() {
  if (alreadyAcknowledged()) return;
  // Defer until after first paint so it doesn't compete with hero
  if (document.readyState === 'complete') {
    setTimeout(render, 1200);
  } else {
    window.addEventListener('load', () => setTimeout(render, 1200));
  }
}
