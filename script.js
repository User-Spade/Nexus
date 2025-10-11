

// Entrance effect script: reveals the page as the mouse moves, then fully reveals after all quadrants are visited
(() => {
  // Get the canvas element used for the dark overlay
  const canvas = document.getElementById('revealCanvas');
  if (!canvas) return; // Exit if canvas is missing

  // Main setup function: initializes canvas and event listeners
  function setup() {
    // Set canvas size to fill the window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    // Track which quadrants have been revealed (top-left, top-right, bottom-left, bottom-right)
    let revealedQuadrants = [false, false, false, false];

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

    // Reveal a circular area around the mouse using a radial gradient
    function reveal(e) {
      fillDark(); // Reset to dark before revealing
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out'; // Make revealed area transparent
      // Create a soft radial gradient for the reveal effect
      const gradient = ctx.createRadialGradient(e.clientX, e.clientY, 60, e.clientX, e.clientY, 120);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(e.clientX, e.clientY, 120, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Mark the current quadrant as revealed
      const q = getQuadrant(e.clientX, e.clientY);
      revealedQuadrants[q] = true;
      // If all quadrants have been visited, remove the overlay and stop listening for mouse movement
      if (revealedQuadrants.every(Boolean)) {
        canvas.style.display = 'none'; // Fully reveal the page
        document.removeEventListener('mousemove', reveal);
      }
    }

    fillDark(); // Start with a fully dark screen
    document.addEventListener('mousemove', reveal); // Reveal as mouse moves

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
