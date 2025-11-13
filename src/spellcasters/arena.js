// arena.js - Sistema client per matchmaking e duelli
import { getPlayerData, savePlayerData } from './player-db.js';

class ArenaManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.currentMatch = null;
        this.playerData = null;
        this.isConnected = false;
        this.matchmakingStatus = 'idle'; // idle, searching, found, in_game
        
        this.initializeUI();
        this.connectToServer();
    }

    async initializeUI() {
        // 1. Verifica l'username in localStorage
        const username = localStorage.getItem('currentPlayer');
        
        if (username) {
            console.log(`👤 Trovato utente in localStorage: ${username}. Tentativo di fetch da Firebase...`);
            this.updateStatusMessage(`Caricamento dati per ${username}...`);

            try { 
                // 2. Tenta di recuperare i dati dal DB
                this.playerData = await getPlayerData(username);
                
                if (this.playerData) {
                    // 3. Successo: i dati sono stati caricati
                    console.log('✅ Dati utente caricati con successo:', this.playerData);
                    document.getElementById('name-value').textContent = this.playerData.username;
                    document.getElementById('level-value').textContent = this.playerData.livello || 1;
                    
                    this.updatePlayerStats();
                    this.updateStatusMessage('Dati utente caricati. Connessione al server...');
                } else {
                    // 4. Utente non trovato nel DB
                    console.error(`❌ ERRORE: Nessun documento trovato in Firestore per l'utente "${username}".`);
                    this.updateStatusMessage(`Utente non trovato nel database! Accesso necessario.`);
                    // Potresti aggiungere qui una logica per reindirizzare l'utente
                }
            } catch (error) {
                // 5. Errore di connessione o autenticazione Firebase
                console.error('❌ ERRORE CRITICO nel recupero dati utente (Firebase/player-db.js):', error);
                this.updateStatusMessage('Errore di connessione al database. Controlla la Console.');
            }
        } else {
             // 6. Username mancante in localStorage
             console.error('❌ ERRORE: Chiave "currentPlayer" mancante in localStorage.');
             this.updateStatusMessage('Accesso non effettuato. Ritorna alla Home per accedere.');
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Inizializza tema
        this.initArenaTheme();
    }

    updatePlayerStats() {
        const statsContainer = document.getElementById('player-stats');
        if (!statsContainer) {
            // Crea container statistiche se non esiste
            const playerInfo = document.getElementById('player-info');
            const stats = document.createElement('div');
            stats.id = 'player-stats';
            stats.innerHTML = `
                <h3>Statistiche PvP</h3>
                <p>Partite giocate: <span id="total-matches">0</span></p>
                <p>Vittorie: <span id="total-wins">0</span></p>
                <p>Win Rate: <span id="win-rate">0%</span></p>
            `;
            playerInfo.appendChild(stats);
        }

        const totalMatches = this.playerData.partite || 0;
        const winRate = this.playerData.vittorie/this.playerData.partite || 0;
        const totalWins = Math.floor(totalMatches * winRate);

        document.getElementById('total-matches').textContent = totalMatches;
        document.getElementById('total-wins').textContent = totalWins;
        document.getElementById('win-rate').textContent = `${(winRate * 100).toFixed(1)}%`;
    }

    setupEventListeners() {
        // Pulsante matchmaking
        const matchmakingBtn = document.getElementById('matchmaking-btn');
        matchmakingBtn.addEventListener('click', () => {
            this.toggleMatchmaking();
        });

        // Pulsante home
        document.getElementById('home-btn').addEventListener('click', () => {
            this.leaveMatchmaking();
            window.location.href = 'home.html';
        });

        // Pulsante training
        document.getElementById('training-btn').addEventListener('click', () => {
            window.location.href = 'game.html?mode=training';
        });

        document.getElementById('open-leaderboard-btn').addEventListener('click', () => {
            this.showLeaderboard();
        });

        document.getElementById('close-leaderboard-btn').addEventListener('click', () => {
            this.hideLeaderboard();
        });

        // Scorciatoie tastiera
        window.addEventListener('keydown', (e) => {
            if (e.key === 'n' || e.key === 'N') this.setArenaTheme('night');
            if (e.key === 'g' || e.key === 'G') this.setArenaTheme('day');
        });

        // Gestione chiusura pagina
        window.addEventListener('beforeunload', () => {
            this.leaveMatchmaking();
            if (this.ws) {
                this.ws.close();
            }
        });
    }

    connectToServer() {
        const wsUrl = 'wss://spellcasters.onrender.com'; // O localhost per development
        // const wsUrl = 'ws://localhost:8080'; // Cambia con il tuo server WebSocket
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ Connesso al server arena');
                this.isConnected = true;
                this.registerPlayer();
                this.updateConnectionStatus('Connesso');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleServerMessage(data);
                } catch (error) {
                    console.error('❌ Errore parsing messaggio server:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ Errore WebSocket:', error);
                this.updateConnectionStatus('Errore connessione');
            };

            this.ws.onclose = () => {
                console.log('🔌 Connessione chiusa');
                this.isConnected = false;
                this.updateConnectionStatus('Disconnesso');
                this.updateOnlineCount(0);
                
                // Riprova la connessione dopo 5 secondi
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.connectToServer();
                    }
                }, 5000);
            };

        } catch (error) {
            console.error('❌ Errore creazione WebSocket:', error);
            this.updateConnectionStatus('Impossibile connettersi');
        }
    }

    registerPlayer() {
        if (!this.ws || !this.playerData) {
            console.error('❌ Impossibile registrare: ws o playerData mancanti', {
                ws: !!this.ws,
                playerData: !!this.playerData
            });
            return;
        }

        const registrationData = {
            type: 'register',
            username: this.playerData.username,
            level: this.playerData.livello || 1,
            winRate: this.playerData.vittorie/this.playerData.partite || 0,
            totalMatches: this.playerData.partite || 0
        };

        console.log('📤 Invio registrazione:', registrationData);
        this.ws.send(JSON.stringify(registrationData));
    }

    handleServerMessage(data) {
        console.log('📨 Messaggio dal server:', data);
        
        switch (data.type) {
            case 'registered':
                this.playerId = data.playerId;
                console.log('✅ Registrato sul server con ID:', this.playerId);
                this.updateStatusMessage('Registrato - Pronto per il matchmaking');
                break;

            case 'onlinePlayers':
                this.updateOnlineCount(data.count);
                break;

            case 'matchmakingJoined':
                this.matchmakingStatus = 'searching';
                this.updateMatchmakingUI();
                this.updateStatusMessage(`In coda... Posizione: ${data.queuePosition}`);
                break;

            case 'matchmakingLeft':
                this.matchmakingStatus = 'idle';
                this.updateMatchmakingUI();
                this.updateStatusMessage('Ricerca annullata');
                break;

            case 'matchFound':
                this.handleMatchFound(data);
                break;

            case 'matchmakingError':
                console.error('❌ Errore matchmaking dal server:', data.message);
                this.updateStatusMessage(`Errore: ${data.message}`);
                this.matchmakingStatus = 'idle';
                this.updateMatchmakingUI();
                break;
            
            case 'playerCounts':
                this.updateOnlineCount(data.totalOnline);
                this.updateReadyCount(data.playersReady);
                break;

            case 'leaderboardData':
                this.renderLeaderboard(data.leaderboard);
                break;

            default:
                console.log('📨 Messaggio server non gestito:', data.type);
        }
    }

    updateReadyCount(count) {
        const element = document.getElementById('ready-players-count');
        if (element) {
            element.textContent = count;
        }
    }

    handleMatchFound(data) {
        this.currentMatch = data.matchId;
        this.matchmakingStatus = 'found';
        
        const opponent = data.opponent;
        this.updateStatusMessage(`Match trovato! Avversario: ${opponent.username} (Liv. ${opponent.level})`);
        
        // Mostra informazioni match per qualche secondo prima di iniziare
        setTimeout(() => {
            this.startMatch(data);
        }, 3000);
    }

    startMatch(matchData) {
        // Salva i dati del match in localStorage per la pagina di gioco
        localStorage.setItem('currentMatchData', JSON.stringify({
            matchId: matchData.matchId,
            opponent: matchData.opponent,
            gameState: matchData.gameState,
            playerRole: matchData.playerRole,
            mode: 'pvp'
        }));

        // Naviga alla pagina di gioco
        window.location.href = 'game.html?mode=pvp';
    }

    toggleMatchmaking() {
        if (!this.isConnected) {
            this.updateStatusMessage('Errore: non connesso al server');
            return;
        }

        if (!this.playerData) {
            this.updateStatusMessage('Errore: dati giocatore non caricati');
            return;
        }

        if (!this.playerId) {
            this.updateStatusMessage('Errore: non registrato sul server. Attendi...');
            // Riprova la registrazione
            setTimeout(() => {
                if (this.ws && this.playerData) {
                    this.registerPlayer();
                }
            }, 1000);
            return;
        }

        if (this.matchmakingStatus === 'idle') {
            this.joinMatchmaking();
        } else if (this.matchmakingStatus === 'searching') {
            this.leaveMatchmaking();
        }
    }

    joinMatchmaking() {
        if (!this.playerId) {
            console.error('❌ Tentativo di matchmaking senza essere registrati');
            this.updateStatusMessage('Errore: non registrato sul server');
            return;
        }

        const matchmakingData = {
            type: 'joinMatchmaking',
            level: this.playerData.livello || 1,
            winRate: this.playerData.vittorie/this.playerData.partite || 0,
            totalMatches: this.playerData.partite || 0
        };

        console.log('📤 Invio richiesta matchmaking:', matchmakingData);
        this.ws.send(JSON.stringify(matchmakingData));
        this.updateStatusMessage('Entrando in coda...');
    }

    leaveMatchmaking() {
        if (this.matchmakingStatus === 'searching') {
            this.ws.send(JSON.stringify({ type: 'leaveMatchmaking' }));
        }
    }

    updateMatchmakingUI() {
        const btn = document.getElementById('matchmaking-btn');
        
        switch (this.matchmakingStatus) {
            case 'idle':
                btn.textContent = 'Cerca Partita';
                btn.disabled = false;
                break;
            case 'searching':
                btn.textContent = 'Annulla Ricerca';
                btn.disabled = false;
                break;
            case 'found':
                btn.textContent = 'Match Trovato!';
                btn.disabled = true;
                break;
            case 'in_game':
                btn.textContent = 'In Partita';
                btn.disabled = true;
                break;
        }
    }

    updateStatusMessage(message) {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateConnectionStatus(status) {
        // Aggiungi indicatore di connessione se non esiste
        let indicator = document.getElementById('connection-status');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'connection-status';
            indicator.className = 'connection-indicator';
            document.getElementById('arena-container').appendChild(indicator);
        }
        
        indicator.textContent = `Stato: ${status}`;
        indicator.className = `connection-indicator ${
            status === 'Connesso' ? 'connected' : 'disconnected'
        }`;
    }

    updateOnlineCount(count) {
        const element = document.getElementById('online-players-count');
        if (element) {
            element.textContent = count;
        }
    }

    setArenaTheme(mode) {
        const theme = mode === 'night' ? 'night' : 'day';
        document.body.classList.remove('day', 'night');
        document.body.classList.add(theme);
        localStorage.setItem('mode', theme);
    }

    initArenaTheme() {
        const saved = localStorage.getItem('mode');
        this.setArenaTheme(saved === 'night' ? 'night' : 'day');
    }

    showLeaderboard() {
        if (!this.isConnected) {
            this.updateStatusMessage('Non connesso al server per la classifica.');
            return;
        }
        // Attiva la classe CSS che sposta la visualizzazione
        document.body.classList.add('show-leaderboard');
        
        // Richiedi i dati aggiornati al server
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'requestLeaderboard' }));
            console.log("📤 Richiesta leaderboard inviata");
        } else {
            console.warn("⚠️ WebSocket non ancora aperto, riprovo tra un attimo...");
            setTimeout(() => this.requestLeaderboard(), 300);
        }
        this.updateStatusMessage('Caricamento classifica PvP...');
    }

    hideLeaderboard() {
        // Rimuove la classe CSS per tornare alla vista principale
        document.body.classList.remove('show-leaderboard');
    }

    renderLeaderboard(leaderboard) {
        const listContainer = document.getElementById('leaderboard-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = ''; // Pulisci la lista precedente
        this.updateStatusMessage('Classifica aggiornata');

        if (leaderboard.length === 0) {
            listContainer.innerHTML = '<p>Ancora nessun giocatore idoneo in classifica.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'leaderboard-list';
        
        ul.innerHTML = `
            <li class="header">
                <span class="rank">#</span>
                <span class="name">Giocatore</span>
                <span class="winrate">Win Rate</span>
                <span class="wins">Vittorie</span>
                <span class="matches">Partite</span>
            </li>
        `;
        
        leaderboard.forEach((player, index) => {
            const li = document.createElement('li');
            const winRatePercent = (player.winRate * 100).toFixed(1);
        
            li.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${player.username} (Liv. ${player.level})</span>
                <span class="winrate">${winRatePercent}%</span>
                <span class="wins">${player.vittorie || 0}</span>
                <span class="matches">${player.partite}</span>
            `;
        
            // Evidenzia il proprio record
            if (this.playerData && this.playerData.username === player.username) {
                li.classList.add('my-rank');
            }
        
            // Colorazioni per i primi 3
            if (index === 0) {
                li.classList.add('gold-rank'); // Dorato
            } else if (index === 1) {
                li.classList.add('silver-rank'); // Argento
            } else if (index === 2) {
                li.classList.add('bronze-rank'); // Bronzo
            }
        
            ul.appendChild(li);
        });

        listContainer.appendChild(ul);
    }
}

// Inizializza l'arena manager quando la pagina è caricata
window.addEventListener('DOMContentLoaded', () => {
    new ArenaManager();
});

// Funzioni globali per retrocompatibilità
function startTrainingMode() {
    window.location.href = 'game.html?mode=training';
}

// Export per uso esterno se necessario
export { ArenaManager };