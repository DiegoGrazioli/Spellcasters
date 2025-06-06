import DollarRecognizer from "./dollarRecognizer";
import { drawManaSegments, setManaValues, getManaValues, setCurrentMana, getCurrentMana, getManaMax, getManaRecoverSpeed } from "./Manabar";
import { setTheme, getTheme } from "./theme.js";
import { drawElementPattern } from "./element-patterns.js";
import { getPlayerData, savePlayerData } from "./playerData.js";

const recognizer = new DollarRecognizer();

const canvas = document.getElementById("spellCanvas");
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let casting = false;
let points = [];
let particles = [];
let activeMagicParticles = [];

let magicCircle = null;
let circleRotation = 0;

let mouseX = 0;
let mouseY = 0;

// === MANA SYSTEM ===
// Usa solo il modulo manabar.js per gestire mana, manaMax, manaRecoverSpeed

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // evita il menu del browser

  if (!magicCircle) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const dx = mx - magicCircle.x;
  const dy = my - magicCircle.y;
  const dist = Math.hypot(dx, dy);

  if (dist >= magicCircle.radius - 120 && dist <= magicCircle.radius) {
    magicCircle = null; // cancellazione!
    showDebugMessage("Cerchio magico cancellato");
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  
  if (casting) {
    const point = { x: mouseX, y: mouseY };
    points.push(point);
    particles.push(createParticle(point.x, point.y));
    
    // Feedback visivo durante il disegno
    if (points.length > 5) {
      const partialResult = recognizer.recognize(points.slice(-10));
      if (partialResult.score > 0.5) {
        canvas.style.cursor = "pointer";
        canvas.style.boxShadow = `0 0 15px ${getElementColor(partialResult.name)}`;
      } else {
        canvas.style.cursor = "crosshair";
        canvas.style.boxShadow = "none";
      }
    }
  }
});

function getElementColor(element) {
  const colors = {
    fuoco: '#ff5555',
    acqua: '#5555ff',
    aria: '#aaaaee',
    terra: '#55aa55',
    fulmine: '#ffff55',
    luce: '#ffffff'
  };
  return colors[element] || '#ffffff';
}

window.addEventListener("keydown", (e) => {
  if ((e.key === "z" || e.key === "Z") && !casting) {
    casting = true;
    points = [];
  }
  if (e.key === 'n' || e.key === 'N') {
    setTheme('night');
  }
  if (e.key === 'g' || e.key === 'G') {
    setTheme('day');
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "z" || e.key === "Z") {
    casting = false;
    // Riconosci spell usando punti relativi al canvas
    const result = recognizer.recognize(points);
    if (result.name === "proiettile" && result.score > 0.5) {
      // Usa il primo e l'ultimo punto del tratto per la direzione
      if (points.length >= 2) {
        launchProjectile(points[0], points[points.length - 1]);
      }
    } else {
      recognizeSpell(points);
    }
    points = [];
  }
});

function createParticle(x, y) {
  return {
    x,
    y,
    radius: Math.random() * 2 + 1,
    alpha: 1,
    dx: (Math.random() - 0.5) * 1.5,
    dy: (Math.random() - 0.5) * 1.5,
  };
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.02;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (let p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(150, 200, 255, ${p.alpha})`;
    ctx.fill();
  }
}

function drawPath() {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = "rgba(180, 240, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function recognizeSpell(points) {
  if (points.length < 10) return null;
  const result = recognizer.recognize(points);
  // Soglia di confidenza
  if (result.score > 0.60) {
    showDebugMessage(`Simbolo riconosciuto: ${result.name} (${Math.round(result.score * 100)}% confidenza)`);
    showEffect(result.name);
    // Consuma 1 mana SOLO se non è il cerchio magico
    if (result.name !== "cerchio") {
      spendMana(1);
    }
    return result.name;
  }
  showDebugMessage('Simbolo non riconosciuto', 1000);
  return null;
}

let fireParticles = [];
let infusedElement = null;

let particleCount = Number(localStorage.getItem('particleCount')) || 60;

function showEffect(type) {
  const mousePos = { x: mouseX, y: mouseY };
  let newParticles = [];
  const count = particleCount; // Numero base di particelle

  if (type === "cerchio") {
    magicCircle = {
      x: mousePos.x,
      y: mousePos.y,
      radius: 120,
      thickness: 3
    };
    infusedElement = null;
    return; // Niente particelle, termina qui
  }

  // Se c'è un cerchio magico attivo e il simbolo è un elemento, infondi
  if (magicCircle && ["fuoco", "acqua", "aria", "terra"].includes(type)) {
    infusedElement = type;
    // Cambia colore del cerchio magico
    magicCircle.element = type;
    showDebugMessage(`Cerchio magico infuso con ${type}`);
    return;
  }

  const effects = {
    fuoco: () => {
      // Effetto fuoco esistente (particelle che salgono)
      for (let i = 0; i < count; i++) {
        fireParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 40,
          y: mousePos.y + (Math.random() - 0.5) * 40,
          radius: Math.random() * 4 + 2,
          alpha: 1,
          dy: Math.random() * -2 - 0.5, // Verso l'alto
          dx: (Math.random() - 0.5) * 0.5,
          color: `rgba(${200 + Math.random() * 55}, ${50 + Math.random() * 80}, 0, ${Math.random() * 0.8 + 0.2})`,
          life: 100, // Durata in frame
          decay: 0.015 // Velocità di decadimento
        });
      }
    },
    acqua: () => {
      // Effetto acqua che sgocciola (simile al fuoco ma verso il basso)
      for (let i = 0; i < count * 1.2; i++) {
        newParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 30,
          y: mousePos.y + (Math.random() - 0.5) * 30,
          radius: Math.random() * 3 + 1,
          alpha: 0.8,
          dy: Math.random() * 2 + 1, // Verso il basso
          dx: (Math.random() - 0.5) * 0.3,
          color: `rgba(${100 + Math.random() * 50}, ${150 + Math.random() * 100}, 255, ${Math.random() * 0.6 + 0.3})`,
          life: 80,
          decay: 0.01,
          gravity: 0.1 // Aggiunta di gravità per l'effetto goccia
        });
      }
    },
    aria: () => {
      // Effetto raffica di vento (particelle veloci e disperse)
      for (let i = 0; i < count * 1.5; i++) {
        const angle = Math.random() * Math.PI * 2; // Direzione casuale
        const speed = Math.random() * 3 + 2; // Velocità base
        newParticles.push({
          x: mousePos.x,
          y: mousePos.y,
          radius: Math.random() * 2 + 1,
          alpha: 0.6,
          dy: Math.sin(angle) * speed,
          dx: Math.cos(angle) * speed,
          color: `rgba(240, 240, 255, ${Math.random() * 0.5 + 0.3})`,
          life: 60,
          decay: 0.02,
          swirl: Math.random() * 0.2 - 0.1 // Effetto vortice
        });
      }
    },
    terra: () => {
      // Effetto terra (particelle pesanti e vibranti)
      for (let i = 0; i < count * 0.8; i++) {
        newParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 30,
          y: mousePos.y + (Math.random() - 0.5) * 30,
          radius: Math.random() * 4 + 2,
          alpha: 1,
          dy: Math.random() * 0.2 - 0.1, // Movimento minimo
          dx: Math.random() * 0.2 - 0.1,
          color: `rgba(${180 + Math.random() * 40}, ${160 + Math.random() * 30}, ${100 + Math.random() * 40}, ${Math.random() * 0.7 + 0.3})`,
          life: 150, // Durata maggiore
          decay: 0.005, // Decadimento più lento
          baseX: mousePos.x + (Math.random() - 0.5) * 40, // Posizione base per vibrazione
          baseY: mousePos.y + (Math.random() - 0.5) * 40,
          vibrateSpeed: Math.random() * 0.1 + 0.05 // Velocità vibrazione
        });
      }
    }

    
  };

  if (effects[type]) effects[type]();
  activeMagicParticles.push(...newParticles);
}


// === PROIEZIONE: PROIETTILE ===
let projectiles = [];

function launchProjectile(start, end) {
  // Consuma 1 mana per ogni proiettile
  if (!spendMana(2)) return;

  // Calcola direzione e velocità
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) return; // ignora tratti troppo corti
  const speed = 16;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;
  // Effetto particelle mana puro all'evocazione (molto denso)
  for (let i = 0; i < 80; i++) {
    activeMagicParticles.push({
      x: start.x + (Math.random() - 0.5) * 22,
      y: start.y + (Math.random() - 0.5) * 22,
      radius: Math.random() * 2.2 + 1.2,
      alpha: 0.18 + Math.random() * 0.18,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      color: 'rgba(120,220,255,',
    });
  }
  // Calcola la distanza massima fino al bordo canvas
  let maxT = 1;
  if (vx !== 0 || vy !== 0) {
    const tx = vx > 0 ? (canvas.width - start.x) / vx : (0 - start.x) / vx;
    const ty = vy > 0 ? (canvas.height - start.y) / vy : (0 - start.y) / vy;
    // Prendi il più piccolo t positivo
    const tArr = [tx, ty].filter(t => t > 0);
    if (tArr.length > 0) maxT = Math.min(...tArr);
  }
  const maxLife = Math.floor(maxT);
  projectiles.push({
    x: start.x,
    y: start.y,
    vx,
    vy,
    life: maxLife,
    alpha: 1
  });
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.alpha *= 0.97;

    // --- Scia di mana puro: più visibile e grande ---
    for (let j = 0; j < 8; j++) { // aumenta la densità
      activeMagicParticles.push({
        x: p.x + (Math.random() - 0.5) * 18,
        y: p.y + (Math.random() - 0.5) * 18,
        radius: Math.random() * 4 + 2.5, // più grande
        alpha: 0.22 + Math.random() * 0.18, // più visibile
        dx: (Math.random() - 0.5) * 1.1,
        dy: (Math.random() - 0.5) * 1.1,
        color: 'rgba(120,220,255,',
      });
    }
    // --- Fine scia ---

    // Rimuovi se esce dal canvas o termina la vita
    if (p.life <= 0 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles() {
  
}

// === AGGIORNA E DISEGNA PROIEZIONI NEL LOOP ===
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (casting) drawPath();
  updateParticles();
  drawParticles();
  drawFireParticles();
  drawMagicParticles();
  drawMagicCircle();
  updateProjectiles();
  drawProjectiles();
  regenMana();
  requestAnimationFrame(animate);
  circleRotation += 0.003;
  drawManaSegments();
  // drawTemplate('terra', ctx); // Disegna il template del fuoco per debug
}

// PARTICELLE ELEMENTALI

function drawFireParticles() {
  for (let p of fireParticles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    ctx.fillStyle = p.color;
    ctx.fill();
    p.y += p.dy;
    p.alpha -= 0.015;
    p.radius *= 0.98;
  }

  fireParticles = fireParticles.filter(p => p.alpha > 0 && p.radius > 0.5);
}

function drawMagicCircle() {
  if (!magicCircle) return;

  const { x, y, radius, thickness, element } = magicCircle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(circleRotation);
  ctx.translate(-x, -y);

  // === Glow radiale dal centro per cerchio magico infuso ===
  if (infusedElement && element) {
    // Glow radiale: gradiente dal centro che sfuma verso l'esterno
    const glowRadius = radius + 24;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    grad.addColorStop(0, getElementColor(element) + 'cc'); // centro, più intenso
    grad.addColorStop(0.45, getElementColor(element) + '44');
    grad.addColorStop(0.85, getElementColor(element) + '11');
    grad.addColorStop(1, getElementColor(element) + '00'); // trasparente
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // === Pattern elementale se infuso ===
  if (infusedElement) {
    drawElementPattern(ctx, x, y, radius * 0.82, infusedElement);
  }

  // === Cerchi principali ===
  ctx.lineWidth = thickness;
  ctx.strokeStyle = element ? getElementColor(element) : "#ff00ff";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius + 20, 0, 2 * Math.PI);
  ctx.stroke();

  // === Segmenti radiali più sottili ===
  ctx.lineWidth = 1;
  const numSegments = 24;
  for (let i = 0; i < numSegments; i++) {
    const angle = (2 * Math.PI / numSegments) * i;
    const innerX = x + Math.cos(angle) * radius;
    const innerY = y + Math.sin(angle) * radius;
    const outerX = x + Math.cos(angle) * (radius + 20);
    const outerY = y + Math.sin(angle) * (radius + 20);

    ctx.beginPath();
    ctx.moveTo(outerX, outerY);
    ctx.lineTo(innerX, innerY);
    ctx.stroke();
  }

  ctx.restore();

  // === Particelle fucsia fluttuanti attorno al cerchio ===
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius + 10 + Math.random() * 15;
    const px = x + Math.cos(angle + circleRotation) * dist;
    const py = y + Math.sin(angle + circleRotation) * dist;

    activeMagicParticles.push({
      x: px,
      y: py,
      radius: Math.random() * 1.5 + 0.5,
      alpha: 0.1 + Math.random() * 0.1,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      color: element ? getElementColor(element) + "," : "rgba(255, 0, 255,",
    });
  }
}


function drawMagicParticles() {
  for (let i = activeMagicParticles.length - 1; i >= 0; i--) {
    const p = activeMagicParticles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    // Se il colore non termina con la virgola, aggiungila
    let color = p.color.endsWith(',') ? p.color : p.color.replace(/\)$/, ',');
    ctx.fillStyle = color + `${p.alpha})`;
    ctx.fill();
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.01;
    p.radius *= 0.99;
    if (p.alpha <= 0.01 || p.radius <= 0.2) {
      activeMagicParticles.splice(i, 1); // rimuovi se svanita
    }
  }
}

// FINE PARTICELLE ELEMENTALI

animate();
window.addEventListener("resize", resizeCanvas);

function showDebugMessage(message, duration = 2000) {
  // const debugBox = document.getElementById("debug");
  // debugBox.classList.remove("hidden");
  // debugBox.classList.add("visible");

  // setTimeout(() => {
  //   debugBox.classList.remove("visible");
  //   debugBox.classList.add("hidden");
  // }, duration);
}

// DEBUG

function drawTemplate(name, ctx) {
  const template = recognizer.templates.find(t => t.name === name);
  if (!template) return;

  ctx.beginPath();
  ctx.moveTo(template.points[0].x, template.points[0].y);
  for (let i = 1; i < template.points.length; i++) {
    ctx.lineTo(template.points[i].x, template.points[i].y);
  }
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// FINE DEBUG

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// === MANA SYSTEM ===

function spendMana(amount) {
  if (getManaValues().inBurnout) return false;
  if (getCurrentMana() < amount) {
    triggerBurnout();
    return false;
  }
  setCurrentMana(getCurrentMana() - amount);

  addPlayerExp(amount);
  return true;
}

function triggerBurnout() {
  let manaVals = getManaValues();
  setManaValues({
    burnout: true,
    burnoutT: 300, // 5 secondi a 60fps
    current: 0
  });
  showDebugMessage("Burnout! Mana esaurito.", 2000);
}

function regenMana() {
  let { mana, manaMax, manaRecoverSpeed, inBurnout, burnoutTimer } = getManaValues();
  if (!inBurnout && mana < manaMax) {
    mana += manaRecoverSpeed;
    if (mana > manaMax) mana = manaMax;
  }
  if (inBurnout) {
    burnoutTimer--;
    if (burnoutTimer <= 0) {
      inBurnout = false;
      mana = manaMax * 0.2; // riparti con il 20%
    }
  }
  setManaValues({ max: manaMax, current: mana, regen: manaRecoverSpeed, burnout: inBurnout, burnoutT: burnoutTimer });
  // Salva il mana attuale
  savePlayerData({ mana });
}

// === SISTEMA DI LEVELING ===
let playerLevel = 1;
let playerExp = 0;
let playerExpToNext = 100;

// Carica dati player all'avvio
const loadedPlayer = getPlayerData();
if (loadedPlayer) {
  playerLevel = loadedPlayer.livello || 1;
  playerExp = loadedPlayer.esperienza || 0;
  playerExpToNext = getExpToNext(playerLevel);
  updateManaStatsForLevel(playerLevel);
  if (typeof loadedPlayer.mana === 'number') {
    setCurrentMana(loadedPlayer.mana);
  }
  drawExpBar(); // <-- Aggiorna subito la barra exp
}

// Aggiorna mana massimo e rigenerazione in base al livello
function updateManaStatsForLevel(level) {
  const baseMana = 1;
  const baseRegen = 0.01; // Molto lento a livello 1
  setManaValues({
    max: baseMana * level * 10,
    regen: baseRegen * level * 0.2 // Crescita più evidente con il livello
  });
}

// Quando il player guadagna esperienza:
function addPlayerExp(amount) {
  playerExp += amount;
  while (playerExp >= playerExpToNext) {
    playerExp -= playerExpToNext;
    playerLevel++;
    playerExpToNext = getExpToNext(playerLevel);
    updateManaStatsForLevel(playerLevel);
    showDebugMessage(`Livello salito! Ora sei livello ${playerLevel}`);
    // Salva livello ogni volta che cambia
    savePlayerData({ livello: playerLevel });
  }
  // Salva esperienza ogni volta che cambia
  savePlayerData({ esperienza: playerExp });
  drawExpBar();
}

function drawExpBar() {
  const bar = document.getElementById('exp-bar');
  const lvl = document.getElementById('exp-level');
  const glow = document.querySelector('.exp-bar-glow');
  const barContainer = document.getElementById('exp-bar-container');
  if (!bar || !lvl || !glow || !barContainer) return;
  const prevPerc = parseFloat(bar.style.getPropertyValue('width'))/100 || 0;
  lvl.textContent = playerLevel;
  const perc = Math.min(1, playerExp / playerExpToNext);
  bar.style.width = (perc * 100) + "%";

  // Mostra barra exp e livello con transizione
  barContainer.classList.add('exp-visible');
  lvl.classList.add('exp-visible');
  if (window._expBarHideTimeout) clearTimeout(window._expBarHideTimeout);
  window._expBarHideTimeout = setTimeout(() => {
    barContainer.classList.remove('exp-visible');
    lvl.classList.remove('exp-visible');
  }, 1000);

  // Attiva animazione glow solo se la barra aumenta
  if (perc > prevPerc) {
    glow.classList.remove('animate');
    void glow.offsetWidth;
    void bar.offsetWidth;
    setTimeout(() => {
      glow.classList.add('animate');
    }, 0);
    setTimeout(() => glow.classList.remove('animate'), 1100);
  }
}

function getExpToNext(level) {
  // Esempio: base 100, cresce quadraticamente
  return Math.floor(100 + 30 * Math.pow(level, 1.5));
}