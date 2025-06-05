// element-patterns.js
// Funzione per disegnare i pattern elementali su un canvas
export function drawElementPattern(ctx, x, y, r, element) {
  ctx.save();
  ctx.translate(x, y);
  if (element === 'fuoco') {
    for (let i = 0; i < 16; i++) {
      let angle = (Math.PI * 2 / 16) * i;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.lineTo(r * 0.7, Math.sin(Math.PI/8) * r * 0.2);
      ctx.lineTo(r * 0.9, 0);
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    // Cerchio piccolo centrale
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, 2 * Math.PI);
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
    // Cerchio medio (tra quello piccolo e quello a 0.9)
    let rMedio = (r * 0.22 + r * 0.9) / 2;
    ctx.beginPath();
    ctx.arc(0, 0, rMedio, 0, 2 * Math.PI);
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
    // Cerchio esterno che racchiude le fiamme
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, 2 * Math.PI);
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Secondo cerchio esterno, più ampio
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
    let grad = ctx.createRadialGradient(0,0,0,0,0,r);
    grad.addColorStop(0, '#fffbe0');
    grad.addColorStop(0.5, '#ff9900');
    grad.addColorStop(1, '#ff2222');
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(0,0,r*0.95,0,2*Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (element === 'aria') {
    // Cerchi concentrici
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.3 + i * 0.18), 0, 2 * Math.PI);
      ctx.strokeStyle = '#aaf';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Cerchio alle estremità interne delle linee radiali
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, 2 * Math.PI);
    ctx.strokeStyle = '#aaf';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Cerchio alle estremità esterne delle linee radiali
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.81, 0, 2 * Math.PI);
    ctx.strokeStyle = '#aaf';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Linee radiali
    for (let i = 0; i < 12; i++) {
      let angle = (Math.PI * 2 / 12) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3);
      ctx.lineTo(Math.cos(angle) * r * 0.84, Math.sin(angle) * r * 0.84);
      ctx.strokeStyle = '#aaf';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Curve a spirale
    ctx.save();
    ctx.rotate(Math.PI/12);
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      for (let t = 0; t < 60; t++) {
        let theta = t * 0.2 + s * Math.PI * 2 / 3;
        let rad = r * 0.3 + t * (r * 0.5 / 60) + Math.sin(theta*2) * 2;
        let px = Math.cos(theta) * rad;
        let py = Math.sin(theta) * rad;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#aaf';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    // Cerchio esterno aggiuntivo
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
    ctx.strokeStyle = '#aaf';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  if (element === 'acqua') {
    // Cerchi concentrici
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.25 + i * 0.15), 0, 2 * Math.PI);
      if (i === 1) {
        ctx.strokeStyle = 'rgba(0,180,255,1)';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = 'rgba(0,180,255,0.5)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Onde regolari
    for (let i = 1; i <= 3; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 6);
      ctx.beginPath();
      for (let t = 0; t <= 64; t++) {
        let theta = t * Math.PI * 2 / 64;
        let rad = r * (0.35 + i * 0.13) + Math.sin(theta * 6 + i) * 7;
        let px = Math.cos(theta) * rad;
        let py = Math.sin(theta) * rad;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,180,255,1)';  
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    // Piccoli glifi/gocce
    for (let i = 0; i < 10; i++) {
      let angle = (Math.PI * 2 / 10) * i + Math.PI/10;
      let rad = r * 0.7;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(rad, 0, 6, 3, angle, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,200,255,0.5)';
      ctx.fill();
      ctx.restore();
    }
    // Cerchio esterno aggiuntivo
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0,180,255,1)';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  if (element === 'terra') {
    // Cerchi concentrici
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.32 + i * 0.18), 0, 2 * Math.PI);
      if (i === 2) {
        ctx.strokeStyle = '#a86';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = '#a86';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Pentagono centrale
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      let angle = (Math.PI * 2 / 5) * i - Math.PI/2;
      let px = Math.cos(angle) * r * 0.38;
      let py = Math.sin(angle) * r * 0.38;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = '#a86';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // Pentacolo (stelletta)
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      let angle = (Math.PI * 2 / 5) * i - Math.PI/2;
      let px = Math.cos(angle) * r * 0.38;
      let py = Math.sin(angle) * r * 0.38;
      ctx.lineTo(px, py);
      let next = (i + 2) % 5;
      let angle2 = (Math.PI * 2 / 5) * next - Math.PI/2;
      let px2 = Math.cos(angle2) * r * 0.38;
      let py2 = Math.sin(angle2) * r * 0.38;
      ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.strokeStyle = '#a86';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // Linee radiali
    for (let i = 0; i < 10; i++) {
      let angle = (Math.PI * 2 / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85);
      ctx.strokeStyle = '#4a3';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Cerchio esterno aggiuntivo
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
    ctx.strokeStyle = '#a86';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  ctx.restore();
}

// Funzione di inizializzazione per la preview
export function drawAllElementPatterns() {
  [
    ['pat-fuoco', 'fuoco'],
    ['pat-aria', 'aria'],
    ['pat-acqua', 'acqua'],
    ['pat-terra', 'terra']
  ].forEach(([id, el]) => {
    const c = document.getElementById(id);
    const ctx = c.getContext('2d');
    drawElementPattern(ctx, c.width/2, c.height/2, 90, el);
  });
}
