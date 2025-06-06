// === MANA BAR MODULE ===

let mana = 5;
let manaMax = 10;
let manaRecoverSpeed = 0.001;
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
  
  let percent, color;
    if (inBurnout) {
    // Durante il burnout: barra rossa che mostra il progresso del timer
    // Il burnoutTimer parte da 300 (5 secondi a 60fps) e scende a 0
    const maxBurnoutTime = 300; // 5 secondi a 60fps, come definito in triggerBurnout()
    percent = Math.max(0, Math.min(1, burnoutTimer / maxBurnoutTime));
    color = '#ff0000'; // Rosso fisso durante burnout
  } else {
    // Modalità normale: mostra il livello di mana con colori dinamici
    percent = Math.max(0, Math.min(1, mana / manaMax));
    color = getComputedStyle(document.documentElement).getPropertyValue('--mana-bar-color') || '#00eaff';
    
    // Se sotto il 25%, interpolazione graduale verso rosso
    if (percent < 0.25) {
      const redFactor = 1 - (percent / 0.25); // 0 al 25%, 1 allo 0%
      const r = Math.floor(255 * redFactor + 0 * (1 - redFactor));
      const g = Math.floor(0 * redFactor + 234 * (1 - redFactor));
      const b = Math.floor(0 * redFactor + 255 * (1 - redFactor));
      color = `rgb(${r}, ${g}, ${b})`;
    }

    // Lampeggio al 15% e sotto
    if (percent <= 0.15) {
      const flashSpeed = 2; // velocità lampeggio
      const flash = Math.sin(Date.now() * 0.01 * flashSpeed) > 0;
      if (!flash) {
        color = '#ff0000'; // rosso pieno durante il flash
      }
    }
  }

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
