import { WebSocketServer } from 'ws';

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

let players = [];
let connectedPlayers = [];
let matchmakingQueue = [];
let activeMatches = new Map(); // gameId -> { player1, player2, gameState }

class GameState {
    constructor(player1, player2) {
        this.gameId = generateGameId();
        this.player1 = player1;
        this.player2 = player2;
        this.gameStarted = false;
        this.gameEnded = false;
        this.winner = null;
        this.players = {
            [player1.id]: {
                health: 20,
                position: { x: 200, y: 400 },
                spells: []
            },
            [player2.id]: {
                health: 20,
                position: { x: 1400, y: 400 },
                spells: []
            }
        };
    }

    toJSON() {
        return {
            gameId: this.gameId,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded,
            winner: this.winner,
            players: this.players
        };
    }
}

function generateGameId() {
    return Math.random().toString(36).substr(2, 9);
}

function calculateWinRate(player) {
    if (!player.stats || player.stats.partite === 0) return 0;
    return player.stats.vittorie / player.stats.partite;
}

function findMatch(searchingPlayer) {
    // Cerca un avversario compatibile in base a livello e win rate
    const playerLevel = searchingPlayer.level || 1;
    const playerWinRate = calculateWinRate(searchingPlayer);
    
    for (let i = 0; i < matchmakingQueue.length; i++) {
        const opponent = matchmakingQueue[i];
        if (opponent.id === searchingPlayer.id) continue;
        
        const opponentLevel = opponent.level || 1;
        const opponentWinRate = calculateWinRate(opponent);
        
        // Criteri di matchmaking: livello ±3 e win rate ±0.3
        const levelDiff = Math.abs(playerLevel - opponentLevel);
        const winRateDiff = Math.abs(playerWinRate - opponentWinRate);
        
        if (levelDiff <= 3 && winRateDiff <= 0.3) {
            // Match trovato!
            matchmakingQueue.splice(i, 1); // Rimuovi l'avversario dalla coda
            return opponent;
        }
    }
    
    return null;
}

wss.on('connection', (ws) => {
    console.log('Player connected.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'requestOnlineCount':
                    broadcastOnlinePlayers();
                    break;
                    
                case 'join':
                    handlePlayerJoin(ws, data);
                    break;
                    
                case 'startMatchmaking':
                    handleStartMatchmaking(ws, data);
                    break;
                    
                case 'cancelMatchmaking':
                    handleCancelMatchmaking(ws, data);
                    break;
                    
                case 'gameAction':
                    handleGameAction(ws, data);
                    break;
                    
                case 'spellCast':
                    handleSpellCast(ws, data);
                    break;
                    
                case 'playerMove':
                    handlePlayerMove(ws, data);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(ws);
    });

    broadcastOnlinePlayers();
});

function handlePlayerJoin(ws, data) {
    const player = {
        id: generatePlayerId(),
        username: data.username,
        level: data.level || 1,
        stats: data.stats || { vittorie: 0, partite: 0 },
        ws: ws,
        inGame: false,
        gameId: null
    };
    
    connectedPlayers.push(player);
    ws.playerId = player.id;
    
    console.log(`${data.username} joined the arena (Level ${player.level})`);
    broadcastPlayers();
}

function handleStartMatchmaking(ws, data) {
    const player = connectedPlayers.find(p => p.ws === ws);
    if (!player || player.inGame) return;
    
    // Controlla se il player è già in coda
    if (matchmakingQueue.find(p => p.id === player.id)) return;
    
    console.log(`${player.username} started matchmaking`);
    
    // Cerca un match immediato
    const opponent = findMatch(player);
    
    if (opponent) {
        // Match trovato!
        console.log(`Match found: ${player.username} vs ${opponent.username}`);
        startMatch(player, opponent);
    } else {
        // Aggiungi alla coda di matchmaking
        matchmakingQueue.push(player);
        player.ws.send(JSON.stringify({
            type: 'matchmakingStatus',
            status: 'searching',
            message: 'Searching for opponents...'
        }));
    }
}

function handleCancelMatchmaking(ws, data) {
    const player = connectedPlayers.find(p => p.ws === ws);
    if (!player) return;
    
    // Rimuovi dalla coda di matchmaking
    const index = matchmakingQueue.findIndex(p => p.id === player.id);
    if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        player.ws.send(JSON.stringify({
            type: 'matchmakingStatus',
            status: 'cancelled',
            message: 'Matchmaking cancelled'
        }));
        console.log(`${player.username} cancelled matchmaking`);
    }
}

function startMatch(player1, player2) {
    const gameState = new GameState(player1, player2);
    activeMatches.set(gameState.gameId, gameState);
    
    // Imposta i player come in partita
    player1.inGame = true;
    player1.gameId = gameState.gameId;
    player2.inGame = true;
    player2.gameId = gameState.gameId;
    
    // Invia conferma match a entrambi i player
    const matchData = {
        type: 'matchFound',
        gameId: gameState.gameId,
        opponent: {
            username: player2.username,
            level: player2.level
        },
        yourPosition: 'left'
    };
    
    const matchData2 = {
        type: 'matchFound',
        gameId: gameState.gameId,
        opponent: {
            username: player1.username,
            level: player1.level
        },
        yourPosition: 'right'
    };
    
    player1.ws.send(JSON.stringify(matchData));
    player2.ws.send(JSON.stringify(matchData2));
    
    // Avvia il gioco dopo 3 secondi
    setTimeout(() => {
        if (activeMatches.has(gameState.gameId)) {
            gameState.gameStarted = true;
            broadcastToGame(gameState.gameId, {
                type: 'gameStart',
                gameState: gameState.toJSON()
            });
        }
    }, 3000);
}

function handleSpellCast(ws, data) {
    const player = connectedPlayers.find(p => p.ws === ws);
    if (!player || !player.inGame) return;
    
    const gameState = activeMatches.get(player.gameId);
    if (!gameState || !gameState.gameStarted) return;
    
    // Aggiungi la spell al game state
    const spell = {
        id: Math.random().toString(36).substr(2, 9),
        casterId: player.id,
        type: data.spellType,
        position: data.position,
        direction: data.direction,
        damage: data.damage || 1,
        timestamp: Date.now()
    };
    
    gameState.players[player.id].spells.push(spell);
    
    // Broadcast della spell a entrambi i player
    broadcastToGame(player.gameId, {
        type: 'spellCast',
        spell: spell,
        caster: player.username
    });
}

function handlePlayerMove(ws, data) {
    const player = connectedPlayers.find(p => p.ws === ws);
    if (!player || !player.inGame) return;
    
    const gameState = activeMatches.get(player.gameId);
    if (!gameState || !gameState.gameStarted) return;
    
    // Aggiorna posizione del player
    gameState.players[player.id].position = data.position;
    
    // Broadcast della nuova posizione
    broadcastToGame(player.gameId, {
        type: 'playerMove',
        playerId: player.id,
        position: data.position
    });
}

function handleGameAction(ws, data) {
    const player = connectedPlayers.find(p => p.ws === ws);
    if (!player || !player.inGame) return;
    
    const gameState = activeMatches.get(player.gameId);
    if (!gameState) return;
    
    switch (data.action) {
        case 'spellHit':
            handleSpellHit(gameState, data);
            break;
        case 'playerDamage':
            handlePlayerDamage(gameState, data);
            break;
    }
}

function handleSpellHit(gameState, data) {
    const targetId = data.targetPlayerId;
    const damage = data.damage || 1;
    
    if (gameState.players[targetId]) {
        gameState.players[targetId].health -= damage;
        
        // Broadcast del danno
        broadcastToGame(gameState.gameId, {
            type: 'playerDamaged',
            playerId: targetId,
            damage: damage,
            newHealth: gameState.players[targetId].health
        });
        
        // Controlla se il gioco è finito
        if (gameState.players[targetId].health <= 0) {
            endGame(gameState, targetId);
        }
    }
}

function endGame(gameState, defeatedPlayerId) {
    gameState.gameEnded = true;
    
    // Determina il vincitore
    const winnerId = gameState.player1.id === defeatedPlayerId ? 
        gameState.player2.id : gameState.player1.id;
    
    const winner = gameState.player1.id === winnerId ? 
        gameState.player1 : gameState.player2;
    const loser = gameState.player1.id === defeatedPlayerId ? 
        gameState.player1 : gameState.player2;
    
    gameState.winner = winner.username;
    
    // Broadcast risultato partita
    broadcastToGame(gameState.gameId, {
        type: 'gameEnd',
        winner: winner.username,
        loser: loser.username,
        gameState: gameState.toJSON()
    });
    
    // Aggiorna statistiche (questo dovrebbe essere fatto nel database)
    console.log(`Game ended: ${winner.username} defeated ${loser.username}`);
    
    // Pulisci il game state
    setTimeout(() => {
        // Rimuovi i player dal gioco
        winner.inGame = false;
        winner.gameId = null;
        loser.inGame = false;
        loser.gameId = null;
        
        // Rimuovi la partita attiva
        activeMatches.delete(gameState.gameId);
    }, 5000);
}

function broadcastToGame(gameId, message) {
    const gameState = activeMatches.get(gameId);
    if (!gameState) return;
    
    const messageStr = JSON.stringify(message);
    gameState.player1.ws.send(messageStr);
    gameState.player2.ws.send(messageStr);
}

function handlePlayerDisconnect(ws) {
    const playerIndex = connectedPlayers.findIndex(p => p.ws === ws);
    if (playerIndex === -1) return;
    
    const player = connectedPlayers[playerIndex];
    
    // Rimuovi dalla coda di matchmaking
    const queueIndex = matchmakingQueue.findIndex(p => p.id === player.id);
    if (queueIndex !== -1) {
        matchmakingQueue.splice(queueIndex, 1);
    }
    
    // Se era in partita, termina la partita
    if (player.inGame && player.gameId) {
        const gameState = activeMatches.get(player.gameId);
        if (gameState) {
            const opponent = gameState.player1.id === player.id ? 
                gameState.player2 : gameState.player1;
            
            // Notifica l'avversario
            opponent.ws.send(JSON.stringify({
                type: 'opponentDisconnected',
                message: 'Your opponent has disconnected. You win!'
            }));
            
            // Pulisci il game state
            opponent.inGame = false;
            opponent.gameId = null;
            activeMatches.delete(player.gameId);
        }
    }
    
    connectedPlayers.splice(playerIndex, 1);
    console.log(`Player ${player.username} disconnected.`);
    broadcastPlayers();
}

function broadcastPlayers() {
    const playerList = connectedPlayers.map(player => ({
        id: player.id,
        username: player.username,
        level: player.level,
        inGame: player.inGame
    }));
    
    connectedPlayers.forEach(player => {
        if (player.ws.readyState === 1) {
            player.ws.send(JSON.stringify({ 
                type: 'playersUpdate', 
                players: playerList 
            }));
        }
    });
}

function broadcastOnlinePlayers() {
    const count = connectedPlayers.length;
    const msg = JSON.stringify({ type: 'onlinePlayers', count });
    
    connectedPlayers.forEach(player => {
        if (player.ws.readyState === 1) {
            player.ws.send(msg);
        }
    });
}

function generatePlayerId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Cleanup periodico delle partite abbandonate
setInterval(() => {
    const now = Date.now();
    activeMatches.forEach((gameState, gameId) => {
        // Rimuovi partite inattive da più di 30 minuti
        if (now - gameState.gameId > 1800000) {
            activeMatches.delete(gameId);
        }
    });
}, 300000); // Ogni 5 minuti

console.log(`WebSocket server running on port ${port}`);
console.log('Matchmaking system initialized');