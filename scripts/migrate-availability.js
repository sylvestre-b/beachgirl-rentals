#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/migrate-availability.js
 *
 * One-shot (idempotent) migration: converts range-shaped availability entries
 *   { status, start, end }
 * into the daily-entry shape that calendar.js expects:
 *   { date: 'YYYY-MM-DD', status: 'available' | 'unavailable' }
 *
 * Rules:
 *  - Files already in daily shape are left untouched (idempotent).
 *  - `unavailable` daily entries are dropped — the calendar defaults to
 *    unavailable, so emitting them is redundant noise.
 *  - Any malformed range aborts the file with a clear error; nothing is written.
 *  - The markdown body and every other front-matter field are preserved exactly.
 *
 * Usage:
 *   node scripts/migrate-availability.js
 *   node scripts/migrate-availability.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// ── Config ─────────────────────────────────────────────────────────────────
const LISTINGS_DIR = path.join(__dirname, '..', '_listings');
const DRY_RUN = process.argv.includes('--dry-run');
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string as a local midnight Date (no timezone shift). */
function parseISO(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD. */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when str is a valid YYYY-MM-DD and actually a real calendar date. */
function isValidISO(str) {
  if (typeof str !== 'string' || !ISO_RE.test(str)) return false;
  const d = parseISO(str);
  return !isNaN(d.getTime());
}

/**
 * Detect which shape the availability array uses.
 * Returns 'daily' | 'range' | 'empty' | 'mixed' (error).
 */
function detectShape(entries) {
  if (!entries || entries.length === 0) return 'empty';

  let hasDailyFields = 0;
  let hasRangeFields = 0;

  for (const e of entries) {
    if (typeof e !== 'object' || e === null) continue;
    if ('date' in e) hasDailyFields++;
    if ('start' in e || 'end' in e) hasRangeFields++;
  }

  if (hasDailyFields > 0 && hasRangeFields === 0) return 'daily';
  if (hasRangeFields > 0 && hasDailyFields === 0) return 'range';
  if (hasDailyFields === 0 && hasRangeFields === 0) return 'empty';
  return 'mixed';
}

/**
 * Expand a single range entry → array of daily entries.
 * Throws a descriptive Error on any validation failure.
 */
function expandRange(entry, index) {
  const tag = `entry[${index}]`;

  const status = entry.status;
  if (status !== 'available' && status !== 'unavailable') {
    throw new Error(
      `${tag}: \`status\` must be "available" or "unavailable", got: ${JSON.stringify(status)}`
    );
  }

  const start = entry.start;
  const end = entry.end;

  if (!isValidISO(start)) {
    throw new Error(
      `${tag}: \`start\` is not a valid YYYY-MM-DD date, got: ${JSON.stringify(start)}`
    );
  }
  if (!isValidISO(end)) {
    throw new Error(`${tag}: \`end\` is not a valid YYYY-MM-DD date, got: ${JSON.stringify(end)}`);
  }

  const startDate = parseISO(start);
  const endDate = parseISO(end);

  if (endDate < startDate) {
    throw new Error(`${tag}: \`end\` (${end}) is before \`start\` (${start})`);
  }

  const days = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    days.push({ date: toISO(cur), status });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Stringify the front-matter back to YAML-in-markdown.
 * gray-matter's stringify preserves the body exactly.
 */
function serialise(parsed) {
  return matter.stringify(parsed.content, parsed.data);
}

// ── Per-file processing ────────────────────────────────────────────────────

function processFile(filePath) {
  const filename = path.basename(filePath);
  const result = { file: filename, status: null, expanded: 0, dropped: 0, errors: [] };

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    result.status = 'read-error';
    result.errors.push(e.message);
    return result;
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (e) {
    result.status = 'parse-error';
    result.errors.push(`gray-matter: ${e.message}`);
    return result;
  }

  const availability = parsed.data.availability;
  const shape = detectShape(availability);

  // ── Already daily (or empty) — nothing to do ──────────────────────────
  if (shape === 'daily' || shape === 'empty') {
    result.status = 'skipped';
    return result;
  }

  // ── Mixed shape — bail, don't touch the file ──────────────────────────
  if (shape === 'mixed') {
    result.status = 'error';
    result.errors.push(
      'Availability array contains a mix of daily-shape and range-shape entries. ' +
        'Inspect and fix manually before re-running.'
    );
    return result;
  }

  // ── Range shape — expand ──────────────────────────────────────────────
  const expanded = [];
  for (let i = 0; i < availability.length; i++) {
    let days;
    try {
      days = expandRange(availability[i], i);
    } catch (e) {
      result.status = 'error';
      result.errors.push(e.message);
      return result; // bail — do NOT write partial output
    }
    expanded.push(...days);
  }

  // Deduplicate by date (last range wins, consistent with manual-entry behaviour)
  const seen = new Map();
  for (const entry of expanded) {
    seen.set(entry.date, entry.status);
  }

  // Drop `unavailable` entries (calendar defaults to unavailable — they're noise)
  const kept = [];
  for (const [date, status] of seen) {
    if (status === 'unavailable') {
      result.dropped++;
    } else {
      kept.push({ date, status });
    }
  }

  // Sort chronologically
  kept.sort((a, b) => a.date.localeCompare(b.date));

  result.expanded = kept.length;

  // Write updated front-matter back
  parsed.data.availability = kept;

  const updated = serialise(parsed);

  if (DRY_RUN) {
    result.status = 'dry-run';
    return result;
  }

  try {
    fs.writeFileSync(filePath, updated, 'utf8');
    result.status = 'migrated';
  } catch (e) {
    result.status = 'write-error';
    result.errors.push(e.message);
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────

(function main() {
  if (DRY_RUN) console.log('[migrate] DRY RUN — no files will be written\n');

  let files;
  try {
    files = fs.readdirSync(LISTINGS_DIR).filter(f => f.endsWith('.md'));
  } catch (e) {
    console.error(`[migrate] Cannot read listings directory: ${e.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('[migrate] No .md files found in _listings/ — nothing to do.');
    return;
  }

  const results = files.map(f => processFile(path.join(LISTINGS_DIR, f)));

  // ── Summary table ────────────────────────────────────────────────────
  const col = (s, w) => String(s).padEnd(w);

  console.log(
    col('File', 36) + col('Result', 12) + col('Expanded', 10) + col('Dropped', 9) + 'Notes'
  );
  console.log('─'.repeat(90));

  let hasErrors = false;

  for (const r of results) {
    const notes = r.errors.length ? r.errors.join('; ') : '';
    console.log(
      col(r.file, 36) +
        col(r.status, 12) +
        col(r.status === 'migrated' || r.status === 'dry-run' ? r.expanded : '—', 10) +
        col(r.status === 'migrated' || r.status === 'dry-run' ? r.dropped : '—', 9) +
        notes
    );
    if (
      r.status === 'error' ||
      r.status === 'read-error' ||
      r.status === 'parse-error' ||
      r.status === 'write-error'
    ) {
      hasErrors = true;
    }
  }

  console.log('─'.repeat(90));

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n[migrate] Summary:');
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status}: ${count}`);
  }

  if (hasErrors) {
    console.error('\n[migrate] ✗ One or more files had errors — review above and re-run.');
    process.exit(1);
  } else {
    console.log('\n[migrate] ✓ Done.');
  }
})();
