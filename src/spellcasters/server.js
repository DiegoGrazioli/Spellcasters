// server.js - Sistema completo per matchmaking e duelli PvP
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import admin from 'firebase-admin';
import fs from "fs";

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const dbAdmin = admin.firestore();

export { dbAdmin };

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port });

// Strutture dati per gestire giocatori e partite
let connectedPlayers = new Map(); // Map<websocket, playerData>
let matchmakingQueue = []; // Array di giocatori in cerca di partita
let activeMatches = new Map(); // Map<matchId, matchData>

// Configurazione matchmaking
const MATCHMAKING_CONFIG = {
    LEVEL_TOLERANCE: 3, // Differenza massima di livello
    WINRATE_TOLERANCE: 0.3, // Differenza massima di win rate (30%)
    QUEUE_TIMEOUT: 30000, // 30 secondi prima di espandere i criteri
    MATCH_TIMEOUT: 300000 // 5 minuti per partita
};

wss.on('connection', (ws) => {
    console.log('🔌 Nuovo giocatore connesso');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('❌ Errore parsing messaggio:', error);
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(ws);
    });

    // Invia il conteggio giocatori online
    broadcastOnlineCount();
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'register':
            registerPlayer(ws, data);
            break;
        case 'requestOnlineCount':
            sendOnlineCount(ws);
            break;
        case 'joinMatchmaking':
        case 'startMatchmaking':
            joinMatchmaking(ws, data);
            break;
        case 'leaveMatchmaking':
        case 'cancelMatchmaking':
            leaveMatchmaking(ws);
            break;
        case 'playerMove':
            handlePlayerMove(ws, data);
            break;
        case 'projectileLaunch':
            handleProjectileLaunch(ws, data);
            break;
        case 'magicCircleUpdate':
            handleMagicCircleUpdate(ws, data);
            break;
        case 'playerCasting':
            handlePlayerCasting(ws, data);
            break;
        case 'projectileHit':
            handleProjectileHit(ws, data);
            break;
        case 'spellCast':
            handleSpellCast(ws, data);
            break;
        case 'spellRemoval':
            handleSpellRemoval(ws, data);
            break;
        case 'playerReady':
            handlePlayerReady(ws, data);
            break;
        case 'requestLeaderboard':
            sendLeaderboard(ws);
            break;
        default:
            console.log('🤔 Tipo messaggio sconosciuto:', data.type);
    }
}

async function getAllPlayersFromDB() {
    // Questa implementazione è concettuale e DEVE usare il Firebase Admin SDK
    const snapshot = await dbAdmin.collection('players').get();
    const players = [];
    snapshot.forEach(doc => {
        players.push(doc.data());
    });
    return players;
}

function handlePlayerReady(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;
    
    const match = activeMatches.get(player.currentMatch);
    if (!match || match.matchState !== 'waiting_for_ready') return;

    console.log(`👍 ${player.username} è pronto per il match ${match.id}`);

    const isPlayer1 = match.players[0].id === player.id;
    
    if (isPlayer1) {
        match.player1Ready = true;
    } else {
        match.player2Ready = true;
    }

    // Notifica l'altro giocatore che sei pronto (opzionale, per UI)
    const opponent = match.players[isPlayer1 ? 1 : 0];
    if (opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({ type: 'opponentReady' }));
    }

    // Controlla se entrambi sono pronti
    if (match.player1Ready && match.player2Ready) {
        console.log(`🏁 Entrambi i giocatori pronti! Avvio countdown per ${match.id}`);
        match.matchState = 'starting'; // Cambia stato per evitare doppi click

        // Invia il via libera per il countdown a *entrambi* i giocatori
        const countdownMessage = JSON.stringify({ type: 'matchStartCountdown' });
        
        if (match.players[0].ws && match.players[0].ws.readyState === 1) {
            match.players[0].ws.send(countdownMessage);
        }
        if (match.players[1].ws && match.players[1].ws.readyState === 1) {
            match.players[1].ws.send(countdownMessage);
        }
        
        // Dopo il countdown (es. 4 sec), il server imposta lo stato "attivo"
        setTimeout(() => {
            if (activeMatches.has(match.id)) {
                 match.matchState = 'active';
                 console.log(`🟢 Match ${match.id} è ora attivo.`);
            }
        }, 4000); // 4 secondi (3 di countdown + 1 buffer)
    }
}

function handleSpellRemoval(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;
    const match = activeMatches.get(player.currentMatch);
    if (!match) return;
    if (match.matchState !== 'active') return;
    const isPlayer1 = match.players[0].id === player.id;
    const opponent = match.players[isPlayer1 ? 1 : 0];
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'opponentSpellRemoval',
            spellType: data.spellType,
            position: data.position,
            polygonPoints: data.polygonPoints,
            areaId: data.areaId, // Invia l'ID dell'area se disponibile
            timestamp: data.timestamp || Date.now()
        }));
        console.log(`🛑 Rimozione spell inviata a ${opponent.username}: ${data.spellType}`);
    }
}

function handleSpellCast(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;
    const match = activeMatches.get(player.currentMatch);
    if (!match) return;
    if (match.matchState !== 'active') return;
    const isPlayer1 = match.players[0].id === player.id;
    const opponent = match.players[isPlayer1 ? 1 : 0];
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'opponentSpell',
            spellType: data.spellType,
            position: data.position,
            polygonPoints: data.polygonPoints, // CAMBIA DA radius a polygonPoints
            element: data.element,
            areaId: data.areaId, // Invia l'ID dell'area se disponibile
            timestamp: data.timestamp || Date.now()
        }));
    }
}

function handlePlayerMove(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;

    const match = activeMatches.get(player.currentMatch);
    if (!match) return;

    if (match.matchState !== 'active') return;

    // Determina quale giocatore ha inviato l'azione
    const isPlayer1 = match.players[0].id === player.id;
    const playerKey = isPlayer1 ? 'player1' : 'player2';
    const opponent = match.players[isPlayer1 ? 1 : 0];

    // Aggiorna posizione nel game state
    if (data.position) {
        match.gameState[playerKey].position = data.position;
    }
    if (data.virtualMouse) {
        match.gameState[playerKey].virtualMouse = data.virtualMouse;
    }

    // console.log(`🚶 ${player.username} si muove: ${JSON.stringify(data.virtualMouse)}`);

    // Invia aggiornamento all'avversario
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        const moveUpdate = {
            type: 'opponentMove',
            virtualMouse: data.virtualMouse,
            position: data.position,
            playerRole: playerKey,
            timestamp: data.timestamp || Date.now()
        };
        
        opponent.ws.send(JSON.stringify(moveUpdate));
        // console.log(`📤 Movimento inviato a ${opponent.username}: ${JSON.stringify(data.virtualMouse)}`);
    } else {
        console.log('❌ Avversario non disponibile per ricevere movimento');
    }
}

function handleProjectileLaunch(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;

    const match = activeMatches.get(player.currentMatch);
    if (!match) return;

    if (match.matchState !== 'active') return;

    // Determina quale giocatore ha inviato l'azione
    const isPlayer1 = match.players[0].id === player.id;
    const opponent = match.players[isPlayer1 ? 1 : 0];

    console.log(`🚀 ${player.username} lancia proiettile: ${data.tipo}`);

    // Invia proiettile all'avversario
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'opponentProjectile',
            start: data.start,
            velocity: data.velocity,
            color: data.color,
            tipo: data.tipo,
            element: data.element,
            maxLife: data.maxLife,
            timestamp: data.timestamp || Date.now()
        }));
        // console.log(`📤 Proiettile inviato a ${opponent.username}`);
    }
}

function handleMagicCircleUpdate(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;

    const match = activeMatches.get(player.currentMatch);
    if (!match) return;

    if (match.matchState !== 'active') return;

    // Determina quale giocatore ha inviato l'azione
    const isPlayer1 = match.players[0].id === player.id;
    const opponent = match.players[isPlayer1 ? 1 : 0];

    // Invia aggiornamento cerchio magico all'avversario
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'opponentMagicCircle',
            magicCircle: data.magicCircle,
            timestamp: data.timestamp || Date.now()
        }));
    }
}

function handlePlayerCasting(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;

    const match = activeMatches.get(player.currentMatch);
    if (!match) return;

    if (match.matchState !== 'active') return;

    // Determina quale giocatore ha inviato l'azione
    const isPlayer1 = match.players[0].id === player.id;
    const opponent = match.players[isPlayer1 ? 1 : 0];

    // Invia stato casting all'avversario
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'opponentCasting',
            casting: data.casting,
            castingPoints: data.castingPoints,
            timestamp: data.timestamp || Date.now()
        }));
    }
}

function handleProjectileHit(ws, data) {
    const player = connectedPlayers.get(ws);
    if (!player || player.status !== 'in_game') return;

    const match = activeMatches.get(player.currentMatch);
    if (!match) return;

    if (match.matchState !== 'active') return;

    // Determina quale giocatore ha inviato l'azione
    const isPlayer1 = match.players[0].id === player.id;
    const playerKey = isPlayer1 ? 'player1' : 'player2';
    const opponent = match.players[isPlayer1 ? 1 : 0];

    // Aggiorna salute nel game state
    if (data.target === playerKey) {
        match.gameState[playerKey].health -= data.damage;
    } else {
        const opponentKey = isPlayer1 ? 'player2' : 'player1';
        match.gameState[opponentKey].health -= data.damage;
    }

    // Invia conferma hit all'avversario
    if (opponent && opponent.ws && opponent.ws.readyState === 1) {
        opponent.ws.send(JSON.stringify({
            type: 'projectileHit',
            target: data.target,
            damage: data.damage,
            element: data.element,
            timestamp: data.timestamp || Date.now()
        }));
    }

    // Controlla se la partita è finita
    if (match.gameState[playerKey].health <= 0) {
        const winner = playerKey === 'player1' ? 'player2' : 'player1';
        endMatch(match.id, 'health', winner);
    } else if (match.gameState[isPlayer1 ? 'player2' : 'player1'].health <= 0) {
        const winner = playerKey;
        endMatch(match.id, 'health', winner);
    }
}

function registerPlayer(ws, data) {
    // Calcola winRate dinamicamente
    const winRate = calculateWinRate(data.vittorie || 0, data.partite || 0);
    
    const playerData = {
        id: uuidv4(),
        username: data.username,
        level: data.level || 1,
        vittorie: data.vittorie || 0,
        partite: data.partite || 0,
        winRate: winRate, // Calcolato dinamicamente
        ws: ws,
        status: 'online',
        currentMatch: null,
        joinedAt: Date.now()
    };

    connectedPlayers.set(ws, playerData);
    
    ws.send(JSON.stringify({
        type: 'registered',
        playerId: playerData.id,
        status: 'success'
    }));

    console.log(`✅ Giocatore registrato: ${playerData.username} (Liv. ${playerData.level}, WR: ${(winRate * 100).toFixed(1)}%)`);
    broadcastOnlineCount();
}

function joinMatchmaking(ws, playerData) {
    const player = connectedPlayers.get(ws);
    if (!player) {
        ws.send(JSON.stringify({
            type: 'matchmakingError',
            message: 'Giocatore non registrato'
        }));
        return;
    }
    
    if (player.status !== 'online') {
        ws.send(JSON.stringify({
            type: 'matchmakingError',
            message: 'Giocatore non valido o già in coda'
        }));
        return;
    }

    // Aggiorna i dati del giocatore con le statistiche più recenti
    player.level = playerData.level || player.level;
    player.vittorie = playerData.vittorie || player.vittorie;
    player.partite = playerData.partite || player.partite;
    player.winRate = calculateWinRate(player.vittorie, player.partite); // Ricalcola winRate
    
    player.status = 'matchmaking';
    player.queueJoinTime = Date.now();
    
    matchmakingQueue.push(player);

    ws.send(JSON.stringify({
        type: 'matchmakingJoined',
        queuePosition: matchmakingQueue.length,
        estimatedWait: estimateWaitTime()
    }));

    console.log(`🔍 ${player.username} si è unito al matchmaking`);
    
    // Prova a trovare una partita
    // attemptMatchmaking();
}

function leaveMatchmaking(ws) {
    const player = connectedPlayers.get(ws);
    if (!player) return;

    const index = matchmakingQueue.findIndex(p => p.id === player.id);
    if (index !== -1) {
        matchmakingQueue.splice(index, 1);
        player.status = 'online';
        
        ws.send(JSON.stringify({
            type: 'matchmakingLeft'
        }));
        
        console.log(`❌ ${player.username} ha lasciato il matchmaking`);
    }
}

function attemptMatchmaking() {
    // Continua a ciclare finché ci sono almeno due giocatori in coda
    // e si può creare un match
    let matchesCreated = 0;
    let madeMatchInCycle = true;

    // Questa logica assicura che lo scandaglio riparta dall'inizio
    // della coda aggiornata dopo ogni creazione di match.
    while (madeMatchInCycle && matchmakingQueue.length >= 2) {
        madeMatchInCycle = false;
        
        for (let i = 0; i < matchmakingQueue.length - 1; i++) {
            const player1 = matchmakingQueue[i];
            
            for (let j = i + 1; j < matchmakingQueue.length; j++) {
                const player2 = matchmakingQueue[j];
                
                if (isValidMatch(player1, player2)) {
                    createMatch(player1, player2);
                    
                    // Rimuovi i giocatori dalla coda
                    // Importante: rimuovi prima l'indice più alto (j)
                    matchmakingQueue.splice(j, 1); 
                    matchmakingQueue.splice(i, 1);
                    
                    console.log(`⚔️ Match creato: ${player1.username} vs ${player2.username}`);
                    
                    matchesCreated++;
                    madeMatchInCycle = true; // Forziamo il loop a ripartire dall'inizio della coda aggiornata
                    break; // Esci dal loop interno (j) e riparti con un nuovo ciclo 'while'
                }
            }
            if (madeMatchInCycle) break; // Esci anche dal loop esterno (i) per ripartire
        }
    }

    if (matchesCreated > 0) {
        console.log(`✅ Ciclo di matchmaking completato: creati ${matchesCreated} match.`);
    }
}

function isValidMatch(player1, player2) {
    const now = Date.now();
    const player1WaitTime = now - player1.queueJoinTime;
    const player2WaitTime = now - player2.queueJoinTime;
    
    // Espandi i criteri di matchmaking se i giocatori aspettano da molto
    const levelTolerance = MATCHMAKING_CONFIG.LEVEL_TOLERANCE + 
        Math.floor(Math.max(player1WaitTime, player2WaitTime) / 10000);
    
    const winRateTolerance = MATCHMAKING_CONFIG.WINRATE_TOLERANCE + 
        Math.max(player1WaitTime, player2WaitTime) / 100000;
    
    // Verifica compatibilità livello
    const levelDiff = Math.abs(player1.level - player2.level);
    if (levelDiff > levelTolerance) return false;
    
    // Verifica compatibilità win rate (solo se entrambi hanno giocato partite)
    if (player1.partite > 0 && player2.partite > 0) { // Cambiato da totalMatches
        const winRateDiff = Math.abs(player1.winRate - player2.winRate);
        if (winRateDiff > winRateTolerance) return false;
    }
    
    return true;
}

function createMatch(player1, player2) {
    const matchId = uuidv4();
    const matchData = {
        id: matchId,
        players: [player1, player2],
        startTime: Date.now(),
        status: 'active', // starting, active, finished
        player1Ready: false,
        player2Ready: false,
        matchState: 'waiting_for_ready',
        gameState: {
            player1: {
                id: player1.id,
                username: player1.username,
                level: player1.level,
                health: 100,
                mana: player1.level * 10,
                position: { x: 200, y: 300 },
                virtualMouse: { x: 200, y: 300 },
                spells: [],
                projectiles: []
            },
            player2: {
                id: player2.id,
                username: player2.username,
                level: player2.level,
                health: 100,
                mana: player2.level * 10,
                position: { x: 1000, y: 300 },
                virtualMouse: { x: 1000, y: 300 },
                spells: [],
                projectiles: []
            },
            arena: {
                width: 1200,
                height: 600,
                boundaries: [
                    { x: 0, y: 0, width: 1200, height: 20 }, // Top
                    { x: 0, y: 580, width: 1200, height: 20 }, // Bottom
                    { x: 0, y: 0, width: 20, height: 600 }, // Left
                    { x: 1180, y: 0, width: 20, height: 600 } // Right
                ]
            }
        }
    };

    activeMatches.set(matchId, matchData);
    
    // Aggiorna lo stato dei giocatori
    player1.status = 'in_game';
    player1.currentMatch = matchId;
    player2.status = 'in_game';
    player2.currentMatch = matchId;

    // Invia i dati della partita ai giocatori
    const matchStartData = {
        type: 'matchFound',
        matchId: matchId,
        opponent: {
            username: player2.username,
            level: player2.level,
            winRate: player2.winRate
        },
        gameState: matchData.gameState,
        playerRole: 'player1'
    };

    player1.ws.send(JSON.stringify(matchStartData));
    
    player2.ws.send(JSON.stringify({
        ...matchStartData,
        opponent: {
            username: player1.username,
            level: player1.level,
            winRate: player1.winRate
        },
        playerRole: 'player2'
    }));

    // Avvia il timer della partita
    setTimeout(() => {
        if (activeMatches.has(matchId)) {
            endMatch(matchId, 'timeout');
        }
    }, MATCHMAKING_CONFIG.MATCH_TIMEOUT);
}

function endMatch(matchId, reason, winner = null) {
    const match = activeMatches.get(matchId);
    if (!match) return;

    match.status = 'finished';
    match.endTime = Date.now();
    match.duration = match.endTime - match.startTime;
    match.endReason = reason;
    match.winner = winner;

    // Aggiorna le statistiche dei giocatori
    const [player1, player2] = match.players;
    
    if (winner === 'player1') {
        updatePlayerStats(player1, true);
        updatePlayerStats(player2, false);
    } else if (winner === 'player2') {
        updatePlayerStats(player1, false);
        updatePlayerStats(player2, true);
    }

    // Invia i risultati ai giocatori
    const matchResults = {
        type: 'gameEnd', // <-- Cambia qui!
        reason: reason === 'disconnect' ? 'forfeit' : reason,
        winner: winner,
        duration: match.duration,
        finalGameState: match.gameState
    };

    if (player1.ws && player1.ws.readyState === 1) {
        player1.ws.send(JSON.stringify(matchResults));
    }
    if (player2.ws && player2.ws.readyState === 1) {
        player2.ws.send(JSON.stringify(matchResults));
    }

    // Riporta i giocatori online
    player1.status = 'online';
    player1.currentMatch = null;
    player2.status = 'online';
    player2.currentMatch = null;

    // Rimuovi la partita dalle partite attive
    activeMatches.delete(matchId);

    console.log(`🏁 Match terminato: ${reason} - Vincitore: ${winner || 'Nessuno'}`);
}

function updatePlayerStats(player, won) {
    // Qui dovresti salvare le statistiche nel database
    // Per ora aggiorniamo solo i dati in memoria
    const oldMatches = player.totalMatches || 0;
    const oldWins = Math.floor(oldMatches * (player.winRate || 0));
    
    player.totalMatches = oldMatches + 1;
    const newWins = oldWins + (won ? 1 : 0);
    player.winRate = newWins / player.totalMatches;

    console.log(`📊 ${player.username}: ${won ? 'Vittoria' : 'Sconfitta'} - WinRate: ${(player.winRate * 100).toFixed(1)}%`);
}

function handlePlayerDisconnect(ws) {
    const player = connectedPlayers.get(ws);
    if (!player) return;

    console.log(`🔌 ${player.username} disconnesso`);

    // Rimuovi dal matchmaking se presente
    const queueIndex = matchmakingQueue.findIndex(p => p.id === player.id);
    if (queueIndex !== -1) {
        matchmakingQueue.splice(queueIndex, 1);
    }

    // Gestisci disconnessione durante partita
    if (player.currentMatch) {
        const match = activeMatches.get(player.currentMatch);
        if (match && match.status === 'active') {
            const opponent = match.players.find(p => p.id !== player.id);
            if (opponent) {
                opponent.ws.send(JSON.stringify({
                    type: 'opponentDisconnected',
                    message: 'Il tuo avversario si è disconnesso. Hai vinto per abbandono!'
                }));
                
                endMatch(player.currentMatch, 'disconnect', 
                    opponent.id === match.players[0].id ? 'player1' : 'player2');
            }
        }
    }

    connectedPlayers.delete(ws);
    broadcastOnlineCount();
}

function estimateWaitTime() {
    // Stima semplice basata sulla coda
    const queueLength = matchmakingQueue.length;
    return Math.max(5, queueLength * 10); // Minimo 5 secondi, +10 secondi per giocatore
}

function sendOnlineCount(ws) {
    ws.send(JSON.stringify({
        type: 'onlinePlayers',
        count: connectedPlayers.size
    }));
}

function broadcastOnlineCount() {
    const totalOnline = connectedPlayers.size;
    const playersReady = matchmakingQueue.length;
    
    const message = JSON.stringify({
        type: 'playerCounts',
        totalOnline: totalOnline,
        playersReady: playersReady
    });

    connectedPlayers.forEach(player => {
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(message);
        }
    });
}

// Pulizia periodica delle partite abbandonate
setInterval(() => {
    const now = Date.now();
    activeMatches.forEach((match, matchId) => {
        if (now - match.startTime > MATCHMAKING_CONFIG.MATCH_TIMEOUT) {
            console.log(`🧹 Pulizia match scaduto: ${matchId}`);
            endMatch(matchId, 'timeout');
        }
    });
}, 60000); // Ogni minuto

const MATCHMAKING_INTERVAL_MS = 3000;

setInterval(() => {
    // Questo è il cuore del matchmaking, eseguito regolarmente
    attemptMatchmaking(); 
}, MATCHMAKING_INTERVAL_MS);

function calculateWinRate(vittorie, partite) {
    return partite > 0 ? (vittorie / partite) : 0;
}

async function sendLeaderboard(ws) {
    const MIN_MATCHES_FOR_LEADERBOARD = 10; 

    console.log('Fetching ALL players from Firestore for leaderboard...');
    
    // 1. Fetch di TUTTI i giocatori dal database
    let allPlayers;
    try {
        allPlayers = await getAllPlayersFromDB(); 
    } catch (error) {
        console.error('❌ Errore nel fetch di tutti i giocatori dal DB Admin:', error);
        ws.send(JSON.stringify({ type: 'matchmakingError', message: 'Errore interno del server (DB).' }));
        return;
    }

    // 2. Calcolo Win Rate, filtro per partite giocate e ordinamento
    const leaderboardData = allPlayers
        .map(p => {
            const partite = p.partite || 0;
            const vittorie = p.vittorie || 0;
            return {
                username: p.username,
                level: p.livello || 1, // Assumi 'livello' dal DB
                vittorie: vittorie,
                partite: partite,
                // Calcola il winRate *al volo*
                winRate: partite > 0 ? vittorie / partite : 0 
            };
        })
        .filter(p => p.partite >= MIN_MATCHES_FOR_LEADERBOARD)
        .sort((a, b) => b.winRate - a.winRate) // Ordine decrescente di WinRate
        .slice(0, 50); // Top 50

    // 3. Invio dei dati al client
    const simplifiedLeaderboard = leaderboardData.map(p => ({
        username: p.username,
        level: p.level,
        winRate: p.winRate, // Già calcolato in p
        vittorie: p.vittorie,
        partite: p.partite
    }));

    ws.send(JSON.stringify({
        type: 'leaderboardData',
        leaderboard: simplifiedLeaderboard
    }));
    console.log(`📊 Leaderboard globale inviata a un client (${leaderboardData.length} giocatori idonei).`);
}

console.log(`🚀 Server WebSocket avviato sulla porta ${port}`);
console.log(`⚔️ Sistema matchmaking attivo`);