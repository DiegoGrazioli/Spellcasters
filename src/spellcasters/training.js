// Controllo modalità - non eseguire se siamo in PvP
const params = new URLSearchParams(window.location.search);
const gameMode = params.get('mode') || 'training';

if (gameMode === 'training') {
    // Importa le funzionalità principali e la classe Enemy
    const { Enemy } = await import("./src/entities/enemy.js");
    const Main = await import("./main.js");
    const { globalCollisionSystem } = await import('./collision-system.js');

    // Inizializza canvas e contesto come in main.js
    const canvas = document.getElementById("spellCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Crea una lista di nemici per il training
    const enemy = new Enemy(1500, 400, 'light');
    enemy.mass = 1; // Massa più alta del mouse
    enemy.restitution = 0.4;
    enemy.velocity = { x: 0, y: 0 };
    globalCollisionSystem.registerEntity(enemy);

    // Funzione per disegnare nemici (chiamata da main.js)
    window.drawTrainingEnemies = function(ctx) {
        enemy.update(1/60);
        enemy.draw(ctx);
    };

    console.log('🎯 Sistema di training inizializzato');
} else {
    const Main = await import("./main.js");
    const { globalCollisionSystem } = await import('./collision-system.js');
    console.log('⚔️ Modalità PvP rilevata, training.js disabilitato');
}