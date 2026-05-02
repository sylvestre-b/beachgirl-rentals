# Beach Girl Property Rentals — v2.0 Drop

Warm-modern, slightly cinematic redesign + structural fixes. Drop these files into the repo root, replacing the old ones (the existing `_listings/`, `_reviews/`, `_posts/`, `manage-listings-apm/`, and `photos/` folders stay).

---

## What's in this drop

### Architecture (performance items 1, 4, 6, 7)

- **`styles/` (6 files)** — CSS deduplicated. Every page now reads from one set of stylesheets instead of inlining hundreds of lines per HTML file. Single source of design tokens.
- **`js/` (10 files)** — All inline `<script>` blocks pulled out into ES modules. Zero `onclick=` attributes left. Single delegated click handler in `main.js`. Compatible with strict CSP.
- **`scripts/optimize-images.js`** — Sharp-based image pipeline. Drop a JPEG into `photos/`, run `npm run images`, get five WebP variants (160 / 480 / 800 / 1200 / 1600). Idempotent — only rebuilds what changed.
- **CI** (`.github/workflows/ci.yml`) — ESLint + Prettier + html-validate + build smoke test on every PR and push to main. Lighthouse CI runs on PRs (warns < 85 perf, errors < 95 a11y).

### Critical correctness fixes (P0)

| Was                                                            | Now                                                                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar default = available; unmarked dates appeared bookable | Default = **unavailable**. Listings must mark every available window explicitly.                                                                                                       |
| Mobile map button hidden by `display:none !important`          | Mobile FAB (`#map-toggle`) wires up; map opens fullscreen.                                                                                                                             |
| Inquiry form accepted submissions with no dates or guest count | Booking-type inquiries now **require** check-in, check-out, and guest count.                                                                                                           |
| "View & Book →" CTA — but it was an inquiry                    | Now reads "View & Inquire" / "Send Inquiry". Honest.                                                                                                                                   |
| No fees disclosed; flat weekly rate only                       | Property page has a fees block: cleaning fee, pet fee (if any), 9% Maine lodging tax callout.                                                                                          |
| Demo data shown if data fetch failed in production             | Demo data now **only shows on dev / preview hosts**. Production renders the empty state on a load failure. Easy to delete entirely (`js/demo-data.js`) once real listings are flowing. |

### Stylistic redesign (all 13 items)

1. **Photography placeholders** — every image position has a styled grey/sand block that fills the slot until real photos arrive. Fits the layout exactly so swapping in real photos is one Decap edit.
2. **Hero Ken Burns + cross-fade** — `js/hero.js` runs a slow zoom on hero-1, cross-fades to hero-2 at 6.5s. Reduced-motion users see a static image.
3. **Flat photo replaced** — old hero gradient replaced with a layered hero (Ken Burns BG + parallax FG slot for an SVG dune).
4. **Section transitions** — four asymmetric SVG dune dividers between hero/owner/listings/reviews/blog/footer. Pick up theme color via `currentColor`.
5. **Reveal-on-scroll** — `js/reveal.js` uses IntersectionObserver. Add `data-reveal` to anything that should fade up. Stagger via `data-reveal-children`.
6. **Card hover** — refined: 4px lift, image slow-scales 1.045, border darkens to driftwood, CTA arrow nudges right.
7. **Texture** — site-wide SVG noise overlay at 0.04 opacity, multiply blend mode. Adds warmth without weight.
8. **Type system** — DM Sans (300/400/500/700) + Playfair Display (500/700, both italics). Single Google Fonts call. Lato dropped.
9. **Polaroid review cards** — homepage carousel only. Slight rotation per card, masking-tape effect at top, settles to 0deg on hover. Reviews page stays as a clean grid (better for scanning many).
10. **Map pins with thumbnails** — custom Leaflet `divIcon` shows a 48px circular thumb of the property's first photo (`-160.webp` variant). Falls back to a sand-colored disc with the property's first letter in Playfair italic when no photo exists.
11. **Owner moment area** — homepage section between hero and listings. Polaroid-style portrait placeholder + 3-line filler copy + signature. Ready to fill in.
12. **Don't-adds — complied with** — no AI-generated stock photos, no fake awards/badges, no testimonial inflation, no countdown timers, no "as seen on" logos.
13. **Color shift** — accent warmed to `#c25e54` (sun-coral). Driftwood family added (`#8a6d5b`, `#ae9580`, `#d4c0ad`). Teal nudged greener to `#5a9aa0`. All in `styles/tokens.css`.

### Build pipeline updates

- **`build.js`** — geocodes addresses at build time using Nominatim with 1.1s rate-limit and a `.geocode-cache.json` so we don't re-hit OSM. Generates per-property HTML pages at `/property/<slug>/index.html` with proper server-side `<title>` and `<meta description>`. Generates `sitemap.xml` and `robots.txt`. Pre-renders blog post markdown to HTML (post page no longer needs `marked.js` client-side).
- **Schema.org markup** — `LodgingBusiness` on home, `VacationRental` + `Offers` + `AggregateRating` + `GeoCoordinates` on property pages.
- **`netlify.toml`** — adds HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and a moderately strict CSP. Cache headers added for static assets.

---

## Deploy steps

```bash
# 1. Pull this drop into your repo root (replace existing files)
# 2. Install deps
npm install

# 3. Run the build (generates indexes, geocodes, per-property pages, sitemap)
npm run build

# 4. Optimize images (only matters once real photos exist in /photos)
npm run images

# 5. Test locally
npx serve .   # or any static server

# 6. Run the test suite before pushing
npm test
```

When you push to main, Netlify will run `npm install && npm run build` (per `netlify.toml`) and deploy.

---

## Front-matter additions for `_listings/`

The new property page expects these fields. Most are optional with sensible defaults — but for full feature parity, add them to your Decap CMS config and to existing listing files:

```yaml
---
title: Harborview Cottage
slug: harborview-cottage
type: Cottage
location: Old Orchard Beach, ME
address: 1 Temple Ave, Old Orchard Beach, ME # used for build-time geocode
bedrooms: 3
bathrooms: 2
guests: 6
price: $2,400
cleaning_fee: 175
pet_fee: 50
min_nights: 7
photo: /photos/harborview/main.jpg # main hero image
photos: # gallery (in order)
  - /photos/harborview/main.jpg
  - /photos/harborview/porch.jpg
  - /photos/harborview/kitchen.jpg
tags: [pet-friendly, waterfront]
active: true
availability:
  - { date: '2026-07-04', status: 'available' }
  - { date: '2026-07-05', status: 'available' }
  # ... explicitly mark every available night
---
(Description goes here as the markdown body.)
```

**Important:** because the calendar now defaults to unavailable, you must explicitly mark every available date. This is correct behaviour — it's how forgotten admin updates stop turning into double-bookings.

---

## What's NOT in this drop (deliberately, per your scope)

- **Stripe payments** — not yet, you said later.
- **/manage-listings-apm/ obscurity** — you said current scaling is fine; not changing CMS path.
- **FAQ section** — wasn't in scope this round.
- **Quebec/French-Canadian content** — wasn't in scope this round.
- **`index__1_.html`** — you said you'd delete it.

---

## Files changed / added

```
beachgirl-rentals/
├── README.md                         (this file)
├── package.json                      (UPDATED — adds sharp, marked, gray-matter, dev tools)
├── netlify.toml                      (UPDATED — security headers, cache rules)
├── build.js                          (UPDATED — build-time geocode, per-property HTML, sitemap)
├── calendar.js                       (UPDATED — default unavailable, no inline handlers)
├── calendar.css                      (UPDATED — token-driven colors)
├── index.html                        (REWRITE — slim, shared CSS/JS, owner panel, dividers)
├── property.html                     (REWRITE — slim, fees block, honest CTA)
├── reviews.html                      (REWRITE — slim, clean grid)
├── blog.html                         (REWRITE — slim)
├── blog-post.html                    (REWRITE — slim, server-rendered markdown)
├── 404.html                          (REWRITE — on-brand)
├── styles/
│   ├── tokens.css                    (NEW — design tokens, warmer palette)
│   ├── base.css                      (NEW — reset, typography, noise overlay)
│   ├── motion.css                    (NEW — reveal, ken burns, hover, modal)
│   ├── components.css                (NEW — buttons, cards, polaroid reviews, forms, modals)
│   ├── layout.css                    (NEW — header, footer, hero, listings, teasers)
│   └── sections.css                  (NEW — dividers, owner panel, property page)
├── js/
│   ├── main.js                       (NEW — entry, event delegation)
│   ├── data.js                       (NEW — fetch + esc + renderStars)
│   ├── demo-data.js                  (NEW — non-prod fallback; delete later)
│   ├── listings.js                   (NEW — render grid, filter, honest CTA)
│   ├── calendar-init.js              (NEW — calendar wiring per slug)
│   ├── forms.js                      (NEW — inquiry + review, required fields)
│   ├── map.js                        (NEW — Leaflet, thumbnail pins, mobile toggle)
│   ├── reveal.js                     (NEW — IntersectionObserver)
│   ├── hero.js                       (NEW — Ken Burns, parallax)
│   └── property.js                   (NEW — property page logic, schema.org, fees)
├── scripts/
│   └── optimize-images.js            (NEW — sharp pipeline)
├── .github/workflows/ci.yml          (NEW — CI)
├── .eslintrc.cjs                     (NEW)
├── .prettierrc.json                  (NEW)
├── .htmlvalidate.json                (NEW)
└── lighthouse.config.cjs             (NEW)
```

You said you'd delete `index__1_.html`. The Decap CMS path under `/manage-listings-apm/` is unchanged.
