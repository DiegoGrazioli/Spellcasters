// home.js - schermata home con selezione modalità
import { createThemeToggle, initTheme } from './theme.js';

function showHomeScreen(onSelect) {

    // Gestione MODAL Impostazioni
  const settingsBtn = document.getElementById('btn-settings');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettings = document.getElementById('close-settings');
  const particleCount = document.getElementById('particle-count');
  const particleCountValue = document.getElementById('particle-count-value');

  if (settingsBtn && settingsModal && closeSettings) {
    settingsBtn.onclick = () => {
      settingsModal.classList.remove('hidden');
    };
    closeSettings.onclick = () => {
      settingsModal.classList.add('hidden');
    };
  }
  if (particleCount && particleCountValue) {
    // Carica valore da localStorage se presente
    const saved = localStorage.getItem('particleCount');
    if (saved) particleCount.value = saved;
    particleCountValue.textContent = particleCount.value;
    particleCount.oninput = (e) => {
      particleCountValue.textContent = e.target.value;
      localStorage.setItem('particleCount', e.target.value);
    };
  }

  // === Foschia/nuvole animate stile Babylon.js ===
  const fogCanvas = document.getElementById('home-fog-canvas');
  if (fogCanvas) {
    const ctx = fogCanvas.getContext('2d');
    let W = window.innerWidth;
    // Imposta l'altezza del canvas più alta (es: 320px)
    let H = fogCanvas.clientHeight || 320;
    fogCanvas.width = W;
    fogCanvas.height = H;
    // Ottimizzazione: riduci numero nuvole/particelle se canvas è grande
    const BASE_HEIGHT = 320;
    const SCALE = Math.max(1, H / BASE_HEIGHT);
    // Riduci il numero di nuvole e particelle in base alla scala
    const LAYERS = 3; // meno layer
    const FOG_PER_LAYER = [10 * SCALE | 0, 16 * SCALE | 0];
    const FIREFLY_COUNT = Math.max(12, 16 * SCALE | 0);
    const STAR_COUNT = Math.max(12, 18 * SCALE | 0);
    const COLORS = [
      'rgba(120,200,255,0.18)',
      'rgba(120,220,255,0.13)',
      'rgba(180,240,255,0.09)'
    ];
    let fogClouds = [];

    function resizeFogCanvas() {
      W = window.innerWidth;
      H = fogCanvas.clientHeight || 320;
      fogCanvas.width = W;
      fogCanvas.height = H;
    }
    window.addEventListener('resize', resizeFogCanvas);

    function createCloud(layer) {
      const baseY = H * (0.45 + 0.18 * layer + Math.random() * 0.18);
      const vy = (Math.random() - 0.5) * 0.82 + (layer - 1) * 0.9; // velocità verticale, più alta nei layer superiori
      return {
        x: Math.random() * W,
        y: baseY,
        rx: 80 + Math.random() * 120 + layer * 30,
        ry: 28 + Math.random() * 32 + layer * 8,
        alpha: 0.13 + Math.random() * 0.09,
        speed: 0.08 + Math.random() * 0.08 + layer * 0.04,
        vy: vy,
        color: COLORS[layer],
        phase: Math.random() * Math.PI * 2
      };
    }

    function initFog() {
      fogClouds = [];
      for (let l = 0; l < LAYERS; l++) {
        for (let i = 0; i < FOG_PER_LAYER[l]; i++) {
          fogClouds.push(createCloud(l));
        }
      }
    }
    initFog();

    function drawFog() {
      ctx.clearRect(0, 0, W, H);
      // === FASCI DI LUCE (simulazione volumetrica) ===
      for (let i = 0; i < 7; i++) {
        ctx.save();
        const angle = -0.18 + i * 0.06 + Math.sin(Date.now() * 0.0002 + i) * 0.03;
        ctx.translate(W/2, H * 0.7);
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(0, 0, 0, -H * 0.95);
        grad.addColorStop(0, 'rgba(120,220,255,0.13)');
        grad.addColorStop(0.2, 'rgba(120,220,255,0.08)');
        grad.addColorStop(0.7, 'rgba(120,220,255,0.01)');
        grad.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.globalAlpha = 0.22;
        ctx.filter = 'blur(12px)';
        ctx.beginPath();
        ctx.moveTo(-60 - i*18, 0);
        ctx.lineTo(60 + i*18, 0);
        ctx.lineTo(18 + i*8, -H * 0.95);
        ctx.lineTo(-18 - i*8, -H * 0.95);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }
      // === NUVOLE ===
      // NEL DISEGNO NUVOLE: aumenta la trasparenza delle nuvole più in alto
      for (let c of fogClouds) {
        ctx.save();
        // Calcola visibilità in base all'altezza: più in alto, molto meno visibile
        let yRatio = 1 - (c.y / H); // 0 in basso, 1 in alto
        // Riduci alpha in modo più marcato verso l'alto
        let alpha = c.alpha * (1 - 0.93 * yRatio * yRatio); // quadratic fade, quasi invisibile in alto
        ctx.globalAlpha = alpha;
        ctx.translate(c.x, c.y);
        ctx.rotate(Math.sin(Date.now() * 0.00012 + c.phase) * 0.04);
        // Applica blur solo alle nuvole grandi
        if (c.rx > 120) ctx.filter = 'blur(8px)';
        else if (c.rx > 80) ctx.filter = 'blur(4px)';
        else ctx.filter = 'none';
        let grad = ctx.createRadialGradient(0, 0, c.ry * 0.5, 0, 0, c.rx);
        grad.addColorStop(0, c.color);
        grad.addColorStop(0.7, c.color.replace(/\d?\.\d+\)$/,'0.13)'));
        grad.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.beginPath();
        ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }
    }

    function updateFog() {
      for (let c of fogClouds) {
        c.x += c.speed;
        c.y += c.vy + Math.sin(Date.now() * 0.0003 + c.phase) * 0.04;
        // Limita y tra 0.15*H e 0.95*H per evitare che escano troppo
        if (c.y < H * 0.15) c.y = H * 0.15 + Math.abs(c.vy);
        if (c.y > H * 0.95) c.y = H * 0.95 - Math.abs(c.vy);
        if (c.x - c.rx > W) {
          Object.assign(c, createCloud(COLORS.indexOf(c.color)), { x: -c.rx });
        }
      }
    }

    function animateFog() {
      updateFog();
      drawFog();
      requestAnimationFrame(animateFog);
    }
    animateFog();
  }


}

// Inizializza tema all'avvio
initTheme();
showHomeScreen(() => {});

export { showHomeScreen };
