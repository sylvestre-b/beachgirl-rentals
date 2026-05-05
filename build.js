/* eslint-disable no-console */
/**
 * build.js — site builder
 *
 * What this does:
 *  1. Reads listings/, posts/, reviews/ (markdown + frontmatter).
 *  2. Geocodes addresses (rate-limited Nominatim) and caches results in
 *     .geocode-cache.json so we don't re-hit OSM on every build.
 *  3. Renders blog post markdown bodies → HTML up front so the post page
 *     doesn't have to ship a markdown parser.
 *  4. Writes /listings-index.json, /posts-index.json, /reviews-index.json.
 *  5. Generates per-property static HTML at /property/<slug>/index.html so
 *     each property has crawlable, indexable, share-friendly URLs with
 *     real <title> and <meta description> set server-side.
 *  6. Generates /sitemap.xml and /robots.txt.
 *
 * Run before Netlify deploy: `npm run build`.
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const SITE_URL = 'https://beachgirlpropertyrentals.com';
const PUBLIC_DIR = ROOT; // we write into the repo root which Netlify publishes
const GEOCODE_CACHE_FILE = path.join(ROOT, '.geocode-cache.json');

// ── Helpers ────────────────────────────────────────────────────────
function readDirSafe(dir) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

function readMatter(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return matter(raw);
  } catch {
    return null;
  }
}

function slugify(filename) {
  return filename
    .replace(/\.md$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
}

function loadGeocodeCache() {
  try {
    return JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveGeocodeCache(c) {
  fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(c, null, 2));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function geocode(address, cache) {
  if (!address) return null;
  if (cache[address]) return cache[address];
  // Rate limit: Nominatim asks 1 req/sec max.
  await sleep(1100);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'beachgirl-rentals-build/1.0 (beachgirloob@gmail.com)' },
    });
    const json = await res.json();
    if (Array.isArray(json) && json[0]) {
      const out = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
      cache[address] = out;
      return out;
    }
  } catch (e) {
    console.warn(`[geocode] failed for "${address}":`, e.message);
  }
  return null;
}

// ── LISTINGS ─────────────────────────────────────────────────────────
async function buildListings() {
  const dir = path.join(ROOT, '_listings');
  const files = readDirSafe(dir);
  const cache = loadGeocodeCache();
  const out = [];

  for (const f of files) {
    const m = readMatter(path.join(dir, f));
    if (!m) continue;
    const fm = m.data || {};
    const slug = fm.slug || slugify(f);

    let lat = fm.lat,
      lng = fm.lng;
    if ((!lat || !lng) && fm.address) {
      const g = await geocode(fm.address, cache);
      if (g) {
        lat = g.lat;
        lng = g.lng;
      }
    }

    out.push({
      _slug: slug,
      title: fm.title || slug,
      type: fm.type || 'Property',
      location: fm.location || '',
      address: fm.address || '',
      bedrooms: fm.bedrooms || 0,
      bathrooms: fm.bathrooms || 0,
      guests: fm.guests || 0,
      price: fm.price || '',
      cleaning_fee: fm.cleaning_fee || 0,
      pet_fee: fm.pet_fee || 0,
      min_nights: fm.min_nights || 1,
      photo: fm.photo || '',
      photos: fm.photos || (fm.photo ? [fm.photo] : []),
      description: (m.content || '').trim(),
      tags: fm.tags || [],
      lat,
      lng,
      active: fm.active !== false,
      availability: fm.availability || [],
    });
  }

  saveGeocodeCache(cache);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'listings-index.json'), JSON.stringify(out));
  console.log(`[build] wrote listings-index.json (${out.length} listings)`);
  return out;
}

// ── REVIEWS ─────────────────────────────────────────────────────────
function buildReviews() {
  const dir = path.join(ROOT, '_reviews');
  const files = readDirSafe(dir);
  const out = [];
  for (const f of files) {
    const m = readMatter(path.join(dir, f));
    if (!m) continue;
    const fm = m.data || {};
    out.push({
      property: fm.property || '',
      author: fm.author || 'Anonymous',
      rating: fm.rating || 5,
      date: fm.date || '',
      approved: fm.approved === true,
      text: (m.content || '').trim(),
    });
  }
  fs.writeFileSync(path.join(PUBLIC_DIR, 'reviews-index.json'), JSON.stringify(out));
  console.log(`[build] wrote reviews-index.json (${out.length} reviews)`);
  return out;
}

// ── POSTS ───────────────────────────────────────────────────────────
function buildPosts() {
  const dir = path.join(ROOT, '_posts');
  const files = readDirSafe(dir);
  const out = [];
  for (const f of files) {
    const m = readMatter(path.join(dir, f));
    if (!m) continue;
    const fm = m.data || {};
    const slug = fm.slug || slugify(f);
    out.push({
      _slug: slug,
      title: fm.title || slug,
      date: fm.date || '',
      category: fm.category || '',
      excerpt: fm.excerpt || '',
      photo: fm.photo || '',
      emoji: fm.emoji || '',
      bodyHTML: marked.parse(m.content || ''),
    });
  }
  // Sort newest first
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'posts-index.json'), JSON.stringify(out));
  console.log(`[build] wrote posts-index.json (${out.length} posts)`);
  return out;
}

// ── PER-PROPERTY HTML ────────────────────────────────────────────────
function generatePropertyPages(listings) {
  const tmpl = fs.readFileSync(path.join(ROOT, 'property.html'), 'utf8');
  const dir = path.join(PUBLIC_DIR, 'property');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const p of listings) {
    const desc = (p.description || '').replace(/\s+/g, ' ').slice(0, 160);
    const html = tmpl
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${esc(p.title)} — Beach Girl Property Rentals</title>`
      )
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${escAttr(desc)}">`
      );
    const slugDir = path.join(dir, p._slug);
    if (!fs.existsSync(slugDir)) fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'index.html'), html);
  }
  console.log(`[build] wrote ${listings.length} property pages`);
}

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}
function escAttr(s) {
  return esc(s);
}

// ── AVAILABILITY VALIDATION ─────────────────────────────────────────
const _ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const _VALID_STATUSES = new Set(['available', 'unavailable']);

function validateAvailability(listings) {
  let allOk = true;

  for (const listing of listings) {
    const entries = listing.availability;
    if (!Array.isArray(entries) || entries.length === 0) continue;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const tag = `[validate] ${listing._slug} availability[${i}]`;
      let ok = true;

      if (!entry || typeof entry !== 'object') {
        console.error(`${tag}: entry is not an object — got ${JSON.stringify(entry)}`);
        ok = false;
      } else {
        if (!('date' in entry)) {
          console.error(`${tag}: missing required field \`date\``);
          ok = false;
        } else if (typeof entry.date !== 'string' || !_ISO_DATE_RE.test(entry.date)) {
          console.error(
            `${tag}: \`date\` must be a YYYY-MM-DD string, got ${JSON.stringify(entry.date)}`
          );
          ok = false;
        }

        if (!('status' in entry)) {
          console.error(`${tag}: missing required field \`status\``);
          ok = false;
        } else if (!_VALID_STATUSES.has(entry.status)) {
          console.error(
            `${tag}: \`status\` must be "available" or "unavailable", ` +
              `got ${JSON.stringify(entry.status)}`
          );
          ok = false;
        }
      }

      if (!ok) allOk = false;
    }
  }

  if (!allOk) {
    console.error(
      '\n[validate] ✗ Availability validation failed — fix the errors above and re-run build.'
    );
    process.exit(1);
  }

  console.log('[validate] ✓ availability entries OK');
}

// ── SITEMAP & ROBOTS ────────────────────────────────────────────────
function writeSitemap(listings, posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/blog`,
    `${SITE_URL}/reviews`,
    ...listings.map(p => `${SITE_URL}/property/${p._slug}`),
    ...posts.map(p => `${SITE_URL}/blog/${p._slug}`),
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`),
    '</urlset>',
  ].join('\n');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), xml);
  console.log(`[build] wrote sitemap.xml (${urls.length} urls)`);
}

function writeRobots() {
  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /manage-listings-apm/',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robots);
  console.log('[build] wrote robots.txt');
}

// ── MAIN ────────────────────────────────────────────────────────────
(async () => {
  try {
    const [listings, , posts] = await Promise.all([
      buildListings(),
      Promise.resolve(buildReviews()),
      Promise.resolve(buildPosts()),
    ]);
    generatePropertyPages(listings);
    validateAvailability(listings);
    writeSitemap(listings, posts);
    writeRobots();
    console.log('[build] ✓ done');
  } catch (e) {
    console.error('[build] ✗ failed:', e);
    process.exit(1);
  }
})();
