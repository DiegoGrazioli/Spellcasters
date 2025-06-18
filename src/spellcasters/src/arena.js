// This file implements the functionality for the arena page, including matchmaking and player connection handling.
import { getPlayerData } from './player-db.js';

let players = [];
let matchmakingStatus = 'Waiting for players...';

function updateMatchmakingStatus() {
    const statusElement = document.getElementById('matchmaking-status');
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
const ws = new WebSocket('wss://tuo-servizio.onrender.com');

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

window.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('currentPlayer');
    if (username) {
        const player = await getPlayerData(username);
        if (player) {
            document.getElementById('name-value').textContent = player.username;
            document.getElementById('level-value').textContent = player.livello;
        }
    }
});