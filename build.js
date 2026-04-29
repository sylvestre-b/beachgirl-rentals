// build.js — runs automatically on Netlify before deploying
// Reads all markdown files in /_listings/ and outputs /listings-index.json
// Requires: gray-matter (installed via package.json)

const fs     = require('fs');
const path   = require('path');
const matter = require('gray-matter');

const LISTINGS_DIR = path.join(__dirname, '_listings');
const OUTPUT_FILE  = path.join(__dirname, 'listings-index.json');

if (!fs.existsSync(LISTINGS_DIR)) {
  console.log('No _listings directory found — writing empty index.');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
  process.exit(0);
}

const files = fs.readdirSync(LISTINGS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

const listings = files.map(file => {
  try {
    const raw = fs.readFileSync(path.join(LISTINGS_DIR, file), 'utf8');
    const { data } = matter(raw);
    return data;
  } catch (err) {
    console.warn(`Warning: could not parse ${file} — skipping. (${err.message})`);
    return null;
  }
})
.filter(p => p && p.title);

// Sort alphabetically by title
listings.sort((a, b) => a.title.localeCompare(b.title));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(listings, null, 2));
console.log(`Built listings-index.json with ${listings.length} propert${listings.length === 1 ? 'y' : 'ies'}.`);
