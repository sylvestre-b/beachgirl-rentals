/* eslint-disable no-console */
/**
 * optimize-images.js — produce responsive WebP variants
 *
 * Walks /photos recursively. For every .jpg / .jpeg / .png:
 *   - generates -160.webp  (map-pin thumb)
 *   - generates -480.webp  (mobile card)
 *   - generates -800.webp  (desktop card)
 *   - generates -1200.webp (gallery)
 *   - generates -1600.webp (hero)
 * Skips files where the variant already exists and is newer than the source.
 *
 * Run via: `npm run images` (or as part of `npm run build`).
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'photos');
const SIZES = [160, 480, 800, 1200, 1600];

function isImage(f) { return /\.(jpg|jpeg|png)$/i.test(f); }

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else if (entry.isFile() && isImage(entry.name)) results.push(full);
  }
  return results;
}

function variantPath(srcPath, size) {
  const ext = path.extname(srcPath);
  const base = srcPath.slice(0, -ext.length);
  return `${base}-${size}.webp`;
}

function shouldRebuild(srcPath, outPath) {
  if (!fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

(async () => {
  const files = walk(SRC_DIR);
  if (!files.length) {
    console.log('[images] no source images in /photos — skipping.');
    return;
  }
  console.log(`[images] found ${files.length} source images`);

  let built = 0, skipped = 0;
  for (const src of files) {
    for (const size of SIZES) {
      const out = variantPath(src, size);
      if (!shouldRebuild(src, out)) { skipped++; continue; }
      try {
        await sharp(src)
          .resize({ width: size, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(out);
        built++;
      } catch (e) {
        console.warn(`[images] failed ${src} @ ${size}: ${e.message}`);
      }
    }
  }
  console.log(`[images] ✓ built ${built}, skipped ${skipped}`);
})();
