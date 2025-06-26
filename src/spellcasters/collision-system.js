// collision-system.js - Sistema di collisioni semplificato e robusto

export class CollisionSystem {
  constructor() {
    this.entities = new Set();
  }

  registerEntity(entity) {
    this.entities.add(entity);
  }

  unregisterEntity(entity) {
    this.entities.delete(entity);
  }

  update() {
    const arr = Array.from(this.entities);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        if (a.isStatic && b.isStatic) continue;
        const collision = this.checkCollision(a, b);
        if (collision && collision.hit) {
          this.resolveCollision(a, b, collision);
        }
      }
    }
  }

  // --- COLLISIONI ---

  checkCollision(a, b) {
    // Cerchio vs Cerchio
    if (a.radius && b.radius) return this.circleVsCircle(a, b);
    // Cerchio vs Rettangolo
    if (a.radius && b.w && b.h) return this.circleVsRect(a, b);
    if (b.radius && a.w && a.h) {
      const res = this.circleVsRect(b, a);
      if (res.hit && res.normal) { res.normal.x *= -1; res.normal.y *= -1; }
      return res;
    }
    // Cerchio vs Entity con parts
    if (a.radius && b.parts) return this.circleVsParts(a, b);
    if (b.radius && a.parts) {
      const res = this.circleVsParts(b, a);
      if (res.hit && res.normal) { res.normal.x *= -1; res.normal.y *= -1; }
      return res;
    }
    // Rettangolo vs Rettangolo
    if (a.w && a.h && b.w && b.h) return this.rectVsRect(a, b);
    // Rettangolo vs Entity con parts
    if (a.w && a.h && b.parts) return this.rectVsParts(a, b);
    if (b.w && b.h && a.parts) {
      const res = this.rectVsParts(b, a);
      if (res.hit && res.normal) { res.normal.x *= -1; res.normal.y *= -1; }
      return res;
    }
    // Entity con parts vs Entity con parts
    if (a.parts && b.parts) return this.partsVsParts(a, b);
    // fallback: nessuna collisione
    return { hit: false };
  }

  circleVsCircle(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const rSum = a.radius + b.radius;
    return {
      hit: dist < rSum,
      overlap: dist < rSum ? rSum - dist : 0,
      normal: dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 },
      contact: { x: a.x + dx * 0.5, y: a.y + dy * 0.5 }
    };
  }

  circleVsRect(circle, rect) {
    const cx = circle.x, cy = circle.y;
    const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX, dy = cy - closestY;
    const dist = Math.hypot(dx, dy);
    return {
      hit: dist < circle.radius,
      overlap: dist < circle.radius ? circle.radius - dist : 0,
      normal: dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 },
      contact: { x: closestX, y: closestY }
    };
  }

  rectVsRect(a, b) {
    const hit = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    if (!hit) return { hit: false };
    // Normale approssimata
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay;
    const dist = Math.hypot(dx, dy);
    return {
      hit: true,
      overlap: Math.min(a.w, b.w, a.h, b.h) * 0.1,
      normal: dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 },
      contact: { x: (ax + bx) / 2, y: (ay + by) / 2 }
    };
  }

  // --- PARTS SUPPORT ---

  circleVsParts(circle, entity) {
    let best = { hit: false, overlap: 0 };
    const scale = entity.scale || 0.1;
    for (const k in entity.parts) {
      const part = entity.parts[k];
      const px = entity.x + part.x * scale;
      const py = entity.y + part.y * scale;
      const w = part.hitbox.w * scale, h = part.hitbox.h * scale;
      const rect = { x: px - w / 2, y: py - h / 2, w, h };
      const col = this.circleVsRect(circle, rect);
      if (col.hit && col.overlap > best.overlap) best = { ...col, part: k };
    }
    return best;
  }

  rectVsParts(rect, entity) {
    let best = { hit: false, overlap: 0 };
    const scale = entity.scale || 0.1;
    for (const k in entity.parts) {
      const part = entity.parts[k];
      const px = entity.x + part.x * scale;
      const py = entity.y + part.y * scale;
      const w = part.hitbox.w * scale, h = part.hitbox.h * scale;
      const partRect = { x: px - w / 2, y: py - h / 2, w, h };
      const col = this.rectVsRect(rect, partRect);
      if (col.hit && col.overlap > best.overlap) best = { ...col, part: k };
    }
    return best;
  }

  partsVsParts(a, b) {
    let best = { hit: false, overlap: 0 };
    const sa = a.scale || 0.1, sb = b.scale || 0.1;
    for (const ka in a.parts) {
      const pa = a.parts[ka];
      const ax = a.x + pa.x * sa, ay = a.y + pa.y * sa;
      const aw = pa.hitbox.w * sa, ah = pa.hitbox.h * sa;
      const rectA = { x: ax - aw / 2, y: ay - ah / 2, w: aw, h: ah };
      for (const kb in b.parts) {
        const pb = b.parts[kb];
        const bx = b.x + pb.x * sb, by = b.y + pb.y * sb;
        const bw = pb.hitbox.w * sb, bh = pb.hitbox.h * sb;
        const rectB = { x: bx - bw / 2, y: by - bh / 2, w: bw, h: bh };
        const col = this.rectVsRect(rectA, rectB);
        if (col.hit && col.overlap > best.overlap) best = { ...col, partA: ka, partB: kb };
      }
    }
    return best;
  }

  // --- RISOLUZIONE COLLISIONI ---

  resolveCollision(a, b, collision) {
    // Effetto scintille usando l'istanza globale
    if (typeof window.createCollisionSparks === "function" && collision.contact) {
      window.createCollisionSparks(collision.contact.x, collision.contact.y, a, b, collision, 1);
    }
    // Callback
    if (a.onCollision) a.onCollision(b, collision, {});
    if (b.onCollision) b.onCollision(a, collision, {});
  }

  onCollision(otherEntity, collision, forceInfo) {
    
    if (forceInfo && !forceInfo.canMove) {
      const impact = (forceInfo.impactForce !== undefined) ? forceInfo.impactForce.toFixed(2) : 'n/a';
      const richiesta = ((otherEntity.mass || 1) * (otherEntity.resistance || 1)).toFixed(2);
    }
    
    if (otherEntity.setState && typeof otherEntity.setState === 'function') {
      otherEntity.setState('get_hit');
    }
}
}

// Classe helper per il mouse virtuale con fisica
export class VirtualMouseEntity {
  constructor(x, y, radius = 25) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.velocity = { x: 0, y: 0 };
    
    // Proprietà di peso e fisica
    this.mass = 0.5; // Massa leggera
    this.resistance = 0.8; // Resistenza bassa (facile da spostare)
    this.isImmovable = false; // Può essere mosso
    this.isStatic = false; // Non è statico
    this.maxForce = 15; // Forza massima che può applicare
    
    this.restitution = 0.3;
    this.friction = 0.9;
    this.type = 'virtualMouse';
    this.respectBounds = true;
  }

  onCollision(otherEntity, collision, forceInfo) {
    console.log(`Mouse collided with ${otherEntity.type || 'entity'}!`);
    
    if (forceInfo && !forceInfo.canMove) {
      const impact = (forceInfo.impactForce !== undefined) ? forceInfo.impactForce.toFixed(2) : 'n/a';
      const richiesta = ((otherEntity.mass || 1) * (otherEntity.resistance || 1)).toFixed(2);
      console.log(`Il mouse non riesce a spostare ${otherEntity.type} (forza: ${impact}, richiesta: ${richiesta})`);
    }
    
    if (otherEntity.setState && typeof otherEntity.setState === 'function') {
      otherEntity.setState('get_hit');
    }
  }

  // Callback per quando qualcosa resiste al nostro movimento
  onResistance(message) {
    console.log(`Mouse: ${message}`);
    // Qui potresti aggiungere feedback visivo, come far tremare il mouse
  }
}

// Istanza globale del sistema di collisioni
export const globalCollisionSystem = new CollisionSystem();