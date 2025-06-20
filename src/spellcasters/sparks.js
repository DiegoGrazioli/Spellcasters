// sparks.js
export class Spark {
  constructor(x, y, vx, vy, length, color = "white") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.length = length;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.color = color;
    this.friction = 0.96;
    this.gravity = 0.1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.friction;
    this.vy = this.vy * this.friction + this.gravity;
    this.life -= 0.02;
    return this.life > 0;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    
    ctx.save();
    const alpha = this.life / this.maxLife;
    const endX = this.x - this.vx * this.length;
    const endY = this.y - this.vy * this.length;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.3})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.restore();
  }
}