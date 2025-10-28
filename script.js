// Entrance effect script v2: flashlight first, then smooth mouse-centered expansion
// Behaviour:
// 1) Start with a dark overlay on a canvas.
// 2) While not all quadrants visited: show a small soft flashlight that follows mouse/touch.
// 3) After all 4 quadrants visited: start an expanding radial reveal from the current pointer,
//    following the pointer while expanding; speed varies with a sine-modulated wobble.
// 4) When the reveal covers the viewport, fade the overlay opacity to 0 and then hide the canvas.
(() => {
  // Get the canvas element used for the dark overlay
  const canvas = document.getElementById('revealCanvas');
  if (!canvas) return; // Exit if canvas is missing

  // Main setup function: initializes canvas and event listeners
  function setup() {
    // Hide content until the dark layer is painted to avoid flash
    document.body.classList.add('no-entrance-ready');
    // Set canvas size to fill the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
  // Reference to the horizontal scroller element; we will map wheel to horizontal movement
  const scroller = document.getElementById('hscroll');
  // Smooth horizontal scrolling state
  let hTarget = scroller ? scroller.scrollLeft : 0; // desired scrollLeft
  let hVel = 0;                                     // current horizontal velocity
  let hAnimId = null;                               // RAF id for smoothing loop

    // Track which quadrants have been revealed (top-left, top-right, bottom-left, bottom-right)
    let revealedQuadrants = [false, false, false, false];

    // Pointer state (mouse/touch)
    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, hasMoved: false };

    // Animation state
    let phase = 'flashlight'; // 'flashlight' | 'expanding' | 'done'
    let radius = 0;           // current reveal radius for expanding phase
    let lastTs = 0;           // last timestamp from RAF

    // Config via CSS variables (read once at setup; adjust in CSS :root)
    const cssVar = (name, fallback) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    };
  const SPEED_MIN = parseFloat(cssVar('--reveal-speed-min', '420')) || 420; // px/sec
  const SPEED_MAX = parseFloat(cssVar('--reveal-speed-max', '1100')) || 1100; // px/sec
  const WOBBLE_FREQ = parseFloat(cssVar('--reveal-wobble-freq', '0.9')) || 0.9; // Hz
  const WOBBLE_AMP = Math.min(1, Math.max(0, parseFloat(cssVar('--reveal-wobble-amp', '0.7')) || 0.7));
  const SOFT = parseFloat(cssVar('--reveal-softness', '140')) || 140; // px
  const SHRINK_AMP = Math.min(1, Math.max(0, parseFloat(cssVar('--reveal-shrink-amp', '0.13')) || 0.13));
  // Horizontal scroll tuning from CSS variables
  const HSENS = Math.max(0, parseFloat(cssVar('--hscroll-sensitivity', '0.45')) || 0.45);
  const HSPRING = Math.min(1, Math.max(0, parseFloat(cssVar('--hscroll-spring', '0.14')) || 0.14));
  const HDAMP = Math.min(0.999, Math.max(0, parseFloat(cssVar('--hscroll-damping', '0.88')) || 0.88));

  // Helper: start or continue smooth horizontal scrolling toward hTarget
  function startHScroll() {
    if (!scroller) return;
    if (hAnimId) return; // already animating
    let last = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000) || 0.016;
      last = ts;
      // Spring towards target
      const x = scroller.scrollLeft;
      const dx = hTarget - x;
      hVel += dx * HSPRING;      // accelerate towards target
      hVel *= HDAMP;             // apply damping
      // Integrate position
      let next = x + hVel * (dt * 60); // scale by 60fps to keep tuning intuitive
      // Clamp to bounds
      const maxLeft = scroller.scrollWidth - scroller.clientWidth;
      if (next < 0) { next = 0; hVel = 0; }
      if (next > maxLeft) { next = maxLeft; hVel = 0; }
      scroller.scrollLeft = next;

      // Stop when close enough and velocity tiny
      if (Math.abs(dx) < 0.5 && Math.abs(hVel) < 0.2) {
        scroller.scrollLeft = hTarget;
        hAnimId = null;
        return;
      }
      hAnimId = requestAnimationFrame(step);
    };
    hAnimId = requestAnimationFrame(step);
  }

    // Fill the entire canvas with solid black
    function fillDark() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Determine which quadrant the mouse is in
    function getQuadrant(x, y) {
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      if (x < midX && y < midY) return 0; // Top-left
      if (x >= midX && y < midY) return 1; // Top-right
      if (x < midX && y >= midY) return 2; // Bottom-left
      return 3; // Bottom-right
    }

    // Draw flashlight (small reveal) around the pointer
    const FLASHLIGHT_INNER = 20; // solid center radius
    const FLASHLIGHT_OUTER = FLASHLIGHT_INNER + 80; // soft edge
    function drawFlashlight() {
      fillDark();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(pointer.x, pointer.y, FLASHLIGHT_INNER, pointer.x, pointer.y, FLASHLIGHT_OUTER);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, FLASHLIGHT_OUTER, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw expanding reveal around the pointer with soft edge
    function drawExpanding(r) {
      fillDark();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const inner = Math.max(0, r - SOFT);
      const outer = r;
      const g = ctx.createRadialGradient(pointer.x, pointer.y, inner, pointer.x, pointer.y, outer);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.2)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, outer, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Compute needed radius to cover viewport fully from pointer
    function maxCoverRadius(px, py) {
      const corners = [
        { x: 0, y: 0 },
        { x: canvas.width, y: 0 },
        { x: 0, y: canvas.height },
        { x: canvas.width, y: canvas.height },
      ];
      let max = 0;
      for (const c of corners) {
        const dx = c.x - px, dy = c.y - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > max) max = d;
      }
      return max + 4; // pad a bit to eliminate seams
    }

    // Helper to set pointer from touch or mouse
    function updatePointerFromEvent(e) {
      let x, y;
      if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX; y = e.touches[0].clientY;
      } else {
        x = e.clientX; y = e.clientY;
      }
      pointer.x = x; pointer.y = y; pointer.hasMoved = true;
      // Track quadrants during flashlight phase only
      const q = getQuadrant(x, y);
      revealedQuadrants[q] = true;
      // If all quadrants visited, switch to expanding phase
      if (phase === 'flashlight' && revealedQuadrants.every(Boolean)) {
        phase = 'expanding';
        // initialize radius to flashlight outer radius for smoothness
        radius = FLASHLIGHT_OUTER;
        // Fade out the spade symbol
        const identity = document.getElementById('identity');
        if (identity) identity.classList.add('fade-out');
      }
    }

    function onPointerMove(e) {
      e.preventDefault();
      // On first interaction, reveal the content beneath the overlay
      if (typeof showContentIfNeeded === 'function') showContentIfNeeded();
      updatePointerFromEvent(e);
    }

    function onPointerStart(e) {
      // On first interaction, reveal the content beneath the overlay
      if (typeof showContentIfNeeded === 'function') showContentIfNeeded();
      updatePointerFromEvent(e);
    }

    // Animation loop
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000); // seconds, clamp for stability
      lastTs = ts;

      if (phase === 'flashlight') {
        // On initial load (no interaction yet), keep the screen fully dark.
        // Only draw the flashlight after the user has moved/touched once.
        if (pointer.hasMoved) {
          drawFlashlight();
        } else {
          fillDark();
        }
      } else if (phase === 'expanding') {
        // Sine-based wobble between min and max speeds
        const t = ts / 1000;
        const mid = (SPEED_MIN + SPEED_MAX) / 2;
        const amp = (SPEED_MAX - SPEED_MIN) / 2;
        const wobble = Math.sin(2 * Math.PI * WOBBLE_FREQ * t) * WOBBLE_AMP; // -amp..amp scaled later
        const speed = mid + amp * wobble; // px/sec
        radius += speed * dt;

  // Shrinking effect: modulate radius with a secondary sine wave
  const shrink = 1 - (Math.sin(2 * Math.PI * (WOBBLE_FREQ * 0.7) * t + Math.PI / 2) * SHRINK_AMP);
  // Clamp so radius never shrinks below starting value
  const modulatedRadius = Math.max(radius * shrink, FLASHLIGHT_OUTER);
  drawExpanding(modulatedRadius);

        const needed = maxCoverRadius(pointer.x, pointer.y);
        if (radius >= needed) {
          // Finish: fade out canvas via CSS transition, then hide
          phase = 'done';
          canvas.style.opacity = '0';
          // After transition ends, stop raf and hide canvas
          const handle = () => {
            canvas.removeEventListener('transitionend', handle);
            canvas.style.display = 'none';
          };
          canvas.addEventListener('transitionend', handle);
        }
      }

      if (phase !== 'done') requestAnimationFrame(tick);
    }

    fillDark(); // Start with a fully dark screen
    // Keep content hidden until first user interaction to avoid any peek-through
    let contentShown = false;
    function showContentIfNeeded() {
      if (!contentShown) {
        document.body.classList.remove('no-entrance-ready');
        contentShown = true;
      }
    }

    // Input listeners
    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchstart', onPointerStart, { passive: true });

    // Map vertical wheel to horizontal corridor scroll so down => move right, up => move left
    // This keeps the experience like walking a corridor left/right while using the mouse wheel
    if (scroller) {
      scroller.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent default vertical scrolling
        // Normalize wheel delta across deltaMode types
        const mode = e.deltaMode; // 0=pixel, 1=line, 2=page
        let base = e.deltaY;
        if (mode === 1) base *= 16;          // approx line height
        else if (mode === 2) base *= window.innerHeight;
        // Update target using sensitivity
        hTarget += base * HSENS;
        // Clamp target to bounds
        const maxLeft = scroller.scrollWidth - scroller.clientWidth;
        if (hTarget < 0) hTarget = 0;
        if (hTarget > maxLeft) hTarget = maxLeft;
        // Start/continue smoothing animation
        startHScroll();
      }, { passive: false });
    }

    // Keyboard navigation: map vertical-style keys to horizontal corridor scroll
    // - ArrowRight/ArrowLeft: nudge by ~20% viewport width
    // - PageDown/PageUp/Space: jump by ~90% viewport width
    // - Home/End: go to far left/right
    function onKeydown(e) {
      if (!scroller) return; // No horizontal scroller present
      // Don't hijack typing or editable elements
      const t = e.target;
      const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      const isEditable = (t && (t.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
      if (isEditable) return;

      const vw = window.innerWidth;
      const smallStep = Math.round(vw * 0.2);  // 20% viewport width
      const bigStep = Math.round(vw * 0.9);    // 90% viewport width
      let handled = true;

      // Ensure content is visible on first keyboard interaction
      if (typeof showContentIfNeeded === 'function') showContentIfNeeded();

      switch (e.key) {
        case 'ArrowRight':
          scroller.scrollTo({ left: scroller.scrollLeft + smallStep, behavior: 'smooth' });
          break;
        case 'ArrowLeft':
          scroller.scrollTo({ left: scroller.scrollLeft - smallStep, behavior: 'smooth' });
          break;
        case 'PageDown':
        case ' ': // Space acts like PageDown
          scroller.scrollTo({ left: scroller.scrollLeft + bigStep, behavior: 'smooth' });
          break;
        case 'PageUp':
          scroller.scrollTo({ left: scroller.scrollLeft - bigStep, behavior: 'smooth' });
          break;
        case 'Home':
          scroller.scrollTo({ left: 0, behavior: 'smooth' });
          break;
        case 'End':
          scroller.scrollTo({ left: scroller.scrollWidth - scroller.clientWidth, behavior: 'smooth' });
          break;
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault(); // Prevent default vertical scroll/space actions
      }
    }
    document.addEventListener('keydown', onKeydown);

    // Kick off RAF loop
    requestAnimationFrame(tick);

    // Re-size the canvas and re-fill dark when the window size changes
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      fillDark();
    });
  }

  // Wait for the DOM to be ready before running setup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
