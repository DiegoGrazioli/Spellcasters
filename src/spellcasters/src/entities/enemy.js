const enemySprites = {
  body: new Image(),
  eye: new Image(),
  limb: new Image()
};
enemySprites.body.src = './src/img/square.png';
enemySprites.eye.src = './src/img/square.png';
enemySprites.limb.src = './src/img/square.png';

export class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.state = 'idle';
    this.stateTimer = 0;
    this.parts = {
      body: { img: enemySprites.body, x: 0, y: 0, rotation: 0, hitbox: { x: 0, y: 0, w: 500, h: 500 } },
      eye: { img: enemySprites.eye, x: 0, y: -800, rotation: 0, hitbox: { x: 0, y: -700, w: 300, h: 300 } },
      armL: { img: enemySprites.limb, x: -800, y: -100, rotation: 0, hitbox: { x: -800, y: -100, w: 500, h: 200 } },
      armR: { img: enemySprites.limb, x: 800, y: -100, rotation: 0, hitbox: { x: 800, y: -100, w: 500, h: 200 } },
      leg: { img: enemySprites.limb, x: -20, y: 500, rotation: 0, hitbox: { x: -20, y: 800, w: 200, h: 500 } }
    };
  }

  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  update(dt) {
    this.stateTimer += dt;
    if (this.state === 'idle') {
      this.parts.body.rotation = Math.sin(this.stateTimer * 2) * 0.1;
      this.parts.eye.y = -600 + -Math.sin(this.stateTimer * 2) * 20;
      this.parts.armL.rotation = Math.sin(this.stateTimer * 2) * 0.2;
      this.parts.armR.rotation = -Math.sin(this.stateTimer * 2) * 0.2;
      this.parts.leg.y = 800 + Math.sin(this.stateTimer * 2) * 20;
    } else if (this.state === 'get_hit') {
      this.parts.body.rotation = Math.sin(this.stateTimer * 10) * 0.5;
      if (this.stateTimer > 0.3) this.setState('idle');
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const scale = 0.1;
    ctx.scale(scale, scale);
    for (let partName in this.parts) {
        let part = this.parts[partName];
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);
        if (partName === "eye") {
        // Occhio disegnato via canvas, posizione y più alta
        ctx.beginPath();
        ctx.arc(0, -50, 50, 0, 2 * Math.PI); // -50 per alzare l'occhio
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -50, 20, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.scale(0.5, 0.5); // Scala l'occhio
        ctx.drawImage(part.img, -part.img.width / 2, -part.img.height / 2);
        } else if (partName === "leg") {
            ctx.scale(0.35, 1); // Scala la gamba
            ctx.drawImage(part.img, -part.img.width / 2, -part.img.height / 2);
        } else if (partName === "armL" || partName === "armR") {
            ctx.scale(1, 0.35); // Scala le braccia
            ctx.drawImage(part.img, -part.img.width / 2, -part.img.height / 2);
        } else {
            ctx.drawImage(part.img, -part.img.width / 2, -part.img.height / 2);
        }
        ctx.restore();
        // Debug: disegna la hitbox quadrata
        // ctx.save();
        // ctx.strokeStyle = "rgba(255,0,0,0.7)";
        // ctx.lineWidth = 200;
        // ctx.translate(part.hitbox.x, part.hitbox.y);
        // ctx.strokeRect(
        // -part.hitbox.w/2,
        // -part.hitbox.h/2,
        // part.hitbox.w,
        // part.hitbox.h
        // );
        // ctx.restore();
    }
    ctx.restore();
    }

    checkHit(x, y, damage = 1) {
        let hit = false;
        for (let partName in this.parts) {
            const part = this.parts[partName];
            // Calcola posizione globale della parte
            const px = this.x + part.x;
            const py = this.y + part.y;
            // Trasforma il punto nel sistema locale della parte
            const localX = x - px;
            const localY = y - py;
            // Controlla se il punto è dentro il rettangolo
            if (
            localX >= -part.hitbox.w / 2 &&
            localX <= part.hitbox.w / 2 &&
            localY >= -part.hitbox.h / 2 &&
            localY <= part.hitbox.h / 2
            ) {
            hit = true;
            // Effetti visivi o logica extra qui
            }
        }
        return hit;
    }
}