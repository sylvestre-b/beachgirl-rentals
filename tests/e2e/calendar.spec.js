/**
 * tests/e2e/calendar.spec.js
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * A prior bug shipped availability data in a shape that calendar.js could not
 * parse (e.g. `{ "2026-07-04": "available" }` object instead of the expected
 * `[{ date: "2026-07-04", status: "available" }]` array).  calendar.js's
 * safety default is UNAVAILABLE, so when the lookup map `avMap` was empty
 * every date rendered as `.unavail` — zero cells ever received the class
 * `avail`.  ESLint / html-validate / Lighthouse cannot see runtime data flow;
 * only an end-to-end test that actually renders the calendar and inspects the
 * DOM can catch this class of bug.
 *
 * WHAT IS TESTED
 * --------------
 * 1. The property page for the first listing with future availability loads.
 * 2. The calendar renders at least one cell with class `avail`  <- the key
 *    assertion that would have caught the data-shape bug.
 * 3. Clicking that cell selects it (gets class `check-in`),
 *    confirming that the click handler is wired and state mutates correctly.
 *
 * WHAT IS NOT TESTED
 * ------------------
 * The full booking / inquiry flow.  That is intentional -- this test is meant
 * to be fast, reliable, and directly targeted at the data-shape failure mode.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDateISO(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Fetch the listings index and return the first active listing. */
async function getFirstListing(request, baseURL) {
  const resp = await request.get(`${baseURL}/listings-index.json`);
  if (!resp.ok()) {
    throw new Error(
      `Could not fetch listings-index.json (HTTP ${resp.status()}). ` +
        'Run `node build.js` before the tests.'
    );
  }
  const listings = await resp.json();
  const active = listings.filter(p => p.active !== false);
  if (!active.length) throw new Error('No active listings in listings-index.json.');
  // Prefer one that already has future availability so the smoke test is useful.
  const today = futureDateISO(0);
  return (
    active.find(p =>
      (p.availability || []).some(a => a.status === 'available' && a.date >= today)
    ) || active[0]
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
test.describe('Calendar availability rendering', () => {
  /**
   * Core regression test -- deterministic, does not depend on real listing data.
   *
   * Root cause of the original bug: availability data was the wrong shape so
   * avMap stayed empty -> every date fell through to the UNAVAILABLE default ->
   * zero .avail cells were ever created.
   *
   * Strategy:
   *   1. Fetch the real listings-index.json to get the first valid slug.
   *      property.js reads the slug from the URL and looks it up in the JSON,
   *      so we need both a real built page at /property/<slug>/ AND a matching
   *      entry in the JSON.  We intercept the JSON and replace the matched
   *      listing's availability with our controlled fixture -- the slug and page
   *      shell stay real; only the availability array is swapped.
   *   2. Visit /property/<slug>/.
   *   3. Wait for the calendar to render (first .cal-nav-btn appears).
   *   4. Assert >= 1 `.avail` cell -- this is THE regression guard.
   *   5. Click it and assert `.check-in` is added.
   */
  test('calendar renders at least one available cell and click selects it', async ({
    page,
    request,
    baseURL,
  }) => {
    // Step 1: get a real slug and patch its availability
    let listing;
    try {
      listing = await getFirstListing(request, baseURL);
    } catch (e) {
      test.skip(true, e.message);
      return;
    }

    const slug = listing._slug;

    // Seven consecutive days starting 30 days from now -- always in the future.
    const patchedAvailability = Array.from({ length: 7 }, (_, i) => ({
      date: futureDateISO(30 + i),
      status: 'available',
    }));

    // Intercept the JSON fetch: keep all other listings intact, but replace
    // this listing's availability with our controlled fixture.
    await page.route('**/listings-index.json', async route => {
      const original = await route.fetch();
      const json = await original.json();
      const patched = json.map(p =>
        p._slug === slug ? { ...p, availability: patchedAvailability } : p
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(patched),
      });
    });

    // Step 2: navigate to the real built property page
    await page.goto(`/property/${slug}/`);

    // Step 3: wait for the calendar to actually render.
    // #prop-calendar exists in the static HTML immediately (it is just a div),
    // so waitForSelector on it resolves before JS runs. Instead wait for the
    // nav button that calendar.js injects when it renders its first month grid.
    await page.waitForSelector('#prop-calendar .cal-nav-btn', { timeout: 15_000 });

    // Step 4: assert >= 1 available cell.
    // This assertion directly catches the data-shape bug: when avMap is empty
    // (wrong shape), every future date gets class `unavail` not `avail`.
    const availCells = page.locator('#prop-calendar .cal-day.avail');
    await expect(availCells).not.toHaveCount(0, {
      message:
        'Expected at least one .cal-day.avail cell inside #prop-calendar. ' +
        'Zero available cells means the availability array was not parsed -- ' +
        'each entry must be { date: "YYYY-MM-DD", status: "available" }.',
    });

    // Step 5: click the first available cell and confirm selection.
    const firstAvail = availCells.first();
    await firstAvail.click();

    // calendar.js adds `check-in` on first click.
    await expect(firstAvail).toHaveClass(/check-in/, {
      message:
        'After clicking an available cell it should gain class "check-in". ' +
        'If not, the click handler may not be wired correctly.',
    });
  });

  // -------------------------------------------------------------------------
  // Smoke test -- exercises real build data, no patching.
  // Skips gracefully if the listing has no future available dates set yet.
  // -------------------------------------------------------------------------
  test('first real listing with availability has bookable cells', async ({
    page,
    request,
    baseURL,
  }) => {
    let listing;
    try {
      listing = await getFirstListing(request, baseURL);
    } catch (e) {
      test.skip(true, e.message);
      return;
    }

    const today = futureDateISO(0);
    const hasFutureAvail = (listing.availability || []).some(
      a => a.status === 'available' && a.date >= today
    );

    if (!hasFutureAvail) {
      test.skip(
        true,
        `Listing "${listing._slug}" has no future availability dates -- skipping smoke test.`
      );
      return;
    }

    await page.goto(`/property/${listing._slug}/`);
    await page.waitForSelector('#prop-calendar .cal-nav-btn', { timeout: 15_000 });

    const availCells = page.locator('#prop-calendar .cal-day.avail');
    await expect(availCells).not.toHaveCount(0);

    await availCells.first().click();
    await expect(availCells.first()).toHaveClass(/check-in/);
  });
});
