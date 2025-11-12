// home.js - schermata home con selezione modalità - VERSIONE OTTIMIZZATA
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

    // === Gestione volume audio ===
    const audioVolumeSlider = document.getElementById('audio-volume');
    const audioVolumeValue = document.getElementById('audio-volume-value');

    if (audioVolumeSlider) {
    // Leggi valore salvato (default 50)
    const savedVolume = localStorage.getItem('audioVolume');
    const initial = savedVolume ? parseInt(savedVolume) : 50;
    audioVolumeSlider.value = initial;
    if (audioVolumeValue) audioVolumeValue.textContent = `${initial}%`;

    // Gestione evento
    audioVolumeSlider.oninput = (e) => {
        const val = parseInt(e.target.value);
        if (audioVolumeValue) audioVolumeValue.textContent = `${val}%`;
        localStorage.setItem('audioVolume', val);
    };
    }

    // === Foschia/nuvole animate stile Babylon.js - VERSIONE OTTIMIZZATA ===
    const fogCanvas = document.getElementById('home-fog-canvas');
    if (fogCanvas) {
        const ctx = fogCanvas.getContext('2d');
        let W = window.innerWidth;
        let H = fogCanvas.clientHeight || 320; // Altezza fissa per coerenza visiva
        fogCanvas.width = W;
        fogCanvas.height = H;

        // Ottimizzazione: Parametri ridotti
        const LAYERS = 2; // Ridotto da 3
        const FOG_PER_LAYER = [5, 8]; // Ridotto da [10 * SCALE, 16 * SCALE]
        const LIGHT_BEAM_COUNT = 3; // Ridotto da 7
        const COLORS = [
            'rgba(120,200,255,0.12)', // Più trasparente
            'rgba(120,220,255,0.08)',
            'rgba(180,240,255,0.05)'
        ];

        let fogClouds = [];

        function resizeFogCanvas() {
            W = window.innerWidth;
            H = fogCanvas.clientHeight || 320;
            fogCanvas.width = W;
            fogCanvas.height = H;
            initFog(); // Reinizializza nuvole con la nuova dimensione
        }
        window.addEventListener('resize', resizeFogCanvas);

        function createCloud(layer) {
            const baseY = H * (0.5 + 0.15 * layer + Math.random() * 0.15); // Leggermente più in alto
            const vy = (Math.random() - 0.1) * 0.2 + (layer - 1) * 0.1; // Velocità verticale ridotta
            return {
                x: Math.random() * W,
                y: baseY,
                rx: 60 + Math.random() * 80 + layer * 20, // Dimensioni ridotte
                ry: 20 + Math.random() * 24 + layer * 6, // Dimensioni ridotte
                alpha: 0.08 + Math.random() * 0.06, // Più trasparente
                speed: 0.08 + Math.random() * 0.06 + layer * 0.2, // Velocità ridotta
                vy: vy,
                color: COLORS[layer % COLORS.length], // Usa modulo per evitare errori
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

        // Pre-calcola i gradienti una volta sola per migliorare le prestazioni
        let cachedLightGradients = [];
        function createLightGradients() {
            cachedLightGradients = [];
            for (let i = 0; i < LIGHT_BEAM_COUNT; i++) {
                const grad = ctx.createLinearGradient(0, 0, 0, -H * 0.95);
                grad.addColorStop(0, 'rgba(120,220,255,0.10)');
                grad.addColorStop(0.2, 'rgba(120,220,255,0.05)');
                grad.addColorStop(0.7, 'rgba(120,220,255,0.005)');
                grad.addColorStop(1, 'rgba(120,220,255,0)');
                cachedLightGradients.push(grad);
            }
        }
        createLightGradients(); // Crea all'inizio

        // Ridisegna gradienti se cambia la dimensione
        let lastGradientHeight = H;
        function updateGradientsIfNecessary() {
            if (H !== lastGradientHeight) {
                createLightGradients();
                lastGradientHeight = H;
            }
        }

        function drawFog() {
            // Riduci leggermente il clear per un effetto di scia
            // ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            // ctx.fillRect(0, 0, W, H);
            ctx.clearRect(0, 0, W, H); // Pulizia completa per ora

            updateGradientsIfNecessary();

            // === FASCI DI LUCE (simulazione volumetrica) - OTTIMIZZATO ===
            const now = Date.now() * 0.0002; // Usa un solo valore 'now' per l'animazione
            for (let i = 0; i < LIGHT_BEAM_COUNT; i++) { // Di default LIGHT_BEAM_COUNT = 3
              ctx.save();
              // ...
              // Questo crea un gradiente sottile che riempie una forma triangolare
              const grad = ctx.createLinearGradient(0, 0, 0, -H * 0.95);
              grad.addColorStop(0, 'rgba(120,220,255,0.10)');
              grad.addColorStop(0.2, 'rgba(120,220,255,0.05)');
              grad.addColorStop(0.7, 'rgba(120,220,255,0.005)');
              grad.addColorStop(1, 'rgba(120,220,255,0)'); // -> Quasi trasparente
              ctx.globalAlpha = 0.15; // -> Molto trasparente
              // ctx.filter = 'blur(12px)'; // <- Questo era il colpevole principale, ora è rimosso
              ctx.beginPath();
              // Disegna un triangolo sottile
              ctx.moveTo(-40 - i*12, 0); // Punto in basso sinistra
              ctx.lineTo(40 + i*12, 0);  // Punto in basso destra
              ctx.lineTo(12 + i*5, -H * 0.95); // Punto in alto
              ctx.lineTo(-12 - i*5, -H * 0.95); // Punto in alto
              ctx.closePath();
              ctx.fillStyle = cachedLightGradients[i % cachedLightGradients.length];
              ctx.fill(); // <- Questo fill crea l'area luminosa sottile
              ctx.restore();
          }

            // === NUVOLE - OTTIMIZZATO ===
            const time = Date.now() * 0.00012; // Usa un solo valore 'time' per l'animazione
            for (let c of fogClouds) {
                ctx.save();
                // Calcola visibilità in base all'altezza: più in alto, meno visibile
                let yRatio = 1 - (c.y / H);
                let alpha = c.alpha * (1 - 0.85 * yRatio * yRatio); // Fading quadratico
                ctx.globalAlpha = alpha;
                ctx.translate(c.x, c.y);
                // Riduci l'oscillazione
                ctx.rotate(Math.sin(time + c.phase) * 0.02);
                // Rimuovi completamente il blur per prestazioni
                // if (c.rx > 120) ctx.filter = 'blur(8px)';
                // else if (c.rx > 80) ctx.filter = 'blur(4px)';
                // else ctx.filter = 'none';
                // ctx.filter = 'none';
                // Usa un cerchio semplice con colore leggermente trasparente invece di un gradiente complesso
                ctx.fillStyle = c.color.replace(/\d?\.\d+\)$/,'0.15)'); // Usa alpha dal colore base
                ctx.beginPath();
                ctx.arc(0, 0, c.rx * 0.6, 0, 2 * Math.PI); // Usa un cerchio, non un'ellisse
                ctx.fill();
                ctx.restore();
            }
        }

        function updateFog() {
            const time = Date.now() * 0.0003; // Usa un solo valore per l'aggiornamento
            for (let c of fogClouds) {
                c.x += c.speed;
                // Riduci l'oscillazione verticale
                c.y += c.vy + Math.sin(time + c.phase) * 0.02;
                if (c.y < H * 0.2) c.y = H * 0.2 + Math.abs(c.vy);
                if (c.y > H * 0.9) c.y = H * 0.9 - Math.abs(c.vy);
                if (c.x - c.rx > W) {
                    Object.assign(c, createCloud(COLORS.indexOf(c.color) % LAYERS), { x: -c.rx });
                }
            }
        }

        // Ottimizzazione: Usa un timer invece di requestAnimationFrame per una frequenza più bassa
        let lastTime = 0;
        const targetFrameTime = 1000 / 30; // ~30 FPS

        function animateFog(currentTime) {
            if (currentTime - lastTime >= targetFrameTime) {
                updateFog();
                drawFog();
                lastTime = currentTime;
            }
            requestAnimationFrame(animateFog);
        }
        animateFog(0); // Avvia l'animazione
    }
}

// Inizializza tema all'avvio
initTheme();
showHomeScreen(() => {});

export { showHomeScreen };