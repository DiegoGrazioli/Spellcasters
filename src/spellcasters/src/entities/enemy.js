const enemySprites = {
  body: new Image(),
  eye: new Image(),
  limb: new Image()
};
enemySprites.body.src = './src/img/square.png';
enemySprites.eye.src = './src/img/square.png';
enemySprites.limb.src = './src/img/square.png';

export class Enemy {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.state = 'idle';
    this.stateTimer = 0;
    
    // Configurazione del peso basata sul tipo
    this.setupWeightProperties(type);
    
    this.parts = {
      body: { img: enemySprites.body, x: 0, y: 0, rotation: 0, hitbox: { x: 0, y: 0, w: 500, h: 500 } },
      eye: { img: enemySprites.eye, x: 0, y: -800, rotation: 0, hitbox: { x: 0, y: -700, w: 300, h: 300 } },
      armL: { img: enemySprites.limb, x: -800, y: -100, rotation: 0, hitbox: { x: -800, y: -100, w: 500, h: 200 } },
      armR: { img: enemySprites.limb, x: 800, y: -100, rotation: 0, hitbox: { x: 800, y: -100, w: 500, h: 200 } },
      leg: { img: enemySprites.limb, x: -20, y: 500, rotation: 0, hitbox: { x: -20, y: 800, w: 200, h: 500 } }
    };
  }

  setupWeightProperties(type) {
    // Velocità per le collisioni
    this.velocity = { x: 0, y: 0 };
    this.type = 'enemy';
    
    // Configurazioni predefinite basate sul tipo
    const weightConfigs = {
      'dummy': {
        mass: Infinity,           // Massa infinita
        resistance: Infinity,     // Resistenza infinita
        isImmovable: true,        // Completamente inamovibile
        isStatic: false,          // Non è statico (può avere animazioni)
        description: 'Manichino da allenamento - Inamovibile'
      },
      'light': {
        mass: 1,
        resistance: 0.5,
        isImmovable: false,
        isStatic: false,
        description: 'Nemico leggero - Facile da spostare'
      },
      'normal': {
        mass: 3,
        resistance: 1.5,
        isImmovable: false,
        isStatic: false,
        description: 'Nemico normale - Moderatamente pesante'
      },
      'heavy': {
        mass: 8,
        resistance: 2.5,
        isImmovable: false,
        isStatic: false,
        description: 'Nemico pesante - Difficile da spostare'
      },
      'boss': {
        mass: 15,
        resistance: 4,
        isImmovable: false,
        isStatic: false,
        description: 'Boss - Molto difficile da spostare'
      },
      'immovable_boss': {
        mass: Infinity,
        resistance: Infinity,
        isImmovable: true,
        isStatic: false,
        description: 'Boss inamovibile - Impossibile da spostare'
      }
    };

    const config = weightConfigs[type] || weightConfigs['normal'];
    
    // Applica la configurazione
    this.mass = config.mass;
    this.resistance = config.resistance;
    this.isImmovable = config.isImmovable;
    this.isStatic = config.isStatic;
    this.weightType = type;
    this.weightDescription = config.description;
    
    // Proprietà fisiche aggiuntive
    this.restitution = 0.4; // Fattore di rimbalzo
    this.friction = 0.85;   // Attrito
    
    console.log(`Enemy created: ${this.weightDescription}`);
  }

  // Metodo per cambiare il tipo di peso dinamicamente
  setWeightType(newType) {
    this.setupWeightProperties(newType);
    console.log(`Enemy weight changed to: ${this.weightDescription}`);
  }

  // Callback per le collisioni
  onCollision(otherEntity, collision, forceInfo) {
    console.log(`Enemy hit by ${otherEntity.type}!`);
    
    if (this.isImmovable) {
      console.log(`${otherEntity.type} tried to move immovable enemy!`);
    } else if (forceInfo && forceInfo.canMove) {
      console.log(`Enemy was moved by force: ${forceInfo.impactForce.toFixed(2)}`);
      this.setState('get_hit');
    } else {
      console.log(`${otherEntity.type} wasn't strong enough to move this enemy`);
    }
  }

  // Callback per la resistenza
  onResistance(message) {
    console.log(`Enemy resisted: ${message}`);
    // Qui potresti aggiungere effetti visivi come scintille o tremolii
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
      const globalScale = 0.1; // lo stesso valore usato in draw()

      for (let partName in this.parts) {
          const part = this.parts[partName];
          // Calcola posizione globale tenendo conto della scala
          const px = this.x + (part.x * globalScale);
          const py = this.y + (part.y * globalScale);

          // Trasforma il punto in coordinate locali, includendo la scala
          const localX = (x - px) / globalScale;
          const localY = (y - py) / globalScale;

          if (
              localX >= -part.hitbox.w / 2 &&
              localX <= part.hitbox.w / 2 &&
              localY >= -part.hitbox.h / 2 &&
              localY <= part.hitbox.h / 2
          ) {
              hit = true;
              // Qui puoi aggiungere effetti visivi (scintille) o logica extra
          }
      }
      return hit;
  }
}