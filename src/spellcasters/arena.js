// This file implements the functionality for the arena page, including matchmaking and player connection handling.
import { getPlayerData } from './player-db.js';

let players = [];
let matchmakingStatus = 'Waiting for players...';

function updateMatchmakingStatus() {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = matchmakingStatus;
}

function startMatchmaking() {
    matchmakingStatus = 'Searching for opponents...';
    updateMatchmakingStatus();
    
    // Simulate matchmaking process
    setTimeout(() => {
        if (Math.random() > 0.5) {
            matchmakingStatus = 'Match found! Preparing to enter the arena...';
            players.push({ id: 1, name: 'Player1' });
            players.push({ id: 2, name: 'Player2' });
        } else {
            matchmakingStatus = 'No opponents found. Please try again.';
        }
        updateMatchmakingStatus();
    }, 3000);
}

function cancelMatchmaking() {
  // Logica per annullare la ricerca avversario
  matchmakingStatus = 'Matchmaking cancelled.';
  updateMatchmakingStatus();
}

function connectPlayer(playerName) {
    const player = { id: players.length + 1, name: playerName };
    players.push(player);
    console.log(`${playerName} has joined the arena.`);
}

function updateUI() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    players.forEach(player => {
        const playerItem = document.createElement('li');
        playerItem.textContent = player.name;
        playersList.appendChild(playerItem);
    });
}

// Sostituisci con il tuo dominio Render
const ws = new WebSocket('wss://spellcasters.onrender.com');

ws.onopen = () => {
    console.log('✅ Connessione WebSocket riuscita!');
};

ws.onmessage = (event) => {
    console.log('📨 Messaggio dal server:', event.data);
};

ws.onerror = (error) => {
    console.error('❌ Errore WebSocket:', error);
};

ws.onclose = () => {
    console.log('🔌 Connessione WebSocket chiusa');
};

function updateOnlinePlayers(count) {
    const el = document.getElementById('online-players-count');
    if (el) el.textContent = count;
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "onlinePlayers") {
    updateOnlinePlayers(data.count);
  }
};

window.addEventListener('DOMContentLoaded', async () => {
    initArenaTheme();
    const username = localStorage.getItem('currentPlayer');
    if (username) {
        const player = await getPlayerData(username);
        if (player) {
            document.getElementById('name-value').textContent = player.username;
            document.getElementById('level-value').textContent = player.livello;
        }
    }

    // Pulsante Ricerca/Annulla Ricerca
    const matchmakingBtn = document.getElementById('matchmaking-btn');
    let isSearching = false;

    matchmakingBtn.addEventListener('click', () => {
        if (!isSearching) {
            // Avvia la ricerca avversario
            isSearching = true;
            matchmakingBtn.textContent = 'Annulla Ricerca';
            startMatchmaking(); // la tua funzione per avviare il matchmaking
        } else {
            // Annulla la ricerca avversario
            isSearching = false;
            matchmakingBtn.textContent = 'Ricerca';
            cancelMatchmaking(); // la tua funzione per annullare il matchmaking
        }
    });

    // Pulsante Home
    document.getElementById('home-btn').addEventListener('click', () => {
      window.location.href = 'home.html';
    });

    // Pulsante Training
    document.getElementById('training-btn').addEventListener('click', () => {
      // Avvia la simulazione di partita senza avversari
      startTrainingMode(); // implementa questa funzione come preferisci
    });
});

// --- Modalità Giorno/Notte ---
function setArenaTheme(mode) {
  const theme = mode === 'night' ? 'night' : 'day';
  document.body.classList.remove('day', 'night');
  document.body.classList.add(theme);
  localStorage.setItem('mode', theme);
}

function initArenaTheme() {
  const saved = localStorage.getItem('mode');
  setArenaTheme(saved === 'night' ? 'night' : 'day');
}

// Scorciatoie tastiera
window.addEventListener("keydown", (e) => {
  if (e.key === 'n' || e.key === 'N') setArenaTheme('night');
  if (e.key === 'g' || e.key === 'G') setArenaTheme('day');
});

document.getElementById('training-btn').addEventListener('click', () => {
  // Passa una query string per indicare la modalità training
  window.location.href = 'game.html?mode=training';
});