# ── Global security headers ──────────────────────────────────────────────────
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-XSS-Protection: 1; mode=block
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://identity.netlify.com https://cdn.jsdelivr.net https://formspree.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://formspree.io https://api.netlify.com https://*.netlify.com https://nominatim.openstreetmap.org; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://formspree.io;

# ── Admin panel ───────────────────────────────────────────────────────────────
/manage-listings-apm/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store, no-cache, must-revalidate
  Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://identity.netlify.com https://api.netlify.com https://*.netlify.com https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.netlify.com https://*.netlify.com https://formspree.io;

# ── Static assets - cache aggressively ───────────────────────────────────────
/photos/*
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=86400
