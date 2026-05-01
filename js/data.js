// data.js — data fetching with safe fallback behavior
// Demo data is ONLY used in dev/preview hosts. In production (custom domain or
// netlify.app deploy), an empty index renders the empty state instead of fake
// listings — preventing fictional properties from appearing if a build fails.

import { DEMO_PROPS, DEMO_REVIEWS, DEMO_POSTS } from './demo-data.js';

const PROD_HOSTS = ['beachgirlpropertyrentals.com', 'www.beachgirlpropertyrentals.com'];

function isProd() {
  return PROD_HOSTS.includes(window.location.hostname);
}

function fetchSafe(url, ms = 8000) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal })
    .then(r => { clearTimeout(id); return r; })
    .catch(() => { clearTimeout(id); return null; });
}

async function fetchJson(url) {
  const r = await fetchSafe(url);
  if (!r || !r.ok) return [];
  try { return await r.json(); } catch { return []; }
}

export async function loadAll() {
  const [props, revs, posts] = await Promise.all([
    fetchJson('/listings-index.json'),
    fetchJson('/reviews-index.json'),
    fetchJson('/posts-index.json'),
  ]);

  // In production, an empty/failed fetch yields an empty list — never demo data.
  // In dev/preview, demo data fills in so the layout can be inspected.
  const prod = isProd();

  return {
    properties: props.length ? props.filter(p => p.active !== false)
                             : (prod ? [] : DEMO_PROPS),
    reviews:    revs.length  ? revs.filter(r => r.approved === true)
                             : (prod ? [] : DEMO_REVIEWS),
    posts:      posts.length ? posts
                             : (prod ? [] : DEMO_POSTS),
  };
}

// XSS-safe text → HTML helper. Used everywhere strings hit innerHTML.
export function esc(s) {
  if (typeof s !== 'string') return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

export function renderStars(n) {
  const f = Math.round(Math.min(5, Math.max(0, n || 0)));
  return '★'.repeat(f) + '☆'.repeat(5 - f);
}
