/* eslint-disable no-console */
/**
 * import-airbnb-photos.js — ONE-TIME bootstrap helper.
 *
 * Downloads the photos Jill already uploaded to her Airbnb listings into the
 * local /photos/<unit>/ folders so the new site has the same visuals on day
 * one. After this runs, /photos/ is the canonical source — Decap CMS uploads
 * go there going forward, and this script does not need to be run again.
 *
 * RUN ONCE:   node scripts/import-airbnb-photos.js
 *
 * Notes:
 *  - These are Jill's own photos that she uploaded to her Airbnb listings.
 *    She owns the rights to use them on her own site.
 *  - Airbnb's CDN (a0.muscache.com) serves these publicly; we just save them
 *    locally so we don't depend on a third party at runtime.
 *  - If Airbnb URLs ever stop resolving, just delete this script and upload
 *    photos through Decap. The site doesn't depend on it after first run.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');

// Photo URLs gathered from each public listing page.
const PHOTOS = {
  'unit-a': [
    'https://a0.muscache.com/im/pictures/0441a25b-a2b9-45e5-926c-4d94b3e6af82.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/93b453a8-6dab-4b74-bf76-44ad353e2b48.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/7c09eb98-4f4c-4a1f-be25-20efb1af57be.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/90746167-56bc-4bf1-9661-63dd41935faf.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/6f7bd3a5-b0ae-4014-9b8a-8ef5e50259cb.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/4222e1b8-1b4f-4775-8fe1-89e867ce646e.jpg?im_w=1440',
  ],
  'unit-b': [
    'https://a0.muscache.com/im/pictures/f23f4109-cfea-4cf5-b16a-93e0ce319396.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/cadee03b-090b-4be4-8841-417514884b63.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/dd936053-90d5-4d70-bce0-f429f39dcfef.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/83d408e6-d96e-47d1-8902-093c36acdc07.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/c5bc8dc7-e02f-4339-9be9-6c266459560d.jpg?im_w=1440',
  ],
  'unit-c': [
    'https://a0.muscache.com/im/pictures/aec3f360-2de5-40fe-99ac-3f8f9723325d.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/83219048-e49d-4706-a4e9-2979fab7a906.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/092da3bc-81df-490d-b2c0-c05d17374dba.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/6e69e5be-5b1b-47db-afab-850d6988cfe2.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/cf448ac8-26cb-4011-bbfc-5f1ce7ddfb8d.jpg?im_w=1440',
  ],
  'unit-d': [
    'https://a0.muscache.com/im/pictures/a3879ff1-6590-46f9-bea5-21084ee63343.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/b0f570a4-0327-47a2-9c2c-a52e2e554a97.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/a106015f-eb9a-4eee-9df3-f5ae4ff9ddc6.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/3602cff0-5ee3-4db2-9c6d-ede11437710b.jpg?im_w=1440',
    'https://a0.muscache.com/im/pictures/cf5e032d-c42b-41c8-9a4d-e9c52d6a5338.jpg?im_w=1440',
  ],
};

// Friendly filenames in the order each listing's `photos:` array expects them.
// First entry of each array is `main.jpg`. Adjust order in Decap later if
// Jill prefers a different lead photo.
const NAMES = [
  'main.jpg',
  'living.jpg',
  'kitchen.jpg',
  'bedroom-1.jpg',
  'bedroom-2.jpg',
  'bedroom-3.jpg',
  'bath.jpg',
  'yard.jpg',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', err => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

(async () => {
  for (const [unit, urls] of Object.entries(PHOTOS)) {
    const outDir = path.join(ROOT, 'photos', unit);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    for (let i = 0; i < urls.length; i++) {
      const filename = NAMES[i] || `extra-${i}.jpg`;
      const dest = path.join(outDir, filename);
      if (fs.existsSync(dest)) {
        console.log(`[skip]  ${unit}/${filename} (already exists)`);
        continue;
      }
      try {
        await download(urls[i], dest);
        console.log(`[ok]    ${unit}/${filename}`);
      } catch (err) {
        console.warn(`[fail]  ${unit}/${filename}: ${err.message}`);
      }
    }
  }
  console.log('\nDone. Run `npm run images` next to generate WebP variants.');
})();
