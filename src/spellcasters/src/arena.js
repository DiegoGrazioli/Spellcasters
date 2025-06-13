// This file implements the functionality for the arena page, including matchmaking and player connection handling.

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

document.getElementById('start-matchmaking').onclick = startMatchmaking;
document.getElementById('connect-player').onclick = () => {
    const playerName = document.getElementById('player-name').value;
    connectPlayer(playerName);
    updateUI();
};