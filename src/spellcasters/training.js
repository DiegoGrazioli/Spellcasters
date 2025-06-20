// Importa le funzionalità principali e la classe Enemy
import { Enemy } from "./src/entities/enemy.js";
import * as Main from "./main.js";
import { globalCollisionSystem } from './collision-system.js';

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

// Esempio: funzione per aggiornare e disegnare tutto (ciclo di gioco)
function animateTraining() {
//   ctx.clearRect(0, 0, canvas.width, canvas.height);


  enemy.update(1/60); // dt fisso per esempio
  enemy.draw(ctx);
  


  // Puoi aggiungere interazione tra spell e nemici qui

  requestAnimationFrame(animateTraining);
}

// Avvia il ciclo di training
animateTraining();