import DollarRecognizer from "./dollarRecognizer";
import { drawManaSegments, setManaValues, getManaValues, setCurrentMana, getCurrentMana, getManaMax, getManaRecoverSpeed } from "./manabar.js";
import { setTheme } from "./theme.js";
import { drawElementPattern, drawProjectilePolygonPattern } from "./element-patterns.js";
import { loadPlayerFromDB, savePlayerData, getPlayerData } from "./player-db.js";

const recognizer = new DollarRecognizer();

const username = localStorage.getItem('currentPlayer');

const canvas = document.getElementById("spellCanvas");
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === VARIABILI GLOBALI ===
let casting = false;
let points = [];
let particles = [];
let activeMagicParticles = [];
let fireParticles = [];
let projectiles = [];

let magicCircle = null;
let circleRotation = 0;
let infusedElement = null;
let infusedProjection = null;
let magicCircleToDelete = false;

let isActivatingMagicCircle = false;
let magicCircleDragStart = null;
let magicCircleDragEnd = null;

let mouseX = 0;
let mouseY = 0;

let particleCount = Number(localStorage.getItem('particleCount')) || 60;

let isDrawingSpaziale = false;
let spazialePolygonPoints = [];
let spazialePolygonColor = "#00e0ff";

let permanentSpazialeAreas = [];

let affinityToAdd = {};
let proiezioniToAdd = {};
let lastAffinitySave = Date.now();
let lastProiezioniSave = Date.now();

let expToAdd = 0;
let lastExpSave = Date.now();

// === EVENTI CANVAS ===
canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !magicCircle) return;
  const dx = e.offsetX - magicCircle.x;
  const dy = e.offsetY - magicCircle.y;
  const dist = Math.hypot(dx, dy);
  if (dist > magicCircle.radius + 20) return;
  if (magicCircle.projections.length > 0) {
    const tipo = magicCircle.projections[magicCircle.projections.length - 1];
    if (tipo === "spaziale") {
      isDrawingSpaziale = true;
      spazialePolygonPoints = [];
      spazialePolygonColor = magicCircle.elemento ? getElementColor(magicCircle.elemento) : "#00e0ff";
    } else {
      isActivatingMagicCircle = true;
      magicCircleDragStart = { x: magicCircle.x, y: magicCircle.y };
      magicCircleDragEnd = { x: e.offsetX, y: e.offsetY };
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  if (isDrawingSpaziale) {
    spazialePolygonPoints.push({ x: mouseX, y: mouseY });
    return;
  }
  if (isActivatingMagicCircle && magicCircle) {
    magicCircleDragEnd = { x: e.offsetX, y: e.offsetY };
  }
  if (casting) {
    const point = { x: mouseX, y: mouseY };
    points.push(point);
    particles.push(createParticle(point.x, point.y));
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

canvas.addEventListener("mouseup", (e) => {
  let player = getPlayerData();
  if (isDrawingSpaziale && spazialePolygonPoints.length > 2 && magicCircle && !player.isOverloaded) {
    // Chiudi il poligono
    spazialePolygonPoints.push({ ...spazialePolygonPoints[0] });
    // Usa la proiezione spaziale
    magicCircle.projections.pop(); // Consuma la carica
    activateSpazialeArea(spazialePolygonPoints, spazialePolygonColor);
    incrementaProiezioneUsataBuffer("spaziale");
    showDebugMessage(`Area SPAZIALE creata! Cariche rimanenti: ${magicCircle.projections.length}`);
    if (magicCircle.projections.length <= 0) magicCircleToDelete = true;
    isDrawingSpaziale = false;
    spazialePolygonPoints = [];
    return;
  }
  if (isActivatingMagicCircle && magicCircle && !player.isOverloaded) {
    triggerMagicCircleAction(magicCircleDragStart, magicCircleDragEnd);
    isActivatingMagicCircle = false;
    magicCircleDragStart = null;
    magicCircleDragEnd = null;
  } else if (e.button === 0 && magicCircle && !player.isOverloaded) {
    triggerMagicCircleAction();
  }
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Cancella area spaziale se il click è dentro una di esse
  for (let i = permanentSpazialeAreas.length - 1; i >= 0; i--) {
    if (pointInPolygon({x: mx, y: my}, permanentSpazialeAreas[i].points)) {
      permanentSpazialeAreas.splice(i, 1);
      showDebugMessage("Area spaziale rimossa!");
      return;
    }
  }

  // Cancella cerchio magico se fuori dalle aree
  if (!magicCircle) return;
  const dx = mx - magicCircle.x;
  const dy = my - magicCircle.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= magicCircle.radius - 120 && dist <= magicCircle.radius) {
    magicCircle = null;
    showDebugMessage("Cerchio magico cancellato");
  }
});

// === EVENTI TASTIERA ===
window.addEventListener("keydown", (e) => {
  if ((e.key === "z" || e.key === "Z") && !casting) {
    casting = true;
    points = [];
  }
  if (e.key === 'n' || e.key === 'N') setTheme('night');
  if (e.key === 'g' || e.key === 'G') setTheme('day');
});

window.addEventListener("keyup", (e) => {
  if (e.key === "z" || e.key === "Z") {
    casting = false;
    recognizeSpell(points);
    points = [];
  }
});

window.addEventListener("resize", resizeCanvas);

// === PARTICELLE GENERICHE ===
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

// === PARTICELLE MAGICHE E FUOCO ===
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

function drawMagicParticles() {
  for (let i = activeMagicParticles.length - 1; i >= 0; i--) {
    const p = activeMagicParticles[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    ctx.fillStyle = p.color + p.alpha + ")";
    ctx.fill();
    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.01;
    p.radius *= 0.99;
    if (p.alpha <= 0.01 || p.radius <= 0.2) {
      activeMagicParticles.splice(i, 1);
    }
  }
}

// === CERCHIO MAGICO E PROIEZIONI ===
function drawMagicCircle() {
  if (!magicCircle) return;
  const { x, y, radius, thickness, element } = magicCircle;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(circleRotation);
  ctx.translate(-x, -y);

  // Glow radiale
  if (infusedElement && element) {
    const glowRadius = radius + 24;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    grad.addColorStop(0, getElementColor(element) + 'cc');
    grad.addColorStop(0.45, getElementColor(element) + '44');
    grad.addColorStop(0.85, getElementColor(element) + '11');
    grad.addColorStop(1, getElementColor(element) + '00');
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // Pattern elementale
  if (infusedElement) {
    drawElementPattern(ctx, x, y, radius * 0.82, infusedElement);
  }

  // Pattern di proiezione
  let projColor = infusedElement ? getElementColor(infusedElement) : "#ff33cc";
  if (magicCircle.projections && magicCircle.projections.length > 0) {
    drawProjectilePolygonPattern(
      ctx,
      x,
      y,
      radius * 1.2,
      magicCircle.projections.length,
      projColor,
      -2 * circleRotation,
      magicCircle.projections // <-- passa l'array dei tipi
    );
  }

  // Cerchi principali
  ctx.lineWidth = thickness;
  ctx.strokeStyle = infusedElement ? getElementColor(infusedElement) : "#ff33cc";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius + 20, 0, 2 * Math.PI);
  ctx.stroke();

  // Segmenti radiali
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

  // Particelle fucsia fluttuanti attorno al cerchio
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

function showEffect(type) {
  const mousePos = { x: mouseX, y: mouseY };
  let newParticles = [];
  const count = particleCount;

  if (type === "cerchio") {
    magicCircle = {
      x: mousePos.x,
      y: mousePos.y,
      radius: 120,
      thickness: 3,
      projections: [] // <-- sostituisce projectileCount
    };
    infusedElement = null;
    infusedProjection = null;
    return;
  }

  const effects = {
    fuoco: () => {
      for (let i = 0; i < count; i++) {
        fireParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 40,
          y: mousePos.y + (Math.random() - 0.5) * 40,
          radius: Math.random() * 4 + 2,
          alpha: 1,
          dy: Math.random() * -2 - 0.5,
          dx: (Math.random() - 0.5) * 0.5,
          color: `rgba(${200 + Math.random() * 55}, ${50 + Math.random() * 80}, 0, ${Math.random() * 0.8 + 0.2})`,
          life: 100,
          decay: 0.015
        });
      }
    },
    acqua: () => {
      for (let i = 0; i < count * 1.2; i++) {
        newParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 30,
          y: mousePos.y + (Math.random() - 0.5) * 30,
          radius: Math.random() * 3 + 1,
          alpha: 0.8,
          dy: Math.random() * 2 + 1,
          dx: (Math.random() - 0.5) * 0.3,
          color: `rgba(${100 + Math.random() * 50}, ${150 + Math.random() * 100}, 255, ${Math.random() * 0.6 + 0.3})`,
          life: 80,
          decay: 0.01,
          gravity: 0.1
        });
      }
    },
    aria: () => {
      for (let i = 0; i < count * 1.5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        newParticles.push({
          x: mousePos.x,
          y: mousePos.y,
          radius: Math.random() * 2 + 1,
          alpha: 0.6,
          dy: Math.sin(angle) * speed,
          dx: Math.cos(angle) * speed,
          color: `rgba(170,170,238,`,
          life: 60,
          decay: 0.02,
          swirl: Math.random() * 0.2 - 0.1
        });
      }
    },
    terra: () => {
      for (let i = 0; i < count * 0.8; i++) {
        const r = Math.floor(180 + Math.random() * 40);
        const g = Math.floor(160 + Math.random() * 30);
        const b = Math.floor(100 + Math.random() * 40);
        newParticles.push({
          x: mousePos.x + (Math.random() - 0.5) * 30,
          y: mousePos.y + (Math.random() - 0.5) * 30,
          radius: Math.random() * 4 + 2,
          alpha: 1,
          dy: Math.random() * 0.2 - 0.1,
          dx: Math.random() * 0.2 - 0.1,
          color: `rgba(${r},${g},${b},`,
          life: 150,
          decay: 0.005,
          baseX: mousePos.x + (Math.random() - 0.5) * 40,
          baseY: mousePos.y + (Math.random() - 0.5) * 40,
          vibrateSpeed: Math.random() * 0.1 + 0.05
        });
      }
    }
  };

  if (effects[type]) {
    effects[type]();
    activeMagicParticles.push(...newParticles);
  }
}

// === PROIEZIONI: PROIETTILE ===
function launchProjectile(start, end, colorOverride, tipoProiezione = "proiettile") {
  if (!spendMana(2)) return;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) return;
  const speed = 16;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;
  const color = colorOverride || 'rgba(120,220,255,';
  for (let i = 0; i < 80; i++) {
    activeMagicParticles.push({
      x: start.x + (Math.random() - 0.5) * 22,
      y: start.y + (Math.random() - 0.5) * 22,
      radius: Math.random() * 2.2 + 1.2,
      alpha: 0.18 + Math.random() * 0.18,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      color: color,
    });
  }
  let maxT = 1;
  if (vx !== 0 || vy !== 0) {
    const tx = vx > 0 ? (canvas.width - start.x) / vx : (0 - start.x) / vx;
    const ty = vy > 0 ? (canvas.height - start.y) / vy : (0 - start.y) / vy;
    const tArr = [tx, ty].filter(t => t > 0);
    if (tArr.length > 0) maxT = Math.min(...tArr);
  }
  const maxLife = Math.max(30, Math.floor(maxT));
  projectiles.push({
    x: start.x,
    y: start.y,
    vx,
    vy,
    life: maxLife,
    alpha: 1,
    color,
    tipo: tipoProiezione
  });
  incrementaProiezioneUsataBuffer("proiettile");
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.alpha *= 0.97;
    for (let j = 0; j < 8; j++) {
      activeMagicParticles.push({
        x: p.x + (Math.random() - 0.5) * 18,
        y: p.y + (Math.random() - 0.5) * 18,
        radius: Math.random() * 4 + 2.5,
        alpha: 0.22 + Math.random() * 0.18,
        dx: (Math.random() - 0.5) * 1.1,
        dy: (Math.random() - 0.5) * 1.1,
        color: p.color || 'rgba(120,220,255,',
      });
    }
    if (p.life <= 0 || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles() {
  // Se vuoi disegnare i proiettili stessi (es. una sfera), aggiungi qui
}

// === LOGICA CERCHIO MAGICO ===
function triggerMagicCircleAction(start, end) {
  let player = getPlayerData();
  if (!player.proiettiliLanciati) player.proiettiliLanciati = 0;

  // Solo elemento
  if (magicCircle.elemento && (!magicCircle.projections || magicCircle.projections.length === 0)) {
    showEffect(magicCircle.elemento, magicCircle.x, magicCircle.y);
    incrementaAffinitaBuffer(magicCircle.elemento);
  }
  // Solo proiezione
  else if ((!magicCircle.elemento || magicCircle.elemento === null) && magicCircle.projections && magicCircle.projections.length > 0 && start && end) {
    const tipo = magicCircle.projections.pop(); // FILO
    if (tipo === "spaziale") {
      activateSpazialeProjection(start, end);
    } else {
      launchProjectile(start, end, "#78dcff", tipo);
    }
    incrementaProiezioneUsataBuffer(tipo);
    showDebugMessage(`Proiezione lanciata! Cariche rimanenti: ${magicCircle.projections.length}`);
    if (magicCircle.projections.length <= 0) {
      magicCircleToDelete = true;
    }
  }
  // Entrambi
  else if (magicCircle.elemento && magicCircle.projections && magicCircle.projections.length > 0 && start && end) {
    const tipo = magicCircle.projections.pop(); // FILO
    let color = getElementColor(magicCircle.elemento);
    if (!color.endsWith(',')) {
      if (color.startsWith('#') && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        color = `rgba(${r},${g},${b},`;
      } else {
        color = color + ',';
      }
    }
    if (tipo === "spaziale") {
      activateSpazialeProjection(start, end, color + "1)");
    } else {
      launchProjectile(start, end, color + "1)", tipo);
    }
    incrementaProiezioneUsataBuffer(tipo);
    showDebugMessage(`Proiezione lanciata con elemento ${magicCircle.elemento}! Cariche rimanenti: ${magicCircle.projections.length}`);
    if (magicCircle.projections.length <= 0) {
      magicCircleToDelete = true;
    }
  }
}

// Funzione placeholder per la proiezione spaziale
function activateSpazialeProjection(start, end, color = "#00e0ff") {
  // Esegui qui l'effetto speciale della proiezione spaziale
  // Ad esempio: effetto grafico, teletrasporto, distorsione, ecc.
  showDebugMessage("Proiezione SPAZIALE attivata!");
  // Esempio di effetto: una breve esplosione di particelle azzurre
  for (let i = 0; i < 60; i++) {
    activeMagicParticles.push({
      x: start.x + (Math.random() - 0.5) * 40,
      y: start.y + (Math.random() - 0.5) * 40,
      radius: Math.random() * 3 + 1,
      alpha: 0.7,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      color: color.replace("1)", "0.7)")
    });
  }
  incrementaProiezioneUsataBuffer("spaziale");
}

// === RICONOSCIMENTO GESTURE ===
function recognizeSpell(points) {
  if (points.length < 10) return null;
  const result = recognizer.recognize(points);

  if (result.score > 0.60) {
    showDebugMessage(`Simbolo riconosciuto: ${result.name} (${Math.round(result.score * 100)}% confidenza)`);
    if (magicCircle) {
      // Aggiungi qui anche "spaziale"
      if (["proiettile", "triangolo", "spaziale"].includes(result.name)) {
        if (!magicCircle.projections) magicCircle.projections = [];
        // Usa direttamente il nome riconosciuto come tipo di proiezione
        magicCircle.projections.push(result.name === "triangolo" ? "proiettile" : result.name);
        infusedProjection = result.name;
        showDebugMessage(`Proiezioni accumulate: ${magicCircle.projections.length}`);
        return result.name;
      }
      if (["fuoco", "acqua", "aria", "terra"].includes(result.name)) {
        magicCircle.elemento = result.name;
        infusedElement = result.name;
        showDebugMessage(`Cerchio magico infuso con elemento: ${result.name}`);
        incrementaAffinitaBuffer(result.name);
        return result.name;
      }
    }
    if (result.name === "cerchio") {
      showEffect(result.name);
      return result.name;
    }
    if (result.name === "proiettile") {
      if (points.length >= 2) {
        launchProjectile(points[0], points[points.length - 1]);
      }
    } else if (result.name === "spaziale") {
      // Puoi aggiungere qui eventuali effetti speciali per "spaziale" fuori dal cerchio magico
    } else if (["fuoco", "acqua", "aria", "terra"].includes(result.name)) {
      showEffect(result.name);
      incrementaAffinitaBuffer(result.name);
      spendMana(1);
    } else {
      showEffect(result.name);
    }
    return result.name;
  }
  showDebugMessage('Simbolo non riconosciuto', 1000);
  return null;
}

// === UTILITY E DEBUG ===
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

function showDebugMessage(message, duration = 2000) {
  // Debug UI disabilitata/commentata
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

function drawMagicCircleDragTrail() {
  if (isActivatingMagicCircle && magicCircleDragStart && magicCircleDragEnd) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 8;
    let color = magicCircle.elemento ? getElementColor(magicCircle.elemento) : "rgba(120,220,255,0.7)";
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(magicCircleDragStart.x, magicCircleDragStart.y);
    ctx.lineTo(magicCircleDragEnd.x, magicCircleDragEnd.y);
    ctx.stroke();
    ctx.restore();
  }
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

// === SISTEMA DI LEVELING E MANA ===
let playerLevel = 1;
let playerExp = 0;
let playerExpToNext = 100;

(async () => {
  const loadedPlayer = await loadPlayerFromDB(username);
  if (loadedPlayer) {
    playerLevel = loadedPlayer.livello || 1;
    playerExp = loadedPlayer.esperienza || 0;
    playerExpToNext = getExpToNext(playerLevel);
    updateManaStatsForLevel(playerLevel);
    if (typeof loadedPlayer.mana === 'number') {
      setCurrentMana(loadedPlayer.mana);
    }
    if (typeof loadedPlayer.manaMax !== 'number') {
      loadedPlayer.manaMax = loadedPlayer.livello * 10 || 10;
      await savePlayerData(username, { manaMax: loadedPlayer.manaMax });
    }
    drawExpBar();
  }
})();

function updateManaStatsForLevel(level) {
  const baseMana = 1;
  const baseRegen = 0.01;
  setManaValues({
    max: baseMana * level * 10,
    regen: baseRegen * level * 0.2
  });
}

async function addPlayerExp(amount) {
  let player = await loadPlayerFromDB(username);
  if (!player) player = { username, esperienza: 0, livello: 1, affinita: {}, proiezioniUsate: {}, mana: 0 };
  player.esperienza = (player.esperienza ?? 0) + amount;
  let levelUp = false;
  while (player.esperienza >= getExpToNext(player.livello ?? 1)) {
    player.esperienza -= getExpToNext(player.livello ?? 1);
    player.livello = (player.livello ?? 1) + 1;
    updateManaStatsForLevel(player.livello);
    player.manaMax = player.livello * 10;
    showDebugMessage(`Livello salito! Ora sei livello ${player.livello}`);
    levelUp = true;
  }
  player.manaMax = player.manaMax || getManaMax();
  await savePlayerData(username, {
    esperienza: player.esperienza,
    livello: player.livello ?? 1,
    affinita: player.affinita,
    proiezioniUsate: player.proiezioniUsate ?? {},
    mana: player.mana ?? 0,
    manaMax: player.manaMax
  });
  playerLevel = player.livello;
  playerExp = player.esperienza;
  playerExpToNext = getExpToNext(playerLevel);
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
  barContainer.classList.add('exp-visible');
  lvl.classList.add('exp-visible');
  if (window._expBarHideTimeout) clearTimeout(window._expBarHideTimeout);
  window._expBarHideTimeout = setTimeout(() => {
    barContainer.classList.remove('exp-visible');
    lvl.classList.remove('exp-visible');
  }, 1000);
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
  return Math.floor(100 + 30 * Math.pow(level, 1.5));
}

function spendMana(amount) {
  if (getManaValues().inBurnout) return false;
  if (getCurrentMana() < amount) {
    triggerBurnout();
    return false;
  }
  setCurrentMana(getCurrentMana() - amount);
  expToAdd += amount;
  return true;
}

function triggerBurnout() {
  let manaVals = getManaValues();
  setManaValues({
    burnout: true,
    burnoutT: 300,
    current: 0
  });
  showDebugMessage("Burnout! Mana esaurito.", 2000);
}

async function regenMana() {
  let { mana, manaMax, manaRecoverSpeed, inBurnout, burnoutTimer } = getManaValues();
  if (!inBurnout && mana < manaMax) {
    mana += manaRecoverSpeed;
    if (mana > manaMax) mana = manaMax;
  }
  if (inBurnout) {
    burnoutTimer--;
    if (burnoutTimer <= 0) {
      inBurnout = false;
      mana = manaMax * 0.2;
    }
  }
  setManaValues({ max: manaMax, current: mana, regen: manaRecoverSpeed, burnout: inBurnout, burnoutT: burnoutTimer });
}

// === AFFINITA' E PROIEZIONI USATE ===
function incrementaAffinitaBuffer(elemento, valore = 1) {
  affinityToAdd[elemento] = (affinityToAdd[elemento] || 0) + valore;
}

function incrementaProiezioneUsataBuffer(tipo, valore = 1) {
  proiezioniToAdd[tipo] = (proiezioniToAdd[tipo] || 0) + valore;
}

// === ANIMATE LOOP ===
export function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (casting) drawPath();
  updateParticles();
  drawParticles();
  drawFireParticles();
  drawMagicParticles();
  drawMagicCircle();
  drawLastProjectileParticles();
  updateProjectiles();
  drawProjectiles();
  drawSpazialePolygon();
  drawPermanentSpazialeAreas();

  let manaToDrain = 0;
  const deltaTime = 1 / 60; // animate gira a ~60fps
  for (let i = permanentSpazialeAreas.length - 1; i >= 0; i--) {
    const area = permanentSpazialeAreas[i];
    manaToDrain += area.manaDrain;

    // Timer affinità
    area.affinityTimer += deltaTime;
    if (area.affinityTimer >= 1) {
      area.affinityTimer -= 1;
      // Calcolo proporzionale all'area
      const areaValue = polygonArea(area.points);
      const affinityGain = 0.5 * (areaValue / 100000) * 0.0001;
      incrementaProiezioneUsataBuffer("spaziale", affinityGain);

      const element = getElementFromColor(area.color);
      if (element) incrementaAffinitaBuffer(element, area.manaDrain); // <-- aggiorna qui, non ogni frame!
    }
  }
  if (manaToDrain > 0) {
    let currentMana = getCurrentMana();
    if (currentMana <= manaToDrain) {
      permanentSpazialeAreas = [];
      showDebugMessage("Mana esaurito! Tutte le aree spaziali sono svanite.");
      triggerBurnout();
    } else {
      setCurrentMana(currentMana - manaToDrain);
    }
    expToAdd += manaToDrain;
  }

  const now = Date.now();
  if (now - lastAffinitySave > 1000 && Object.keys(affinityToAdd).length > 0) {
    // Carica player, aggiorna affinità, salva
    (async () => {
      let player = await loadPlayerFromDB(username);
      if (!player) player = { username, affinita: {}, proiezioniUsate: {}, mana: 0, livello: 1, esperienza: 0 };
      for (const el in affinityToAdd) {
        player.affinita[el] = (player.affinita[el] || 0) + affinityToAdd[el];
      }
      await savePlayerData(username, { affinita: player.affinita ?? {} });
      affinityToAdd = {};
      lastAffinitySave = now;
    })();
    drawExpBar();
  }
  if (now - lastProiezioniSave > 1000 && Object.keys(proiezioniToAdd).length > 0) {
    (async () => {
      let player = await loadPlayerFromDB(username);
      if (!player) player = { username, affinita: {}, proiezioniUsate: {}, mana: 0, livello: 1, esperienza: 0 };
      for (const tipo in proiezioniToAdd) {
        if (!player.proiezioniUsate) player.proiezioniUsate = {};
        player.proiezioniUsate[tipo] = (player.proiezioniUsate[tipo] || 0) + proiezioniToAdd[tipo];
      }
      await savePlayerData(username, { proiezioniUsate: player.proiezioniUsate ?? {} });
      proiezioniToAdd = {};
      lastProiezioniSave = now;
    })();
    drawExpBar();
  }
  if (now - lastExpSave > 1000 && expToAdd > 0) {
    (async () => {
      await addPlayerExp(expToAdd);
      expToAdd = 0;
      lastExpSave = now;
    })();
  }

  regenMana();
  requestAnimationFrame(animate);
  circleRotation += 0.003;
  drawManaSegments();
  drawMagicCircleDragTrail();
  // drawTemplate('terra', ctx);

  if (magicCircleToDelete) {
    magicCircle = null;
    infusedElement = null;
    infusedProjection = null;
    magicCircleToDelete = false;
  }
}

function drawLastProjectileParticles() {
  if (!magicCircle || !magicCircle.projections || magicCircle.projections.length < 1) return;

  const count = magicCircle.projections.length;
  const angle = -Math.PI / 2 + (2 * Math.PI / count) * (count - 1) - circleRotation;
  const r = magicCircle.radius * 1.1;
  const x = magicCircle.x + Math.cos(angle) * r;
  const y = magicCircle.y + Math.sin(angle) * r;

  for (let i = 0; i < 6; i++) {
    activeMagicParticles.push({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      radius: Math.random() * 2 + 1,
      alpha: 0.18 + Math.random() * 0.18,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
      color: magicCircle.elemento
        ? getElementColor(magicCircle.elemento) + ","
        : "rgba(255, 0, 255,"
    });
  }
}

function drawSpazialePolygon() {
  if (isDrawingSpaziale && spazialePolygonPoints.length > 1) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(spazialePolygonPoints[0].x, spazialePolygonPoints[0].y);
    for (let i = 1; i < spazialePolygonPoints.length; i++) {
      ctx.lineTo(spazialePolygonPoints[i].x, spazialePolygonPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = spazialePolygonColor;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = spazialePolygonColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function activateSpazialeArea(points, color) {
  const area = polygonArea(points);
  const manaDrain = Math.max(0.01, area / 10000 * 0.01);

  // Salva l'area per la persistenza
  permanentSpazialeAreas.push({ points: points.map(p => ({...p})), color, manaDrain, affinityTimer: 0 });

  // Effetto visivo area spaziale (opzionale, per feedback immediato)
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Particelle magiche lungo il bordo
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    for (let t = 0; t < 1; t += 0.1) {
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      activeMagicParticles.push({
        x, y,
        radius: Math.random() * 2 + 1,
        alpha: 0.5 + Math.random() * 0.3,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        color: color.replace("1)", "0.7)").replace(")", ",")
      });
    }
  }

}

function drawPermanentSpazialeAreas() {
  for (const area of permanentSpazialeAreas) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(area.points[0].x, area.points[0].y);
    for (let i = 1; i < area.points.length; i++) {
      ctx.lineTo(area.points[i].x, area.points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = area.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = area.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function pointInPolygon(point, vs) {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
  }
  return Math.abs(area / 2);
}

function getElementFromColor(color) {
  const colorMap = {
    '#ff5555': 'fuoco',
    '#5555ff': 'acqua',
    '#aaaaee': 'aria',
    '#55aa55': 'terra',
    '#ffff55': 'fulmine',
    '#ffffff': 'luce'
  };
  // Cerca una corrispondenza esatta
  if (colorMap[color]) return colorMap[color];
  // Oppure cerca una corrispondenza parziale (per rgba)
  for (const [hex, el] of Object.entries(colorMap)) {
    if (color.includes(hex.slice(1))) return el;
  }
  return null;
}

animate();