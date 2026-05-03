/* eslint-disable no-console */
/**
 * setup-hero.js — ONE-TIME bootstrap helper.
 *
 * Downloads the chosen hero image (Unsplash, free license) into
 * /photos/hero/hero-1.jpg. Then `npm run images` will resize it into the
 * -480/-800/-1200/-1600.webp variants the hero markup expects.
 *
 * Why this exists: we don't want to depend on Unsplash at runtime (CSP
 * complications, perf, third-party reliance). One file, one time, done.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HERO_URL =
  'https://images.unsplash.com/photo-1585694384838-f983d95c8113?q=80&w=1740&auto=format&fit=crop';

const OUT = path.join(__dirname, '..', 'photos', 'hero', 'hero-1.jpg');

function follow(url, dest, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          return resolve(follow(res.headers.location, dest, depth + 1));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  if (fs.existsSync(OUT)) {
    console.log(`[skip]  hero already exists at ${OUT}`);
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  try {
    await follow(HERO_URL, OUT);
    console.log(`[ok]    saved hero to ${OUT}`);
    console.log('Next:   npm run images');
  } catch (err) {
    console.error('[fail]', err.message);
    process.exit(1);
  }
})();
