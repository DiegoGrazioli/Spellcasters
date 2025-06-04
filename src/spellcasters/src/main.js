import DollarRecognizer from "./dollarRecognizer";

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

let erasing = false;

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2 && magicCircle) {
    e.preventDefault();
    erasing = true;
    magicCircle.erasePoints = []; // Inizia a cancellare
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2 && magicCircle) {
    e.preventDefault();
    erasing = false;
    tryDeleteCircle();
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
      thickness: 3,
      erasePoints: [],
      erasedFraction: 0
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (casting) drawPath();
  updateParticles();
  drawParticles();
  drawFireParticles();
  drawMagicParticles();
  drawMagicCircle();
  requestAnimationFrame(animate);
  // drawTemplate("fuoco", ctx);
  // drawTemplate("acqua", ctx);
  // drawTemplate("aria", ctx);
  // drawTemplate("terra", ctx);
  drawTemplate("cerchio", ctx);
  circleRotation += 0.003;
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

  // === Erasing (non ruotato)
  if (erasing) {
    const step = 2 * Math.PI / 120;
    for (let angle = 0; angle <= 2 * Math.PI; angle += step) {
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      const dx = mouseX - px;
      const dy = mouseY - py;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        magicCircle.erasePoints.push({ x: px, y: py });
      }
    }
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
  debugBox.textContent = message;
  debugBox.classList.remove("hidden");
  debugBox.classList.add("visible");

  setTimeout(() => {
    debugBox.classList.remove("visible");
    debugBox.classList.add("hidden");
  }, duration);
}


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

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function tryDeleteCircle() {
  if (!magicCircle) return;

  const erasedAngles = new Set();
  const r = magicCircle.radius;
  const x = magicCircle.x;
  const y = magicCircle.y;
  const step = 2 * Math.PI / 120;

  for (let angle = 0; angle <= 2 * Math.PI; angle += step) {
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;

    const dx = mouseX - px;
    const dy = mouseY - py;
    const dist = Math.hypot(dx, dy);

    if (dist < 10) {
      const angleIndex = Math.floor(angle / step);
      erasedAngles.add(angleIndex);
    }
  }

  // Se cancellati più del 50% dei segmenti
  const percent = erasedAngles.size / 120;
  if (percent > 0.5) {
    magicCircle = null;
  }
}
