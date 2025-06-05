// === MANA BAR MODULE ===

let mana = 50;
let manaMax = 100;
let manaRecoverSpeed = 0.04;
let inBurnout = false;
let burnoutTimer = 0;

const manaSegmentsCanvas = document.createElement('canvas');
manaSegmentsCanvas.id = 'mana-segments';
manaSegmentsCanvas.style.position = 'fixed';
manaSegmentsCanvas.style.top = '0';
manaSegmentsCanvas.style.left = '0';
manaSegmentsCanvas.style.width = '100vw';
manaSegmentsCanvas.style.height = '100vh';
manaSegmentsCanvas.style.pointerEvents = 'none';
manaSegmentsCanvas.style.zIndex = '200';
document.body.appendChild(manaSegmentsCanvas);

function resizeManaSegmentsCanvas() {
  manaSegmentsCanvas.width = window.innerWidth;
  manaSegmentsCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeManaSegmentsCanvas);
resizeManaSegmentsCanvas();

function drawManaSegments() {
  const ctx = manaSegmentsCanvas.getContext('2d');
  ctx.clearRect(0, 0, manaSegmentsCanvas.width, manaSegmentsCanvas.height);
  const w = manaSegmentsCanvas.width;
  const h = manaSegmentsCanvas.height;
  const thickness = 10;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--mana-bar-color') || '#00eaff';
  const percent = Math.max(0, Math.min(1, mana / manaMax));

  // 1. Segmento basso (0-25%)
  let p = Math.min(percent, 0.25) / 0.25; // 0-1
  if (p > 0) {
    // Sinistra
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w/2, h);
    ctx.lineTo(w/2 - (w/2)*p, h);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    // Destra
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w/2, h);
    ctx.lineTo(w/2 + (w/2)*p, h);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Segmento laterale (25-75%)
  let p2 = Math.max(0, Math.min(percent, 0.75) - 0.25) / 0.5; // 0-1
  if (p2 > 0) {
    // Sinistra
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - h*p2);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    // Destra
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h - h*p2);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  // 3. Segmento alto (75-100%)
  let p3 = Math.max(0, percent - 0.75) / 0.25; // 0-1
  if (p3 > 0) {
    // Sinistra: dagli estremi verso il centro
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo((w/2)*p3, 0);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    // Destra: dagli estremi verso il centro
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - (w/2)*p3, 0);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }
}

function setManaValues({max, current, regen, burnout, burnoutT}) {
  if (typeof max === 'number') manaMax = max;
  if (typeof current === 'number') mana = current;
  if (typeof regen === 'number') manaRecoverSpeed = regen;
  if (typeof burnout === 'boolean') inBurnout = burnout;
  if (typeof burnoutT === 'number') burnoutTimer = burnoutT;
}

function getManaValues() {
  return { mana, manaMax, manaRecoverSpeed, inBurnout, burnoutTimer };
}

function setCurrentMana(val) {
  mana = val;
}

function getCurrentMana() {
  return mana;
}

function getManaMax() {
  return manaMax;
}

function getManaRecoverSpeed() {
  return manaRecoverSpeed;
}

export { drawManaSegments, setManaValues, getManaValues, setCurrentMana, getCurrentMana, getManaMax, getManaRecoverSpeed };
