// arena.js - Gestione matchmaking e partite lato client
import { getPlayerData, savePlayerData } from './player-db.js';

let players = [];
let matchmakingStatus = 'Waiting for players...';
let isSearching = false;
let currentMatch = null;
let ws = null;

function updateMatchmakingStatus() {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = matchmakingStatus;
    }
}

function connectToServer() {
    // Sostituisci con il tuo dominio Render
    ws = new WebSocket('wss://spellcasters.onrender.com');
    
    ws.onopen = () => {
        console.log('✅ Connessione WebSocket riuscita!');
        // Invia dati del player al server
        sendPlayerJoinData();
        // Richiedi il numero di giocatori online
        ws.send(JSON.stringify({ type: 'requestOnlineCount' }));
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (e) {
            console.log('Messaggio non JSON ricevuto:', event.data);
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ Errore WebSocket:', error);
        updateOnlinePlayers(0);
    };
    
    ws.onclose = () => {
        console.log('🔌 Connessione WebSocket chiusa');
        updateOnlinePlayers(0);
        
        // Riconnessione automatica dopo 3 secondi
        setTimeout(() => {
            if (!ws || ws.readyState === WebSocket.CLOSED) {
                connectToServer();
            }
        }, 3000);
    };
}

async function sendPlayerJoinData() {
    const username = localStorage.getItem('currentPlayer');
    if (!username || !ws) return;
    
    const playerData = await getPlayerData(username);
    if (playerData) {
        ws.send(JSON.stringify({
            type: 'join',
            username: playerData.username,
            level: playerData.livello || 1,
            stats: {
                vittorie: playerData.vittorie || 0,
                partite: playerData.partite || 0
            }
        }));
    }
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'onlinePlayers':
            updateOnlinePlayers(data.count);
            break;
            
        case 'playersUpdate':
            updatePlayersList(data.players);
            break;
            
        case 'matchmakingStatus':
            handleMatchmakingStatus(data);
            break;
            
        case 'matchFound':
            handleMatchFound(data);
            break;
            
        case 'gameStart':
            handleGameStart(data);
            break;
            
        case 'opponentDisconnected':
            handleOpponentDisconnected(data);
            break;
            
        case 'gameEnd':
            handleGameEnd(data);
            break;
    }
}

function handleMatchmakingStatus(data) {
    matchmakingStatus = data.message;
    updateMatchmakingStatus();
    
    if (data.status === 'searching') {
        // Continua ad animare la ricerca
        animateSearching();
    }
}

function handleMatchFound(data) {
    currentMatch = data;
    matchmakingStatus = `Match found! Opponent: ${data.opponent.username} (Level ${data.opponent.level})`;
    updateMatchmakingStatus();
    
    // Disabilita il pulsante di ricerca
    const matchmakingBtn = document.getElementById('matchmaking-btn');
    if (matchmakingBtn) {
        matchmakingBtn.disabled = true;
        matchmakingBtn.textContent = 'Match Found!';
    }
    
    // Countdown prima dell'inizio
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        matchmakingStatus = `Game starting in ${countdown}...`;
        updateMatchmakingStatus();
        countdown--;
        
        if (countdown < 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function handleGameStart(data) {
    // Reindirizza alla pagina di gioco con i parametri della partita
    const gameParams = new URLSearchParams({
        mode: 'duel',
        gameId: data.gameState.gameId,
        position: currentMatch.yourPosition,
        opponent: currentMatch.opponent.username
    });
    
    window.location.href = `game.html?${gameParams.toString()}`;
}

function handleOpponentDisconnected(data) {
    alert(data.message);
    resetMatchmaking();
}

function handleGameEnd(data) {
    const username = localStorage.getItem('currentPlayer');
    const isWinner = data.winner === username;
    
    // Aggiorna le statistiche locali
    updatePlayerStats(isWinner);
    
    // Mostra risultato
    const message = isWinner ? 
        `🎉 Victory! You defeated ${data.loser}!` :
        `💀 Defeat! You were defeated by ${data.winner}!`;
    
    alert(message);
    resetMatchmaking();
}

async function updatePlayerStats(isWinner) {
    const username = localStorage.getItem('currentPlayer');
    if (!username) return;
    
    const playerData = await getPlayerData(username);
    if (playerData) {
        playerData.partite = (playerData.partite || 0) + 1;
        if (isWinner) {
            playerData.vittorie = (playerData.vittorie || 0) + 1;
            playerData.esperienza = (playerData.esperienza || 0) + 100; // Bonus vittoria
        } else {
            playerData.esperienza = (playerData.esperienza || 0) + 25; // Consolazione
        }
        
        // Calcola nuovo livello se necessario
        const newLevel = Math.floor(playerData.esperienza / 1000) + 1;
        if (newLevel > playerData.livello) {
            playerData.livello = newLevel;
            alert(`🎊 Level Up! You are now level ${newLevel}!`);
        }
        
        await savePlayerData(username, playerData);
        
        // Aggiorna l'interfaccia
        updatePlayerDisplay(playerData);
    }
}

function startMatchmaking() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        matchmakingStatus = 'Connection error. Please try again.';
        updateMatchmakingStatus();
        return;
    }
    
    isSearching = true;
    matchmakingStatus = 'Searching for opponents...';
    updateMatchmakingStatus();
    
    ws.send(JSON.stringify({ type: 'startMatchmaking' }));
    
    // Animazione di ricerca
    animateSearching();
}

function cancelMatchmaking() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    isSearching = false;
    ws.send(JSON.stringify({ type: 'cancelMatchmaking' }));
    resetMatchmaking();
}

function resetMatchmaking() {
    isSearching = false;
    currentMatch = null;
    matchmakingStatus = 'Ready to search for opponents';
    updateMatchmakingStatus();
    
    const matchmakingBtn = document.getElementById('matchmaking-btn');
    if (matchmakingBtn) {
        matchmakingBtn.disabled = false;
        matchmakingBtn.textContent = 'Search Match';
    }
}

function animateSearching() {
    if (!isSearching) return;
    
    const dots = ['', '.', '..', '...'];
    let dotIndex = 0;
    
    const interval = setInterval(() => {
        if (!isSearching) {
            clearInterval(interval);
            return;
        }
        
        matchmakingStatus = `Searching for opponents${dots[dotIndex]}`;
        updateMatchmakingStatus();
        dotIndex = (dotIndex + 1) % dots.length;
    }, 500);
}

function updateOnlinePlayers(count) {
    const el = document.getElementById('online-players-count');
    if (el) {
        el.textContent = count;
        console.log(`👥 Giocatori online aggiornati: ${count}`);
    }
}

function updatePlayersList(players) {
    const listElement = document.getElementById('players-list');
    if (!listElement) return;
    
    listElement.innerHTML = '';
    players.forEach(player => {
        const playerItem = document.createElement('li');
        playerItem.textContent = `${player.username} (Level ${player.level})`;
        if (player.inGame) {
            playerItem.textContent += ' - In Game';
            playerItem.style.color = '#ff6b6b';
        }
        listElement.appendChild(playerItem);
    });
}

async function updatePlayerDisplay(playerData) {
    if (playerData) {
        const nameEl = document.getElementById('name-value');
        const levelEl = document.getElementById('level-value');
        
        if (nameEl) nameEl.textContent = playerData.username;
        if (levelEl) levelEl.textContent = playerData.livello || 1;
        
        // Aggiorna win rate se esiste
        const winRateEl = document.getElementById('winrate-value');
        if (winRateEl && playerData.partite > 0) {
            const winRate = ((playerData.vittorie / playerData.partite) * 100).toFixed(1);
            winRateEl.textContent = `${winRate}%`;
        }
    }
}

function startTrainingMode() {
    // Passa alla modalità training
    window.location.href = 'game.html?mode=training';
}

// Inizializzazione quando la pagina è caricata
window.addEventListener('DOMContentLoaded', async () => {
    initArenaTheme();
    
    // Connetti al server
    connectToServer();
    
    const username = localStorage.getItem('currentPlayer');
    if (username) {
        const player = await getPlayerData(username);
        updatePlayerDisplay(player);
    }

    // Setup pulsanti
    const matchmakingBtn = document.getElementById('matchmaking-btn');
    if (matchmakingBtn) {
        matchmakingBtn.addEventListener('click', () => {
            if (!isSearching && !currentMatch) {
                startMatchmaking();
                matchmakingBtn.textContent = 'Cancel Search';
            } else if (isSearching) {
                cancelMatchmaking();
                matchmakingBtn.textContent = 'Search Match';
            }
        });
    }

    // Pulsante Home
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'home.html';
        });
    }

    // Pulsante Training
    const trainingBtn = document.getElementById('training-btn');
    if (trainingBtn) {
        trainingBtn.addEventListener('click', startTrainingMode);
    }
});

// Gestione tema
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

// Cleanup quando si chiude la pagina
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
});