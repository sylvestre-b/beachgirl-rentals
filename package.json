// build.js — Netlify build script
// Generates JSON indexes from markdown content files

const fs     = require('fs');
const path   = require('path');
const matter = require('gray-matter');

function readDir(dir, outFile, requiredField) {
  if (!fs.existsSync(dir)) {
    fs.writeFileSync(outFile, JSON.stringify([], null, 2));
    console.log(`  No ${path.basename(dir)}/ directory — wrote empty index.`);
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
  const items = files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const { data } = matter(raw);
      data._slug = path.basename(file, '.md');
      return data;
    } catch (err) {
      console.warn(`  Warning: could not parse ${file} — skipping. (${err.message})`);
      return null;
    }
  }).filter(p => p && p[requiredField]);

  fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
  console.log(`  Built ${path.basename(outFile)} with ${items.length} item(s).`);
}

console.log('Building site indexes...');
readDir(path.join(__dirname, '_listings'), path.join(__dirname, 'listings-index.json'), 'title');
readDir(path.join(__dirname, '_reviews'),  path.join(__dirname, 'reviews-index.json'),  'property');
readDir(path.join(__dirname, '_posts'),    path.join(__dirname, 'posts-index.json'),    'title');
console.log('Done.');
