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
    function drawFlashlight() {
      fillDark();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const inner = 60; // solid center radius
      const outer = inner + 120; // soft edge
      const g = ctx.createRadialGradient(pointer.x, pointer.y, inner, pointer.x, pointer.y, outer);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, outer, 0, Math.PI * 2);
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
        // initialize radius small but non-zero for smoothness
        radius = 80;
      }
    }

    function onPointerMove(e) {
      e.preventDefault();
      updatePointerFromEvent(e);
    }

    function onPointerStart(e) {
      updatePointerFromEvent(e);
    }

    // Animation loop
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000); // seconds, clamp for stability
      lastTs = ts;

      if (phase === 'flashlight') {
        drawFlashlight();
      } else if (phase === 'expanding') {
        // Sine-based wobble between min and max speeds
        const t = ts / 1000;
        const mid = (SPEED_MIN + SPEED_MAX) / 2;
        const amp = (SPEED_MAX - SPEED_MIN) / 2;
        const wobble = Math.sin(2 * Math.PI * WOBBLE_FREQ * t) * WOBBLE_AMP; // -amp..amp scaled later
        const speed = mid + amp * wobble; // px/sec
        radius += speed * dt;
        drawExpanding(radius);

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
    // Now that the overlay is drawn, show the content beneath
    document.body.classList.remove('no-entrance-ready');

    // Input listeners
    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchstart', onPointerStart, { passive: true });

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
