import DollarRecognizer from "./dollarRecognizer";
import { drawManaSegments, setManaValues, getManaValues, setCurrentMana, getCurrentMana, getManaMax, getManaRecoverSpeed } from "./Manabar";

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
    const point = { x: e.clientX, y: e.clientY };
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
});

window.addEventListener("keyup", (e) => {
  if (e.key === "z" || e.key === "Z") {
    casting = false;
    recognizeSpell(points);
    points = [];
  }
});

let backgroundColor = '#ffffff'; // default giorno

// Ripristina modalità da localStorage
const savedMode = localStorage.getItem('mode');
if (savedMode === 'night') {
  backgroundColor = '#111111';
} else if (savedMode === 'day') {
  backgroundColor = '#ffffff';
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'n' || e.key === 'N') {
    backgroundColor = '#111111'; // notte
    localStorage.setItem('mode', 'night');
  }
  if (e.key === 'g' || e.key === 'G') {
    backgroundColor = '#ffffff'; // giorno
    localStorage.setItem('mode', 'day');
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

function showEffect(type) {
  const mousePos = { x: mouseX, y: mouseY };
  let newParticles = [];
  const count = 60; // Numero base di particelle

  if (type === "cerchio") {
    magicCircle = {
      x: mousePos.x,
      y: mousePos.y,
      radius: 120,
      thickness: 3
    };
    return; // Niente particelle, termina qui
  }

  const effects = {
    fuoco: () => {
      // Effetto fuoco esistente (particelle che salgono)
      for (let i = 0; i < count; i++) {
        newParticles.push({
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


function animate() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (casting) drawPath();
  updateParticles();
  drawParticles();
  drawFireParticles();
  drawMagicParticles();
  drawMagicCircle();
  regenMana();
  requestAnimationFrame(animate);
  circleRotation += 0.003;
  drawManaSegments();
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

  const { x, y, radius, thickness } = magicCircle;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(circleRotation);
  ctx.translate(-x, -y);

  // === Cerchi principali ===
  ctx.lineWidth = thickness;
  ctx.strokeStyle = "#ff00ff";
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
      color: "rgba(255, 0, 255,", // fucsia
    });
  }
}


function drawMagicParticles() {
  for (let i = activeMagicParticles.length - 1; i >= 0; i--) {
    const p = activeMagicParticles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    ctx.fillStyle = p.color + `${p.alpha})`;
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
  const debugBox = document.getElementById("debug");
  debugBox.classList.remove("hidden");
  debugBox.classList.add("visible");

  setTimeout(() => {
    debugBox.classList.remove("visible");
    debugBox.classList.add("hidden");
  }, duration);
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

function updateManaBar() {
  const manaBar = document.getElementById("mana-bar");
  const inner = manaBar.querySelector(".mana-inner");
  const percent = Math.max(0, Math.min(1, getCurrentMana() / getManaMax()));
  if (inner) {
    inner.style.width = `${percent * 100}%`;
  }
}

function spendMana(amount) {
  if (getManaValues().inBurnout) return false;
  if (getCurrentMana() < amount) {
    triggerBurnout();
    return false;
  }
  setCurrentMana(getCurrentMana() - amount);
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
}

// Inizializza la barra del mana
window.addEventListener("DOMContentLoaded", () => {
  const manaBar = document.getElementById("mana-bar");
  if (!manaBar.querySelector(".mana-inner")) {
    const inner = document.createElement("div");
    inner.className = "mana-inner";
    inner.style.height = "100%";
    inner.style.background = "linear-gradient(to right, cyan, blue)";
    inner.style.width = `${(currentMana / maxMana) * 100}%`;
    manaBar.appendChild(inner);
  }
  updateManaBar();
});