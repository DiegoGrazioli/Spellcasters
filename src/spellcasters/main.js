import DollarRecognizer from "./dollarRecognizer";
import { drawManaSegments, setManaValues, getManaValues, setCurrentMana, getCurrentMana, getManaMax, getManaRecoverSpeed } from "./manabar.js";
import { setTheme } from "./theme.js";
import { drawElementPattern, drawProjectilePolygonPattern } from "./element-patterns.js";
import { loadPlayerFromDB, savePlayerData, getPlayerData } from "./player-db.js";
import { CollisionSystem, VirtualMouseEntity, globalCollisionSystem } from "./collision-system.js";
import { Spark } from "./sparks.js";
import { PvPManager } from "./pvp-manager.js";
import { triggerCameraShake, applyCameraShake, updateRedOverlay, drawRedOverlay } from './damage-effects.js';
import { statusEffectManager, applyElementalHit, updateStatusEffects } from "./status-effects.js";

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
// let magicCircleToDelete = false;

let isActivatingMagicCircle = false;
let magicCircleDragStart = null;
let magicCircleDragEnd = null;

let particleCount = Number(localStorage.getItem('particleCount')) || 60;

let isDrawingSpaziale = false;
let spazialePolygonPoints = [];
let spazialePolygonColor = "#00e0ff";

let permanentSpazialeAreas = [];

let affinityToAdd = {};
let proiezioniToAdd = {};
let lastAffinitySave = Date.now();
let lastProiezioniSave = Date.now();

let spazialExpToAdd = 0;
let proiettileExpToAdd = 0;
let lastSpazialExpSave = Date.now();
let lastProiettileExpSave = Date.now();

let virtualMouse = { x: canvas.width / 2, y: canvas.height / 2 };
let virtualMouseSpeed = 16; // pixel per frame

let mouseTarget = { x: virtualMouse.x, y: virtualMouse.y };

let virtualMouseEntity = new VirtualMouseEntity(canvas.width / 2, canvas.height / 2);
globalCollisionSystem.registerEntity(virtualMouseEntity);

let collisionSparks = []; // Array globale per le scintille

let pvpManager = null;
let gameMode = 'training'; // 'training', 'pvp'
let isInPvPMatch = false;

let playerLife = 100;

function initializeGameMode() {
    const params = new URLSearchParams(window.location.search);
    gameMode = params.get('mode') || 'training';
    
    if (gameMode === 'pvp') {
        // Verifica se ci sono dati di match
        const matchData = localStorage.getItem('currentMatchData');
        if (matchData) {
            isInPvPMatch = true;
            pvpManager = new PvPManager(canvas, ctx);
            console.log('🎮 Modalità PvP inizializzata');
        } else {
            console.error('❌ Dati match non trovati, tornando al training');
            gameMode = 'training';
            window.location.href = 'game.html?mode=training';
        }
    }
}

// === EVENTI CANVAS ===
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    simulateRightClick();
    return;
  }

  if (e.button !== 0 || !magicCircle) return;
  const dx = virtualMouse.x - magicCircle.x;
  const dy = virtualMouse.y - magicCircle.y;
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
      magicCircleDragEnd = { x: virtualMouse.x, y: virtualMouse.y };
    }
  }
});

canvas.addEventListener("click", () => {
  canvas.requestPointerLock();
  canvas.focus();
});

canvas.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas) {
    let movementX = e.movementX;
    let movementY = e.movementY;

    // 🌪️ INVERSIONE CONTROLLI - Se i controlli sono invertiti, inverti dx e dy
    if (pvpManager && pvpManager.playerControlInverted) {
      movementX = -movementX;
      movementY = -movementY;
    }

    mouseTarget.x += movementX;
    mouseTarget.y += movementY;

    // Limita ai bordi del canvas se vuoi
    mouseTarget.x = Math.max(0, Math.min(canvas.width, mouseTarget.x));
    mouseTarget.y = Math.max(0, Math.min(canvas.height, mouseTarget.y));
  }
  if (isDrawingSpaziale) {
    spazialePolygonPoints.push({ x: virtualMouse.x, y: virtualMouse.y });
    return;
  }
  if (isActivatingMagicCircle && magicCircle) {
    magicCircleDragEnd = { x: virtualMouse.x, y: virtualMouse.y };
  }
  if (casting) {
    const point = { x: virtualMouse.x, y: virtualMouse.y };
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
    if (magicCircle.projections.length <= 0) {
      // Esaurimento cariche durante creazione area spaziale - il cerchio scompare ma le aree persistono
      magicCircle = null;
      if (pvpManager && pvpManager.isActive()) {
          pvpManager.sendMagicCircleUpdate(null);
      }
      infusedElement = null;
      infusedProjection = null;
      showDebugMessage("Cerchio magico esaurito dopo creazione area - aree spaziali persistono");
    }
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

// === EVENTI TASTIERA ===
window.addEventListener("keydown", (e) => {
  if ((e.key === "z" || e.key === "Z") && !casting) {
    casting = true;
    points = [];
  }
  if (e.key === 'n' || e.key === 'N') setTheme('night');
  if (e.key === 'g' || e.key === 'G') setTheme('day');

  // 🧪 TEST STATUS EFFECTS
  if (e.key === '1') {
    console.log("🔥 Testando effetto FUOCO");
    if (typeof applyElementalHit !== 'undefined') {
      applyElementalHit('fuoco', 'player');
    }
  }
  if (e.key === '2') {
    console.log("💧 Testando effetto ACQUA (rallentamento)");
    if (typeof applyElementalHit !== 'undefined') {
      applyElementalHit('acqua', 'player');
    }
  }
  if (e.key === '3') {
    console.log("💨 Testando effetto ARIA (inversione controlli)");
    if (typeof applyElementalHit !== 'undefined') {
      applyElementalHit('aria', 'player');
    }
  }
  if (e.key === '4') {
    console.log("🗿 Testando effetto TERRA (stun)");
    if (typeof applyElementalHit !== 'undefined') {
      applyElementalHit('terra', 'player');
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "z" || e.key === "Z") {
    casting = false;
    recognizeSpell(points);
    points = [];
  }

  if (e.key === 'x' || e.key === 'X') {
    // Simula un clic destro alle coordinate del mouse virtuale
    simulateRightClick();
  }
});

function simulateRightClick() {
  const mx = virtualMouse.x;
  const my = virtualMouse.y;

  // Cancella area spaziale se il click è dentro una di esse
  for (let i = permanentSpazialeAreas.length - 1; i >= 0; i--) {
    if (pointInPolygon({x: mx, y: my}, permanentSpazialeAreas[i].points)) {
      const removedArea = permanentSpazialeAreas[i];
      permanentSpazialeAreas.splice(i, 1);

      if (pvpManager && pvpManager.isActive()) {
        const centerX = removedArea.points.reduce((sum, p) => sum + p.x, 0) / removedArea.points.length;
        const centerY = removedArea.points.reduce((sum, p) => sum + p.y, 0) / removedArea.points.length;
        
        pvpManager.sendSpellRemoval({
          type: 'spaziale',
          position: { x: centerX, y: centerY },
          polygonPoints: removedArea.points,
          areaId: removedArea.id // Invia l'ID dell'area rimossa
        });
      }

      showDebugMessage("Area spaziale rimossa!");
      return;
    }
  }

  // Cancella cerchio magico se fuori dalle aree
  if (!magicCircle) return;
  console.log("Cerchio magico rimovibile: il mouse virtuale è nell'area di cancellazione.");
  const dx = mx - magicCircle.x;
  const dy = my - magicCircle.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= magicCircle.radius - 120 && dist <= magicCircle.radius) {
    // NUOVA LOGICA: Cancellazione manuale - rimuove anche le aree spaziali
    if (pvpManager && pvpManager.isActive() && permanentSpazialeAreas.length > 0) {
      // Notifica la rimozione di tutte le aree spaziali
      for (const area of permanentSpazialeAreas) {
        const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
        const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        
        pvpManager.sendSpellRemoval({
          type: 'spaziale',
          position: { x: centerX, y: centerY },
          polygonPoints: area.points,
          areaId: area.id
        });
      }
    }
    
    // Pulisci le aree spaziali quando si cancella manualmente il cerchio magico
    permanentSpazialeAreas = [];
    
    magicCircle = null;
    if (pvpManager && pvpManager.isActive()) {
        pvpManager.sendMagicCircleUpdate(null);
    }
    showDebugMessage("Cerchio magico cancellato manualmente");
  }
}

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
  const mousePos = { x: virtualMouse.x, y: virtualMouse.y };
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
  
  // Effetto particelle di lancio
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
  
  const projectile = {
    x: start.x,
    y: start.y,
    vx,
    vy,
    life: maxLife,
    alpha: 1,
    color,
    tipo: tipoProiezione,
    owner: gameMode === 'pvp' ? 'local' : 'training', // Identifica il proprietario
    element: infusedElement // Aggiungi elemento per calcolo danno
  };
  
  projectiles.push(projectile);
  
  // Invia al server PvP se in modalità PvP
  if (pvpManager && pvpManager.isActive()) {
    pvpManager.sendProjectileLaunch({
      start,
      end,
      color: colorOverride,
      tipo: tipoProiezione,
      element: infusedElement
    });
  }
  
  incrementaProiezioneUsataBuffer("proiettile");
  proiettileExpToAdd += 2;
  console.log("🎯 Esperienza proiettile aggiunta:", 2);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.hit) {
      projectiles.splice(i, 1);
      continue;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    p.alpha *= 0.97;
    
    // Genera particelle di scia
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
    
    // Verifica collisioni PvP
    if (pvpManager && pvpManager.isActive()) {
      pvpManager.checkProjectileCollisions([p]);
    }
    
    // Rimuovi proiettili scaduti o fuori schermo
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
      // Esaurimento cariche - il cerchio scompare ma le aree spaziali persistono
      magicCircle = null;
      if (pvpManager && pvpManager.isActive()) {
          pvpManager.sendMagicCircleUpdate(null);
      }
      infusedElement = null;
      infusedProjection = null;
      showDebugMessage("Cerchio magico esaurito - aree spaziali persistono");
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
      // Esaurimento cariche - il cerchio scompare ma le aree spaziali persistono
      magicCircle = null;
      if (pvpManager && pvpManager.isActive()) {
          pvpManager.sendMagicCircleUpdate(null);
      }
      infusedElement = null;
      infusedProjection = null;
      showDebugMessage("Cerchio magico esaurito - aree spaziali persistono");
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
  // expToAdd += amount;
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
  applyCameraShake(ctx);
  updateVirtualMouse();
  globalCollisionSystem.update();
  updateCollisionSparks();
  drawVirtualMouse();

  if (gameMode === 'training' && typeof window.drawTrainingEnemies === 'function') {
      window.drawTrainingEnemies(ctx);
  }

  if (casting) drawPath();
  updateParticles();
  drawParticles();
  drawFireParticles();
  drawMagicParticles();

  if (pvpManager && pvpManager.isActive()) {
    // Sincronizza tutto lo stato di gioco con il PvP manager
    pvpManager.syncWithMainGame({
      virtualMouse: virtualMouse,
      projectiles: projectiles,
      magicCircle: magicCircle,
      activeMagicParticles: activeMagicParticles,
      casting: casting,
      castingPoints: points
    });
    
    // Renderizza elementi PvP
    pvpManager.renderPvPElements(ctx);
  }

  window.createCollisionSparks = function(x, y, entity1, entity2, collision, impactForce) {
    createCollisionSparks(x, y, entity1, entity2, collision, impactForce);
  };

  drawCollisionSparks(ctx);

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
      const affinityGain = 0.5 * (areaValue / 700) * 0.01;
      incrementaProiezioneUsataBuffer("spaziale", affinityGain);

      const element = getElementFromColor(area.color);
      if (element) incrementaAffinitaBuffer(element, area.manaDrain);
      if (!element) incrementaAffinitaBuffer("spaziale", area.manaDrain);
    }
  }

  if (manaToDrain > 0) {
    let currentMana = getCurrentMana();
    if (currentMana <= manaToDrain) {
      // AGGIUNGI: Notifica PvP prima di pulire le aree
      if (pvpManager && pvpManager.isActive() && permanentSpazialeAreas.length > 0) {
        // Notifica la rimozione di tutte le aree spaziali
        for (const area of permanentSpazialeAreas) {
          const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
          const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
          
          pvpManager.sendSpellRemoval({
            type: 'spaziale',
            position: { x: centerX, y: centerY },
            polygonPoints: area.points,
            areaId: area.id // AGGIUNGI QUESTO
          });
        }
      }
      
      permanentSpazialeAreas = [];
      showDebugMessage("Mana esaurito! Tutte le aree spaziali sono svanite.");
      triggerBurnout();
    } else {
      setCurrentMana(currentMana - manaToDrain);
    }
    spazialExpToAdd += manaToDrain;
    console.log("🔮 Esperienza spaziale aggiunta:", manaToDrain);
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
   // Salvataggio esperienza spaziale
  if (now - lastSpazialExpSave > 1000 && spazialExpToAdd > 0) {

    const expToSave = spazialExpToAdd; // Salva il valore
    spazialExpToAdd = 0; // Azzera IMMEDIATAMENTE
    lastSpazialExpSave = now; // Aggiorna il timer IMMEDIATAMENTE

    (async () => {
      console.log("🔮 Salvando esperienza spaziale:", spazialExpToAdd);
      await addPlayerExp(expToSave);
      spazialExpToAdd = 0;
      lastSpazialExpSave = now;
    })();
  }
  
  // Salvataggio esperienza proiettile
  if (now - lastProiettileExpSave > 1000 && proiettileExpToAdd > 0) {

    const expToSave = proiettileExpToAdd; // Salva il valore
    proiettileExpToAdd = 0; // Azzera IMMEDIATAMENTE
    lastProiettileExpSave = now; // Aggiorna il timer IMMEDIATAMENTE

    (async () => {
      console.log("🎯 Salvando esperienza proiettile:", proiettileExpToAdd);
      await addPlayerExp(expToSave);
      proiettileExpToAdd = 0;
      lastProiettileExpSave = now;
    })();
  }

  regenMana();
  let health = 100;
  if (pvpManager && pvpManager.isActive()) {
    health = pvpManager.gameHooks.playerHealth;
  } else {
    health = typeof playerLife !== "undefined" ? playerLife : 100;
  }
  updateRedOverlay(health, 100);
  drawRedOverlay(ctx, canvas);
  requestAnimationFrame(animate);
  circleRotation += 0.003;
  drawManaSegments();
  drawMagicCircleDragTrail();
  // drawTemplate('terra', ctx);

  // if (magicCircleToDelete) {
  //   // AGGIUNGI: Notifica PvP prima di pulire le aree quando si cancella il cerchio magico
  //   if (pvpManager && pvpManager.isActive() && permanentSpazialeAreas.length > 0) {
  //     // Notifica la rimozione di tutte le aree spaziali
  //     for (const area of permanentSpazialeAreas) {
  //       const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
  //       const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        
  //       pvpManager.sendSpellRemoval({
  //         type: 'spaziale',
  //         position: { x: centerX, y: centerY },
  //         polygonPoints: area.points,
  //         areaId: area.id // AGGIUNGI QUESTO
  //       });
  //     }
  //   }
    
  //   // Pulisci anche le aree spaziali quando si cancella il cerchio magico
  //   permanentSpazialeAreas = [];
    
  //   magicCircle = null;
  //   infusedElement = null;
  //   infusedProjection = null;
  //   magicCircleToDelete = false;
  // }
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

  const areaId = `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  permanentSpazialeAreas.push({ 
    id: areaId, // AGGIUNGI QUESTO
    points: points.map(p => ({...p})), 
    color, 
    manaDrain, 
    affinityTimer: 0 
  });

  const expForArea = Math.floor(area / 1000); // Esperienza basata sulla dimensione dell'area
  spazialExpToAdd += expForArea;
  console.log("🔮 Esperienza spaziale per creazione area:", expForArea);

  if (pvpManager && pvpManager.isActive()) {
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    
    console.log('[DEBUG] Invio magia spaziale al server:', {
      type: 'spaziale',
      position: { x: centerX, y: centerY },
      polygonPoints: points,
      element: 'spaziale',
      areaId: areaId // Includi l'ID dell'area
    });

    pvpManager.sendSpellCast({
      type: 'spaziale',
      position: { x: centerX, y: centerY },
      polygonPoints: points,
      element: 'spaziale',
      areaId: areaId // Includi l'ID dell'area
    });
  }

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
  incrementaAffinitaBuffer("spaziale");
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

function updateVirtualMouse() {
  // 🚫 CONTROLLO STUN - Se il giocatore è stunnato, non può muoversi
  if (pvpManager && pvpManager.playerStunned) {
    // Durante lo stun, il mouse virtuale non si muove verso il target
    return;
  }

  // Calcola la distanza tra mouse reale (mouseTarget) e virtuale
  let dx = mouseTarget.x - virtualMouse.x;
  let dy = mouseTarget.y - virtualMouse.y;

  const dist = Math.hypot(dx, dy);

  // Fattore di velocità: più è grande la distanza, più il virtuale si muove velocemente
  let maxSpeed = 40; // ⭐ CAMBIA DA const A let

  // 💧 RALLENTAMENTO - Applica modificatore di velocità
  if (pvpManager && pvpManager.playerMovementModifier) {
    maxSpeed *= pvpManager.playerMovementModifier.speedMultiplier;
  }

  const speed = Math.min(dist * 0.25, maxSpeed);

  if (dist > 0.5) { // evita jitter quando è molto vicino
    virtualMouse.x += (dx / dist) * speed;
    virtualMouse.y += (dy / dist) * speed;
  } else {
    virtualMouse.x = mouseTarget.x;
    virtualMouse.y = mouseTarget.y;
  }

  // Limita ai bordi del canvas
  virtualMouse.x = Math.max(0, Math.min(canvas.width, virtualMouse.x));
  virtualMouse.y = Math.max(0, Math.min(canvas.height, virtualMouse.y));

  // Sincronizza l'entità di collisione con il mouse virtuale
  virtualMouseEntity.x = virtualMouse.x;
  virtualMouseEntity.y = virtualMouse.y;

  // Calcola la velocità per le collisioni basata sul movimento
  const velocityX = (dx / dist) * speed;
  const velocityY = (dy / dist) * speed;
  if (!isNaN(velocityX) && !isNaN(velocityY)) {
    virtualMouseEntity.velocity.x = velocityX;
    virtualMouseEntity.velocity.y = velocityY;
  }
}

function drawVirtualMouse() {
  ctx.save();
  ctx.beginPath();
  ctx.arc(virtualMouse.x, virtualMouse.y, 12, 0, 2 * Math.PI);
  ctx.strokeStyle = "#00e0ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(virtualMouse.x - 6, virtualMouse.y);
  ctx.lineTo(virtualMouse.x + 6, virtualMouse.y);
  ctx.moveTo(virtualMouse.x, virtualMouse.y - 6);
  ctx.lineTo(virtualMouse.x, virtualMouse.y + 6);
  ctx.stroke();
  ctx.restore();
}

// Funzione per creare scintille da una collisione
function createCollisionSparks(x, y, entity1, entity2, collision, impactForce) {
  // Calcola l'intensità dell'impatto
  const velocity1 = Math.hypot(entity1.velocity?.x || 0, entity1.velocity?.y || 0);
  const velocity2 = Math.hypot(entity2.velocity?.x || 0, entity2.velocity?.y || 0);
  const totalImpact = velocity1 + velocity2;
  
  // Determina il numero di scintille basato sull'impatto
  const minSparks = 1;
  const maxSparks = 3;
  const sparkCount = Math.floor(minSparks + (totalImpact / 10) * (maxSparks - minSparks));
  
  // Calcola la direzione di movimento delle scintille
  // Le scintille "rimbalzano" via dalla normale di collisione
  const normalX = collision.normal?.x || 0;
  const normalY = collision.normal?.y || 0;
  
  // Calcola velocità e lunghezza basate sull'impatto
  const baseSpeed = Math.min(2 + totalImpact * 0.3, 8); // Velocità tra 2 e 8
  const baseLength = Math.min(0.5 + totalImpact * 0.1, 2.5); // Lunghezza tra 0.5 e 2.5
  
  for (let i = 0; i < sparkCount; i++) {
    // Calcola angolo di dispersione attorno alla normale
    const spreadAngle = Math.PI * 0.6; // 108 gradi di dispersione
    const angle = Math.atan2(normalY, normalX) + (Math.random() - 0.5) * spreadAngle;
    
    // Calcola velocità con variazione casuale
    const speedVariation = 0.7 + Math.random() * 0.6; // Variazione 70%-130%
    const speed = baseSpeed * speedVariation;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    // Calcola lunghezza con variazione più piccola
    const lengthVariation = 0.8 + Math.random() * 0.4; // Variazione 80%-120%
    const length = baseLength * lengthVariation;
    
    // Crea la scintilla
    const spark = new Spark(x, y, vx, vy, length);
    collisionSparks.push(spark);
  }
  
  console.log(`Created ${sparkCount} sparks for collision with impact: ${totalImpact.toFixed(2)}`);
}

// Funzione per aggiornare tutte le scintille
function updateCollisionSparks() {
  for (let i = collisionSparks.length - 1; i >= 0; i--) {
    const spark = collisionSparks[i];
    if (!spark.update()) {
      collisionSparks.splice(i, 1); // Rimuovi scintilla morta
    }
  }
}

// Funzione per disegnare tutte le scintille
function drawCollisionSparks(ctx) {
  for (const spark of collisionSparks) {
    spark.draw(ctx);
  }
}

initializeGameMode();
updateStatusEffects(1 / 60);
animate();