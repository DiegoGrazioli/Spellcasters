// dollarRecognizer.js
export default class DollarRecognizer {
  constructor() {
    this.templates = [];
    this.addDefaultTemplates();
  }

  // Aggiungi i template predefiniti per i tuoi elementi
  addDefaultTemplates() {
    // Template per Fuoco (Y)
    this.addGesture('fuoco', [
        {x: 100, y: 120},  // Inizio in alto
        {x: 110, y: 110},
        {x: 120, y: 120},
        {x: 100, y: 100},
    ]);

    this.addGesture('fuoco', [
        {x: 100, y: 100},  // Inizio in alto
        {x: 120, y: 120},
        {x: 110, y: 110},
        {x: 100, y: 120},
    ]);

    // Template per Acqua (goccia)
    this.addGesture('acqua', [
        {x: 50, y: 50}, 
        {x: 55, y: 70},
        {x: 50, y: 75},
        {x: 45, y: 70},
        {x: 50, y: 50}
    ]);

    this.addGesture('acqua', [
        {x: 50, y: 50}, 
        {x: 45, y: 70},
        {x: 50, y: 75},
        {x: 55, y: 70},
        {x: 50, y: 50}
    ]);

    // Template per Aria (spirale)
    this.addGesture('aria', [
        {x: 90, y: 95},
        {x: 110, y: 100},
        {x: 120, y: 110},
        {x: 120, y: 120},
        {x: 115, y: 125},
        {x: 110, y: 120},
        {x: 110, y: 110},
        {x: 120, y: 100},
        {x: 140, y: 95}
    ]);

    // inverti i punti per creare una spirale in senso antiorario
    this.addGesture('aria', [
        {x: 140, y: 95},
        {x: 120, y: 100},
        {x: 110, y: 110},
        {x: 110, y: 120},
        {x: 115, y: 125},
        {x: 120, y: 120},
        {x: 120, y: 110},
        {x: 110, y: 100},
        {x: 90, y: 95}
    ]);

    // rifletti orizzontalmente per creare una spirale in senso antiorario
    this.addGesture('aria', [
        {x: 110, y: 125},
        {x: 90, y: 120},
        {x: 80, y: 110},
        {x: 80, y: 100},
        {x: 85, y: 95},
        {x: 90, y: 100},
        {x: 90, y: 110},
        {x: 80, y: 120},
        {x: 60, y: 125}
    ]);

    // rifletti orizzontalmente per creare una spirale in senso antiorario
    this.addGesture('aria', [
        {x: 60, y: 125},
        {x: 80, y: 120},
        {x: 90, y: 110},
        {x: 90, y: 100},
        {x: 85, y: 95},
        {x: 80, y: 100},
        {x: 80, y: 110},
        {x: 90, y: 120},
        {x: 110, y: 125}
    ]);

    // Template per Terra (quadrato)
    this.addGesture('terra', [
        {x: 60, y: 80},  // Inizio in alto a sinistra
        {x: 120, y: 80}, // Spostamento a destra
        {x: 120, y: 120}, // Spostamento in basso
        {x: 80, y: 120}, // Spostamento a sinistra
        {x: 80, y: 60}   // Chiusura del quadrato
    ]);

    this.addGesture('terra', [
        {x: 80, y: 60},  // Inizio in alto a sinistra
        {x: 80, y: 120}, // Spostamento a destra
        {x: 120, y: 120}, // Spostamento in basso
        {x: 120, y: 80}, // Spostamento a sinistra
        {x: 60, y: 80}   // Chiusura del quadrato
    ]);

    this.addGesture('terra', [
        {x: 40, y: 80},  // Inizio in alto a sinistra
        {x: 110, y: 80}, // Spostamento a destra
        {x: 120, y: 100}, // Spostamento in basso
        {x: 100, y: 120}, // Spostamento a sinistra
        {x: 80, y: 100},  // Spostamento in basso
        {x: 80, y: 40}  // Spostamento in alto
    ]);

    this.addGesture('terra', [
        {x: 80, y: 40},  // Inizio in alto a sinistra
        {x: 80, y: 100}, // Spostamento a destra
        {x: 100, y: 120}, // Spostamento in basso
        {x: 120, y: 100}, // Spostamento a sinistra
        {x: 110, y: 80},  // Spostamento in basso
        {x: 40, y: 80}  // Spostamento in alto
    ]);

    this.addGesture('cerchio', [
        {x: 100, y: 100}, // Inizio al centro
        {x: 120, y: 110}, // Spostamento a destra
        {x: 130, y: 130}, // Spostamento in basso a destra
        {x: 120, y: 150}, // Spostamento in basso
        {x: 100, y: 160}, // Spostamento a sinistra
        {x: 80, y: 150},  // Spostamento in basso a sinistra
        {x: 70, y: 130},  // Spostamento in alto a sinistra
        {x: 80, y: 110},  // Spostamento in alto
        {x: 100, y: 100}  // Chiusura del cerchio
    ]);

    // inverti i punti per creare un cerchio in senso antiorario
    this.addGesture('cerchio', [
        {x: 100, y: 100}, // Inizio al centro
        {x: 80, y: 110},  // Spostamento a destra
        {x: 70, y: 130},  // Spostamento in basso a destra
        {x: 80, y: 150},  // Spostamento in basso
        {x: 100, y: 160}, // Spostamento a sinistra
        {x: 120, y: 150}, // Spostamento in basso a sinistra
        {x: 130, y: 130}, // Spostamento in alto a sinistra
        {x: 120, y: 110}, // Spostamento in alto
        {x: 100, y: 100}  // Chiusura del cerchio
    ]);

    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio al centro
        {x: 120, y: 90},  // Spostamento a destra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 120, y: 100}  // Orizzontale destra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 80, y: 100}   // Orizzontale sinistra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 100, y: 80}   // Verticale su
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 100, y: 120}  // Verticale giù
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 120, y: 120}  // Obliqua basso-destra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 80, y: 120}   // Obliqua basso-sinistra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 120, y: 80}   // Obliqua alto-destra
    ]);
    this.addGesture('proiettile', [
        {x: 100, y: 100}, // Inizio
        {x: 80, y: 80}    // Obliqua alto-sinistra
    ]);
  }

  addGesture(name, points) {
    points = this.normalize(points);
    this.templates.push({
      name: name,
      points: points
    });
  }

  recognize(points) {
    if (points.length < 10) return { name: 'unknown', score: 0 };

    points = this.normalize(points);
    let bestMatch = { score: 0 };

    for (const template of this.templates) {
      const score = this.compare(points, template.points);
      if (score > bestMatch.score) {
        bestMatch = { name: template.name, score: score };
      }
    }

    return bestMatch;
  }

  normalize(points) {
    // 1. Ridimensiona e trasla
    const { minX, minY, width, height } = this.boundingBox(points);
    const scale = Math.max(width, height);
    const newPoints = [];
    
    for (const point of points) {
      newPoints.push({
        x: (point.x - minX) / scale * 100,
        y: (point.y - minY) / scale * 100
      });
    }

    // 2. Riesempio a 64 punti equidistanti
    return this.resample(newPoints, 64);
  }

  resample(points, n) {
    const interval = this.pathLength(points) / (n - 1);
    let newPoints = [points[0]];
    let D = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const d = this.distance(prev, curr);

      if (D + d >= interval) {
        const qx = prev.x + ((interval - D) / d) * (curr.x - prev.x);
        const qy = prev.y + ((interval - D) / d) * (curr.y - prev.y);
        newPoints.push({ x: qx, y: qy });
        points.splice(i, 0, { x: qx, y: qy });
        D = 0;
      } else {
        D += d;
      }
    }

    // Aggiungi l'ultimo punto se necessario
    if (newPoints.length < n) {
      newPoints.push(points[points.length - 1]);
    }

    return newPoints;
  }

  pathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += this.distance(points[i - 1], points[i]);
    }
    return length;
  }

  boundingBox(points) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return {
      minX, minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  compare(points1, points2) {
    // Distanza media tra punti corrispondenti
    let sum = 0;
    for (let i = 0; i < points1.length; i++) {
      sum += this.distance(points1[i], points2[i]);
    }
    const avg = sum / points1.length;

    // Converti in punteggio (1 = perfetto, 0 = pessimo)
    const maxSize = 100; // Dimensione area normalizzata
    return 1 - (avg / (0.5 * maxSize));
  }
}