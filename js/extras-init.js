// extras-init.js — sets up language switching and the cookie banner on
// every page. Runs alongside the page's primary bundle (main.js, etc.) and
// touches no existing modules. Safe to load on any HTML page.

import { initI18n } from './i18n.js';
import { initCookieBanner } from './cookie-banner.js';

(async function () {
  // i18n first (translations are async). The cookie banner waits for load.
  await initI18n();
  initCookieBanner();

  // When the user grants consent later, persist the language they're
  // already viewing in (if not yet stored).
  document.addEventListener('consent:granted', () => {
    try {
      const cur = document.documentElement.lang || 'en';
      if (!localStorage.getItem('bg_lang')) {
        localStorage.setItem('bg_lang', cur);
      }
    } catch {
      /* ignore */
    }
  });
})();
