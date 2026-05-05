// ─────────────────────────────────────────────────────────────────────────
// birthday-banner.js — TEMPORARY · Jill's birthday surprise
// ─────────────────────────────────────────────────────────────────────────
// HOW TO REMOVE EVERYTHING:
//   1. Delete this file: js/birthday-banner.js
//   2. Delete: styles/birthday-banner.css
//   3. In index.html, remove the two lines tagged with: <!-- BIRTHDAY -->
// ─────────────────────────────────────────────────────────────────────────
//
// Behaviour:
//   • Banner appears on first visit (per browser).
//   • Confetti bursts once when the banner opens, then a soft trickle for ~6s.
//   • Dismissible via the × button (sets a localStorage flag).
//   • To "force-show" again for testing, run in console:
//       localStorage.removeItem('bday-jill-2026'); location.reload();
//   • Respects prefers-reduced-motion: banner shows, confetti suppressed.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const STORAGE_KEY = 'bday-jill-2026';
  const BANNER_TEXT_HTML =
    '<span class="bday-emoji" aria-hidden="true">🎉</span>' +
    '<span class="bday-text">Happy Birthday, <em>Jill!</em></span>' +
    '<span class="bday-emoji" aria-hidden="true">🎂</span>' +
    '<span class="bday-emoji" aria-hidden="true">🎈</span>';

  // Bail if already dismissed
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'dismissed') return;
  } catch (e) {
    /* localStorage blocked — show anyway, will show every visit until allowed */
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── BUILD BANNER ────────────────────────────────────────────────────
  const banner = document.createElement('div');
  banner.className = 'birthday-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML =
    BANNER_TEXT_HTML +
    '<button type="button" class="bday-close" aria-label="Dismiss birthday message">✕</button>';

  // Insert at the very top of <body>
  document.body.insertBefore(banner, document.body.firstChild);
  document.body.classList.add('has-birthday-banner');

  // Measure & expose its height as a CSS var so the sticky header sits below it
  requestAnimationFrame(() => {
    const h = banner.offsetHeight;
    document.documentElement.style.setProperty('--bday-banner-h', h + 'px');
    banner.classList.add('is-open');
  });

  // Recompute on resize (text may wrap on narrow viewports)
  window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--bday-banner-h', banner.offsetHeight + 'px');
  });

  // Dismiss handler
  banner.querySelector('.bday-close').addEventListener('click', dismiss);

  function dismiss() {
    banner.classList.remove('is-open');
    document.body.classList.remove('has-birthday-banner');
    try {
      localStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch (e) {
      /* ignore */
    }
    setTimeout(() => banner.remove(), 800);
    if (canvas) {
      // fade out remaining confetti
      canvas.style.transition = 'opacity 0.6s ease';
      canvas.style.opacity = '0';
      setTimeout(() => canvas.remove(), 700);
    }
  }

  // ── CONFETTI ────────────────────────────────────────────────────────
  let canvas = null;
  if (!reducedMotion) {
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    runConfetti(canvas);
  }

  function runConfetti(cnv) {
    const ctx = cnv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const colors = ['#c25e54', '#d8867d', '#ebc7c3', '#e9d8b4', '#5a9aa0', '#f4ece0', '#fff7e8'];
    let particles = [];
    let running = true;
    let rafId = null;

    function resize() {
      cnv.width = window.innerWidth * dpr;
      cnv.height = window.innerHeight * dpr;
      cnv.style.width = window.innerWidth + 'px';
      cnv.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function makeParticle(burst) {
      const x = burst ? Math.random() * window.innerWidth : Math.random() * window.innerWidth;
      const y = burst ? -10 - Math.random() * 40 : -10;
      return {
        x,
        y,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        vx: (Math.random() - 0.5) * (burst ? 4 : 1.2),
        vy: 1 + Math.random() * (burst ? 4 : 2),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.25,
        color: colors[(Math.random() * colors.length) | 0],
        life: 0,
        maxLife: 260 + Math.random() * 160,
      };
    }

    // Initial burst
    for (let i = 0; i < 90; i++) particles.push(makeParticle(true));

    // Soft trickle for 6 seconds
    const trickleEnd = performance.now() + 6000;
    const trickle = setInterval(() => {
      if (performance.now() > trickleEnd || !running) {
        clearInterval(trickle);
        return;
      }
      for (let i = 0; i < 3; i++) particles.push(makeParticle(false));
    }, 90);

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter(p => p.life < p.maxLife && p.y < window.innerHeight + 30);
      for (const p of particles) {
        p.life++;
        p.vy += 0.05; // gravity
        p.vx *= 0.995; // air drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (particles.length === 0 && performance.now() > trickleEnd) {
        running = false;
        // Auto-remove canvas once all confetti settled (banner stays)
        cnv.style.transition = 'opacity 0.8s ease';
        cnv.style.opacity = '0';
        setTimeout(() => cnv.remove(), 900);
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    // Stop animation if banner is dismissed
    banner.addEventListener('bday:dismiss', () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    });
  }
})();
