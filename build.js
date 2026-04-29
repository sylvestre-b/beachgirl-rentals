// build.js — Netlify build script
const fs     = require('fs');
const path   = require('path');
const matter = require('gray-matter');

// ── Expand availability date ranges into per-day entries ──────────────────
function expandAvailability(availability) {
  if (!Array.isArray(availability)) return [];
  const days = [];
  availability.forEach(({ start, end, status }) => {
    if (!start || !end || !status) return;
    const s = new Date(start); s.setHours(0,0,0,0);
    const e = new Date(end);   e.setHours(0,0,0,0);
    let d = new Date(s);
    while (d <= e) {
      days.push({ date: d.toISOString().slice(0,10), status });
      d.setDate(d.getDate() + 1);
    }
  });
  // Later entries override earlier ones (allows corrections)
  const map = {};
  days.forEach(d => { map[d.date] = d.status; });
  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([date, status]) => ({ date, status }));
}

// ── Minimal markdown-to-HTML ──────────────────────────────────────────────
function mdToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|ol|li|hr|blockquote)/.test(block)) return block;
      return `<p>${block.replace(/\n/g,' ')}</p>`;
    })
    .join('\n');
}

// ── Generic dir reader ────────────────────────────────────────────────────
function readDir(dir, outFile, requiredField, opts = {}) {
  if (!fs.existsSync(dir)) {
    fs.writeFileSync(outFile, JSON.stringify([], null, 2));
    console.log(`  No ${path.basename(dir)}/ — wrote empty index.`);
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
  const items = files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const { data, content } = matter(raw);
      data._slug = path.basename(file, '.md');

      // Expand availability ranges for listings
      if (opts.expandAvail && data.availability) {
        data.availability = expandAvailability(data.availability);
      }

      // Convert markdown body for posts
      if (opts.includeBody) {
        if (data.body) {
          data.body = mdToHtml(data.body);
        } else if (content && content.trim()) {
          data.body = mdToHtml(content.trim());
        }
      }

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
readDir(path.join(__dirname,'_listings'), path.join(__dirname,'listings-index.json'), 'title',    { expandAvail: true  });
readDir(path.join(__dirname,'_reviews'),  path.join(__dirname,'reviews-index.json'),  'property', {                    });
readDir(path.join(__dirname,'_posts'),    path.join(__dirname,'posts-index.json'),    'title',    { includeBody: true  });
console.log('Done.');
