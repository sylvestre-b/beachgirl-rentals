/**
 * BeachGirl Calendar — availability date-range picker
 *
 * SAFETY DEFAULT: dates that are NOT explicitly marked are treated as
 * UNAVAILABLE. This prevents a forgotten admin update from silently
 * advertising a booked week as available. Listings must declare every
 * available window explicitly via the availability array.
 *
 * Features:
 * - Two-month grid (current + next), stacks to one on mobile
 * - Click to set check-in, click again for check-out
 * - Range highlight, hover preview
 * - Calls onSelect(checkInISO, checkOutISO) when a valid range is chosen
 */
window.BeachGirlCalendar = (function () {
  // ── Helpers ────────────────────────────────────────────────────────
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
  function inRange(d, start, end) {
    return d > start && d < end;
  }

  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function create(opts) {
    const { container, availability = [], onSelect, minNights = 1 } = opts;

    // Fast lookup: 'YYYY-MM-DD' → 'available' | 'unavailable'
    const avMap = {};
    availability.forEach(a => {
      avMap[a.date] = a.status;
    });

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let checkIn = null;
    let checkOut = null;
    let hoverDate = null;

    /**
     * SAFETY: default is UNAVAILABLE. A date is available only when:
     *  - it is in the future (or today), AND
     *  - it is explicitly marked 'available' in the availability array.
     */
    function isAvailable(d) {
      const key = isoDate(d);
      const today = isoDate(new Date());
      if (key < today) return false;
      return avMap[key] === 'available';
    }

    function rangeAllAvailable(start, end) {
      let d = addDays(start, 1);
      while (d < end) {
        if (!isAvailable(d)) return false;
        d = addDays(d, 1);
      }
      return true;
    }

    function render() {
      container.innerHTML = '';

      const nav = document.createElement('div');
      nav.className = 'cal-nav';
      nav.innerHTML = `
        <button class="cal-nav-btn" data-cal-nav="prev" aria-label="Previous month">‹</button>
        <span class="cal-nav-label"></span>
        <button class="cal-nav-btn" data-cal-nav="next" aria-label="Next month">›</button>
      `;
      container.appendChild(nav);

      const label = nav.querySelector('.cal-nav-label');

      const months = document.createElement('div');
      months.className = 'cal-months';

      const monthCount = window.innerWidth < 640 ? 1 : 2;
      label.textContent =
        monthCount === 1
          ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
          : `${MONTH_NAMES[viewMonth]} ${viewYear} – ${MONTH_NAMES[(viewMonth + 1) % 12]} ${viewMonth === 11 ? viewYear + 1 : viewYear}`;

      for (let mi = 0; mi < monthCount; mi++) {
        let m = viewMonth + mi;
        let y = viewYear;
        if (m > 11) {
          m -= 12;
          y++;
        }
        months.appendChild(renderMonth(y, m));
      }
      container.appendChild(months);

      const legend = document.createElement('div');
      legend.className = 'cal-legend';
      legend.innerHTML = `
        <span class="cal-legend-item"><span class="cal-dot avail"></span> Available</span>
        <span class="cal-legend-item"><span class="cal-dot unavail"></span> Unavailable</span>
        <span class="cal-legend-item"><span class="cal-dot selected"></span> Selected</span>
      `;
      container.appendChild(legend);

      const summary = document.createElement('div');
      summary.className = 'cal-summary';
      summary.id = 'cal-summary';
      updateSummary(summary);
      container.appendChild(summary);

      // Wire navigation (no inline handlers)
      container.querySelector('[data-cal-nav="prev"]').addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear--;
        }
        render();
      });
      container.querySelector('[data-cal-nav="next"]').addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear++;
        }
        render();
      });
    }

    function renderMonth(year, month) {
      const wrap = document.createElement('div');
      wrap.className = 'cal-month';

      const h = document.createElement('div');
      h.className = 'cal-month-title';
      h.textContent = `${MONTH_NAMES[month]} ${year}`;
      wrap.appendChild(h);

      const dh = document.createElement('div');
      dh.className = 'cal-dow-row';
      DAY_NAMES.forEach(d => {
        const s = document.createElement('span');
        s.className = 'cal-dow';
        s.textContent = d;
        dh.appendChild(s);
      });
      wrap.appendChild(dh);

      const grid = document.createElement('div');
      grid.className = 'cal-grid';

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 0; i < firstDay; i++) {
        const e = document.createElement('div');
        e.className = 'cal-day empty';
        grid.appendChild(e);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const key = isoDate(date);
        const avail = isAvailable(date);
        const past = date < today;

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.setAttribute('data-date', key);

        if (past) {
          cell.classList.add('past');
          cell.setAttribute('aria-label', `${MONTH_NAMES[month]} ${d} — past`);
        } else if (!avail) {
          cell.classList.add('unavail');
          cell.setAttribute('aria-label', `${MONTH_NAMES[month]} ${d} — unavailable`);
        } else {
          cell.classList.add('avail');
          cell.setAttribute('role', 'button');
          cell.setAttribute('tabindex', '0');
          cell.setAttribute('aria-label', `${MONTH_NAMES[month]} ${d} — available, select`);

          cell.addEventListener('click', () => handleDayClick(date));
          cell.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDayClick(date);
            }
          });
          cell.addEventListener('mouseenter', () => {
            hoverDate = date;
            updateRangeHighlight();
          });
        }

        if (checkIn && sameDay(date, checkIn)) cell.classList.add('check-in');
        if (checkOut && sameDay(date, checkOut)) cell.classList.add('check-out');
        if (checkIn && checkOut && inRange(date, checkIn, checkOut)) cell.classList.add('in-range');
        if (checkIn && !checkOut && hoverDate && date > checkIn && date <= hoverDate) {
          cell.classList.add('in-range-hover');
        }
        if (sameDay(date, today)) cell.classList.add('today');

        const num = document.createElement('span');
        num.textContent = d;
        cell.appendChild(num);

        grid.appendChild(cell);
      }

      wrap.appendChild(grid);
      return wrap;
    }

    function handleDayClick(date) {
      if (!isAvailable(date)) return;

      if (!checkIn || (checkIn && checkOut)) {
        checkIn = date;
        checkOut = null;
        hoverDate = null;
      } else {
        if (date <= checkIn) {
          checkIn = date;
          checkOut = null;
        } else {
          const nights = Math.round((date - checkIn) / 86400000);
          if (nights < minNights) {
            checkIn = date;
            checkOut = null;
          } else if (!rangeAllAvailable(checkIn, date)) {
            checkIn = date;
            checkOut = null;
          } else {
            checkOut = date;
            if (onSelect) onSelect(isoDate(checkIn), isoDate(checkOut));
          }
        }
      }
      render();
    }

    function updateRangeHighlight() {
      container.querySelectorAll('.cal-day').forEach(cell => {
        const key = cell.getAttribute('data-date');
        if (!key) return;
        const d = parseDate(key);
        cell.classList.remove('in-range-hover');
        if (checkIn && !checkOut && hoverDate && d > checkIn && d <= hoverDate) {
          cell.classList.add('in-range-hover');
        }
      });
    }

    function updateSummary(el) {
      if (!checkIn) {
        el.textContent = 'Select your check-in date';
        el.className = 'cal-summary hint';
        return;
      }
      if (!checkOut) {
        el.textContent = `Check-in: ${checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — now select your check-out date`;
        el.className = 'cal-summary selecting';
        return;
      }
      const nights = Math.round((checkOut - checkIn) / 86400000);
      el.innerHTML = `<strong>Check-in:</strong> ${checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &nbsp;→&nbsp; <strong>Check-out:</strong> ${checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &nbsp;·&nbsp; ${nights} night${nights > 1 ? 's' : ''}`;
      el.className = 'cal-summary confirmed';
    }

    return {
      render,
      getCheckIn: () => (checkIn ? isoDate(checkIn) : null),
      getCheckOut: () => (checkOut ? isoDate(checkOut) : null),
      clear() {
        checkIn = null;
        checkOut = null;
        hoverDate = null;
        render();
        if (onSelect) onSelect(null, null);
      },
    };
  }

  return { create };
})();
