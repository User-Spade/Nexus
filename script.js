// Mouse reveal effect with quadrant tracking
(() => {
  const canvas = document.getElementById('revealCanvas');
  if (!canvas) return;

  function setup() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    let revealedQuadrants = [false, false, false, false];

    function fillDark() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function getQuadrant(x, y) {
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      if (x < midX && y < midY) return 0; // Top-left
      if (x >= midX && y < midY) return 1; // Top-right
      if (x < midX && y >= midY) return 2; // Bottom-left
      return 3; // Bottom-right
    }

    function reveal(e) {
      fillDark();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const gradient = ctx.createRadialGradient(e.clientX, e.clientY, 60, e.clientX, e.clientY, 120);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(e.clientX, e.clientY, 120, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Track quadrant
      const q = getQuadrant(e.clientX, e.clientY);
      revealedQuadrants[q] = true;
      if (revealedQuadrants.every(Boolean)) {
        // Reveal whole page
        canvas.style.display = 'none';
        document.removeEventListener('mousemove', reveal);
      }
    }

    fillDark();
    document.addEventListener('mousemove', reveal);

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      fillDark();
    });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
