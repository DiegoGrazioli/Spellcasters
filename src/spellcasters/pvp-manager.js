// pvp-manager.js - Gestione partite PvP integrata con main.js
import { VirtualMouseEntity, globalCollisionSystem } from "./collision-system.js";
import { triggerCameraShake, updateRedOverlay } from './damage-effects.js';
import { drawProjectilePolygonPattern } from "./element-patterns.js";

export class PvPManager {
    constructor(gameCanvas, gameContext) {
        this.canvas = gameCanvas;
        this.ctx = gameContext;
        this.ws = null;
        this.isConnected = false;
        
        // Dati partita
        this.matchData = null;
        this.playerRole = null; // 'player1' o 'player2'
        this.opponentData = null;
        this.gameState = null;

        this.opponentEntity = null; // Entità avversaria
        
        // Hook nel sistema di gioco principale
        this.gameHooks = {
            virtualMouse: null,
            projectiles: null,
            magicCircle: null,
            playerHealth: 100,
            opponentHealth: 100,
            activeMagicParticles: null
        };
        
        // Stato sincronizzato dell'avversario
        this.opponent = {
            health: 100,
            mana: 100,
            position: { x: 0, y: 0 },
            virtualMouse: { x: 0, y: 0 },
            magicCircle: null,
            projectiles: [],
            isAlive: true,
            casting: false,
            castingPoints: []
        };
        
        // Sistema di collisione per PvP
        this.playerHitbox = { x: 0, y: 0, width: 40, height: 60 };
        this.opponentHitbox = { x: 0, y: 0, width: 40, height: 60 };
        
        // Sistemi di sincronizzazione
        this.lastUpdateSent = 0;
        this.updateInterval = 1000 / 60; // 60 FPS per sincronizzazione
        this.lastMagicCircleState = null;
        
        this.processedHits = new Set(); // Traccia hit già processati

        this.processedSpatialHits = new Set(); // Traccia hit spaziali già processati

        this.healthPersistenceKey = null;

        this.intentionalDisconnect = false;

        this.opponentCircleRotation = 0;

        this.initializePvP();

        this.setupPageUnloadHandler();
    }

    async initializePvP() {
        // Carica dati del match da localStorage
        const matchDataStr = localStorage.getItem('currentMatchData');
        if (!matchDataStr) {
            console.error('❌ Dati match non trovati');
            return;
        }

        this.matchData = JSON.parse(matchDataStr);
        this.playerRole = this.matchData.playerRole;
        this.opponentData = this.matchData.opponent;
        this.gameState = this.matchData.gameState;

        this.healthPersistenceKey = `match_health_${this.matchData.matchId}`;
        this.loadHealthFromStorage();
        
        // Imposta posizioni iniziali
        if (this.playerRole === 'player1') {
            this.opponent.position = { x: this.canvas.width - 200, y: this.canvas.height / 2 };
            this.opponent.virtualMouse = { x: this.canvas.width - 200, y: this.canvas.height / 2 };
        } else {
            this.opponent.position = { x: 200, y: this.canvas.height / 2 };
            this.opponent.virtualMouse = { x: 200, y: this.canvas.height / 2 };
        }

        

        // Connetti al server di gioco
        this.connectToGameServer();

        // Crea entità di collisione per l'avversario
        this.opponentEntity = new VirtualMouseEntity(
            this.opponent.virtualMouse.x,
            this.opponent.virtualMouse.y,
            25
        );

        this.opponentEntity.type = 'opponent';
        this.opponentEntity.mass = 0.5;
        this.opponentEntity.resistance = 0.8;

        globalCollisionSystem.registerEntity(this.opponentEntity);

        console.log(`⚔️ Partita PvP inizializzata - Ruolo: ${this.playerRole}`);
        console.log(`🎯 Avversario: ${this.opponentData.username} (Liv. ${this.opponentData.level})`);
    }

    setupPageUnloadHandler() {
        window.addEventListener('beforeunload', (event) => {
            if (this.isActive() && this.isConnected) {
                this.notifyPlayerDisconnect();
                // NON chiamare qui cleanupMatch()!
                window.location.href = 'arena.html';
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isActive() && this.isConnected) {
                this.notifyPlayerDisconnect();
            }
        });
    }

    notifyPlayerDisconnect() {
        if (!this.isConnected || !this.ws) return;
        this.intentionalDisconnect = true;
        try {
            const disconnectMessage = {
                type: 'playerDisconnect',
                matchId: this.matchData.matchId,
                playerRole: this.playerRole,
                reason: 'forfeit',
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify(disconnectMessage));
        } catch (error) {
            console.error('❌ Errore invio disconnessione:', error);
        }
    }

    loadHealthFromStorage() {
        try {
            const savedHealth = localStorage.getItem(this.healthPersistenceKey);
            if (savedHealth) {
                const healthData = JSON.parse(savedHealth);
                
                // Carica salute del player corrente
                if (healthData[this.playerRole]) {
                    this.gameHooks.playerHealth = healthData[this.playerRole];
                    console.log(`💚 Salute caricata per ${this.playerRole}: ${this.gameHooks.playerHealth}`);
                }
                
                // Carica salute dell'avversario
                const opponentRole = this.playerRole === 'player1' ? 'player2' : 'player1';
                if (healthData[opponentRole]) {
                    this.opponent.health = healthData[opponentRole];
                    console.log(`💚 Salute caricata per avversario: ${this.opponent.health}`);
                }
            } else {
                console.log('💚 Nessuna salute salvata trovata, usando valori di default');
            }
        } catch (error) {
            console.error('❌ Errore caricamento salute:', error);
        }
    }

    saveHealthToStorage() {
        try {
            const currentHealth = this.getCurrentHealthData();
            localStorage.setItem(this.healthPersistenceKey, JSON.stringify(currentHealth));
            console.log('💾 Salute salvata:', currentHealth);
        } catch (error) {
            console.error('❌ Errore salvataggio salute:', error);
        }
    }

    getCurrentHealthData() {
        const opponentRole = this.playerRole === 'player1' ? 'player2' : 'player1';
        return {
            [this.playerRole]: this.gameHooks.playerHealth,
            [opponentRole]: this.opponent.health
        };
    }

    connectToGameServer() {
        // const wsUrl = 'ws://localhost:8080'; // Usa server locale per debugging
        const wsUrl = 'wss://spellcasters.onrender.com'; // Usa server remoto per produzione
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🎮 Connesso al server di gioco');
                this.isConnected = true;

                // Prima registra il giocatore
                const registerMessage = {
                    type: 'register',
                    username: localStorage.getItem('currentPlayer'),
                    level: 1, // o prendi dal localStorage
                    timestamp: Date.now()
                };
                
                console.log('📨 Invio registrazione:', registerMessage);
                this.ws.send(JSON.stringify(registerMessage));
                
                // Poi unisciti alla partita esistente
                setTimeout(() => {
                    const joinMessage = {
                        type: 'joinMatchmaking', // o forse dovrebbe essere un tipo diverso
                        matchId: this.matchData.matchId,
                        playerRole: this.playerRole,
                        username: localStorage.getItem('currentPlayer')
                    };
                    
                    console.log('📨 Invio join partita:', joinMessage);
                    this.ws.send(JSON.stringify(joinMessage));
                }, 100);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleGameMessage(data);
                } catch (error) {
                    console.error('❌ Errore parsing messaggio gioco:', error, event.data);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ Errore WebSocket gioco:', error);
                this.isConnected = false;
            };

            this.ws.onclose = () => {
                console.log('🔌 Connessione chiusa');
                this.isConnected = false;
                if (!this.intentionalDisconnect) {
                    setTimeout(() => {
                        if (!this.isConnected && !this.intentionalDisconnect) {
                            this.connectToGameServer();
                        }
                    }, 3000);
                }
            };
            
        } catch (error) {
            console.error('❌ Errore connessione WebSocket:', error);
        }
    }

    handleGameMessage(data) {


        switch (data.type) {
            case 'gameUpdate':
                this.handleGameUpdate(data);
                break;
            case 'opponentMove':
                this.handleOpponentMove(data);
                break;
            case 'opponentCasting':
                this.handleOpponentCasting(data);
                break;
            case 'opponentProjectile':
                this.handleOpponentProjectile(data);
                break;
            case 'opponentMagicCircle':
                this.handleOpponentMagicCircle(data);
                break;
            case 'opponentSpell':
                this.handleOpponentSpell(data);
                break;
            case 'projectileHit':
                this.handleProjectileHit(data);
                break;
            case 'gameEnd':
                this.handleGameEnd(data);
                break;
            case 'playerDisconnect':
                this.handlePlayerDisconnect(data);
                break;
            case 'opponentSpellRemoval':
                this.handleOpponentSpellRemoval(data);
                break;
            case 'error':
                console.error('❌ Errore server:', data.message);
                break;
        }
    }

    handleOpponentSpellRemoval(data) {
        console.log('[DEBUG] handleOpponentSpellRemoval chiamato:', data);
        
        if (data.spellType === 'spaziale') {
            if (data.areaId) {
                // Rimuovi SOLO l'intervallo specifico con questo ID
                if (this.activeSpatialIntervals && this.activeSpatialIntervals[data.areaId]) {
                    clearInterval(this.activeSpatialIntervals[data.areaId]);
                    delete this.activeSpatialIntervals[data.areaId];
                    console.log(`🛑 [SPAZIALE] Intervallo di danno fermato per area specifica: ${data.areaId}`);
                } else {
                    console.log(`⚠️ [SPAZIALE] Nessun intervallo trovato per area: ${data.areaId}`);
                }
            } else {
                // Se non c'è areaId, rimuovi TUTTE le aree spaziali (mana esaurito o cerchio magico cancellato)
                if (this.activeSpatialIntervals) {
                    for (const [spellId, interval] of Object.entries(this.activeSpatialIntervals)) {
                        if (spellId.includes('spaziale') || spellId.startsWith('area_')) {
                            clearInterval(interval);
                            delete this.activeSpatialIntervals[spellId];
                            console.log(`🛑 [SPAZIALE] Intervallo di danno fermato (rimozione totale): ${spellId}`);
                        }
                    }
                }
                console.log(`🛑 [SPAZIALE] Tutte le aree spaziali rimosse (mana esaurito o cerchio cancellato)`);
            }
        }
    }

    handlePlayerDisconnect(data) {
        console.log('🚪 Avversario disconnesso:', data.reason);
        
        // Il giocatore corrente vince automaticamente
        this.showDisconnectionMessage();
        this.endMatch(true, 'opponent_disconnect');
    }

    showDisconnectionMessage() {
        // Mostra messaggio di vittoria per disconnessione avversario
        const message = "L'avversario si è disconnesso. Hai vinto! 🎉";
        
        // Crea overlay per il messaggio
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            z-index: 10000;
            text-align: center;
        `;
        overlay.textContent = message;
        document.body.appendChild(overlay);
        
        // Rimuovi overlay dopo 3 secondi
        setTimeout(() => {
            overlay.remove();
        }, 3000);
    }

    handleGameUpdate(data) {
        if (data.gameState) {
            this.gameState = data.gameState;
        }
    }

    handleOpponentMove(data) {
        
        const prevPosition = { ...this.opponent.virtualMouse };
        
        this.opponent.virtualMouse = data.virtualMouse;
        this.opponent.position = data.position || data.virtualMouse;
        
        // Aggiorna entità di collisione avversario
        if (this.opponentEntity) {
            // Calcola velocità per le collisioni
            const dx = this.opponent.virtualMouse.x - prevPosition.x;
            const dy = this.opponent.virtualMouse.y - prevPosition.y;
            
            this.opponentEntity.x = this.opponent.virtualMouse.x;
            this.opponentEntity.y = this.opponent.virtualMouse.y;
            this.opponentEntity.velocity.x = dx * 2; // Amplifica per effetti più visibili
            this.opponentEntity.velocity.y = dy * 2;
            
        }
        
        // Aggiorna hitbox avversario
        this.opponentHitbox.x = this.opponent.position.x - 20;
        this.opponentHitbox.y = this.opponent.position.y - 30;
    }

    handleOpponentCasting(data) {
        this.opponent.casting = data.casting;
        if (data.castingPoints) {
            this.opponent.castingPoints = data.castingPoints;
        }
    }

    handleOpponentProjectile(data) {
        // Crea proiettile avversario nel sistema di proiettili principale
        const projectile = {
            x: data.start.x,
            y: data.start.y,
            vx: data.velocity.x,
            vy: data.velocity.y,
            life: data.maxLife || 120,
            alpha: 1,
            color: data.color || 'rgba(255, 100, 100,',
            tipo: data.tipo || 'proiettile',
            owner: 'opponent', // Identifica come proiettile nemico
            element: data.element
        };
        
        // Aggiungi al sistema principale di proiettili
        if (this.gameHooks.projectiles) {
            this.gameHooks.projectiles.push(projectile);
        }
        
    }

    handleOpponentMagicCircle(data) {
        // Se data.magicCircle è null, rimuovi il cerchio magico avversario
        if (data.magicCircle === null) {
            this.opponent.magicCircle = null;
            return;
        }
        
        // Aggiorna cerchio magico avversario
        this.opponent.magicCircle = data.magicCircle;
    }

    handleOpponentSpell(data) {
    console.log('[DEBUG] handleOpponentSpell chiamato:', data);
        // Gestione magia spaziale con danno periodico
        if (data.spellType === 'spaziale' && data.position && data.polygonPoints) {
            // USA L'ID DELL'AREA invece del timestamp
            const spellId = data.areaId || `${data.spellType}_${data.timestamp}`;
            if (!this.activeSpatialIntervals) this.activeSpatialIntervals = {};

            // Se non c'è già un intervallo attivo per questa spell, crealo
            if (!this.activeSpatialIntervals[spellId]) {
                let ticks = 0;
                this.activeSpatialIntervals[spellId] = setInterval(() => {
                    const playerPos = this.gameHooks.virtualMouse;
                    
                    // Controlla se il player è dentro il poligono
                    if (this.pointInPolygon(playerPos, data.polygonPoints)) {
                        const damage = 5; // Danno per tick
                        const healthBefore = this.gameHooks.playerHealth;
                        this.gameHooks.playerHealth -= damage;
                        const healthAfter = this.gameHooks.playerHealth;

                        this.saveHealthToStorage();
                        this.showDamageEffect(damage, true);

                        console.log(`💥 [SPAZIALE][TICK] Player colpito da magia spaziale! Area: ${spellId} Tick: ${ticks} Danno: ${damage} | Vita: ${healthBefore} → ${healthAfter}`);

                        if (this.gameHooks.playerHealth <= 0) {
                            clearInterval(this.activeSpatialIntervals[spellId]);
                            delete this.activeSpatialIntervals[spellId];
                            this.endMatch(false);
                        }
                    } else {
                        console.log(`[DEBUG] Player fuori dall'area spaziale ${spellId}. Pos: ${playerPos.x},${playerPos.y}`);
                    }

                    ticks++;
                    // RIMUOVI IL LIMITE DI TEMPO
                }, 500); // Ogni 500ms
            }
        } else if (data.spellType && this.gameHooks.activeMagicParticles) {
            this.createOpponentSpellEffect(data);
        }
    }

    handleProjectileHit(data) {
        const hitId = `${data.projectileId || 'unknown'}_${data.timestamp}`;
        if (this.processedHits.has(hitId)) {
            console.log(`🔄 [SKIP] Hit già processato: ${hitId}`);
            return;
        }
        
        // Marca questo hit come processato
        this.processedHits.add(hitId);
        
        // Pulisci hits vecchi (mantieni solo gli ultimi 100)
        if (this.processedHits.size > 100) {
            const oldHits = Array.from(this.processedHits).slice(0, -50);
            oldHits.forEach(id => this.processedHits.delete(id));
        }

        if (data.target === this.playerRole) {
            const healthBefore = this.gameHooks.playerHealth;
            this.gameHooks.playerHealth -= data.damage;
            const healthAfter = this.gameHooks.playerHealth;

            console.log(`💥 [SERVER] Player colpito! ID: ${data.projectileId} | Danno: ${data.damage} | Vita: ${healthBefore} → ${healthAfter}`);

            // Salva salute aggiornata
            this.saveHealthToStorage();

            // Il giocatore locale è stato colpito
            this.showDamageEffect(data.damage, true);
            
            if (this.gameHooks.playerHealth <= 0) {
                this.endMatch(false);
            }
        } else {
            // L'avversario è stato colpito
            this.opponent.health -= data.damage;
            this.showDamageEffect(data.damage, false);
            
            // Salva salute aggiornata
            this.saveHealthToStorage();
            
            if (this.opponent.health <= 0) {
                this.endMatch(true);
            }
        }
    }

    handleGameEnd(data) {
        const won = data.winner === this.playerRole;
        this.endMatch(won);
    }

    sendSpellRemoval(spellData) {
        if (!this.isConnected) {
            console.log('[DEBUG] Non connesso, impossibile inviare rimozione spell');
            return;
        }

        const data = {
            type: 'spellRemoval',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            spellType: spellData.type,
            position: spellData.position,
            polygonPoints: spellData.polygonPoints,
            areaId: spellData.areaId, 
            timestamp: Date.now()
        };

        console.log('[DEBUG] Invio rimozione spell al server:', data);
        this.ws.send(JSON.stringify(data));
    }

    // METODI DI SINCRONIZZAZIONE CON MAIN.JS

    /**
     * Chiamato dal loop principale di main.js per sincronizzare lo stato
     */
    syncWithMainGame(gameState) {
        const now = Date.now();

        this.opponentCircleRotation += 0.003;
        
        // Aggiorna riferimenti ai sistemi di main.js
        this.gameHooks.virtualMouse = gameState.virtualMouse;
        this.gameHooks.projectiles = gameState.projectiles;
        this.gameHooks.magicCircle = gameState.magicCircle;
        this.gameHooks.activeMagicParticles = gameState.activeMagicParticles;
        
        // Invia aggiornamenti al server ogni 33ms (30 FPS)
        if (now - this.lastUpdateSent > this.updateInterval && this.isConnected) {
            this.sendPlayerUpdate(gameState);
            this.lastUpdateSent = now;
        }
        
        // Verifica collisioni con proiettili
        this.checkProjectileCollisions(gameState.projectiles);
        
        // Sincronizza cerchio magico se cambiato
        this.syncMagicCircle(gameState.magicCircle);
        
        // Sincronizza casting
        this.syncCasting(gameState.casting, gameState.castingPoints);
    }

    sendPlayerUpdate(gameState) {
        if (!this.isConnected || !gameState.virtualMouse) return;

        const updateData = {
            type: 'playerMove',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            virtualMouse: {
                x: gameState.virtualMouse.x,
                y: gameState.virtualMouse.y
            },
            position: {
                x: gameState.virtualMouse.x,
                y: gameState.virtualMouse.y
            },
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(updateData));
    }

    syncMagicCircle(magicCircle) {
        // Invia aggiornamenti del cerchio magico solo se cambiato
        const currentState = magicCircle ? {
            x: magicCircle.x,
            y: magicCircle.y,
            radius: magicCircle.radius,
            element: magicCircle.elemento,
            projections: magicCircle.projections?.length || 0
        } : null; // Gestisce il caso null

        const stateChanged = JSON.stringify(currentState) !== JSON.stringify(this.lastMagicCircleState);

        if (stateChanged && this.isConnected) {
            this.sendMagicCircleUpdate(magicCircle);
            this.lastMagicCircleState = currentState;
        }
    }

    syncCasting(casting, castingPoints) {
        if (!this.isConnected) return;
        
        // Invia stato di casting se cambiato
        if (this.lastCastingState !== casting) {
            this.ws.send(JSON.stringify({
                type: 'playerCasting',
                matchId: this.matchData.matchId,
                playerRole: this.playerRole,
                casting: casting,
                castingPoints: castingPoints || [],
                timestamp: Date.now()
            }));
            this.lastCastingState = casting;
        }
    }

    sendProjectileLaunch(projectileData) {
        if (!this.isConnected) return;

        // Calcola velocità da start e end
        const dx = projectileData.end.x - projectileData.start.x;
        const dy = projectileData.end.y - projectileData.start.y;
        const dist = Math.hypot(dx, dy);
        const speed = 16; // Stesso di main.js
        
        const velocity = {
            x: (dx / dist) * speed,
            y: (dy / dist) * speed
        };

        const data = {
            type: 'projectileLaunch',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            start: projectileData.start,
            velocity: velocity,
            color: projectileData.color,
            tipo: projectileData.tipo,
            element: projectileData.element,
            maxLife: Math.max(30, Math.floor(dist / speed)),
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(data));
        console.log(`🚀 Proiettile inviato: ${projectileData.tipo}`);
    }

    sendMagicCircleUpdate(magicCircle) {
        if (!this.isConnected) return;

        const data = {
            type: 'magicCircleUpdate',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            magicCircle: magicCircle ? {
                x: magicCircle.x,
                y: magicCircle.y,
                radius: magicCircle.radius,
                element: magicCircle.elemento,
                projections: magicCircle.projections
            } : null, // Invia null se il cerchio è stato rimosso
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(data));
    }

    sendSpellCast(spellData) {
        if (!this.isConnected) {
            console.log('[DEBUG] Non connesso, impossibile inviare spell');
            return;
        }

        const data = {
            type: 'spellCast',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            spellType: spellData.type,
            position: spellData.position,
            polygonPoints: spellData.polygonPoints, // AGGIUNGI QUESTO invece di radius
            element: spellData.element,
            areaId: spellData.areaId,
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(data));
    }

    checkProjectileCollisions(projectiles) {
        if (!projectiles || !this.opponent.isAlive) return;

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const projectile = projectiles[i];
            
            if (projectile.hit) continue;

            // Solo proiettili nemici possono danneggiare il giocatore locale
            if (projectile.owner === 'opponent') {
                if (this.isProjectileHittingPlayer(projectile, this.gameHooks.virtualMouse)) {
                    const damage = this.calculateDamage(projectile);
                    
                    console.log(`🎯 [DETECTION] Proiettile nemico colpisce il player. Danno: ${damage}`);
                    
                    projectile.hit = true;

                    // Applica danno e effetti localmente (per feedback immediato)
                    const healthBefore = this.gameHooks.playerHealth;
                    // this.gameHooks.playerHealth -= damage;
                    const healthAfter = this.gameHooks.playerHealth;
                    
                    console.log(`💥 [LOCAL] Player colpito! Danno: ${damage} | Vita: ${healthBefore} → ${healthAfter}`);
                    
                    this.showDamageEffect(damage, true);
                    triggerCameraShake(10, 250);
                    updateRedOverlay(this.gameHooks.playerHealth, 100);
                    
                    if (this.gameHooks.playerHealth <= 0) {
                        console.log("💀 [LOCAL] PLAYER MORTO!");
                        this.endMatch(false);
                    }
                    
                    // projectiles.splice(i, 1); // Rimuovi proiettile
                }
            }
            // Solo proiettili locali possono danneggiare l'avversario
            else if (projectile.owner === 'local') {
                if (this.isProjectileHittingPlayer(projectile, this.opponent.position)) {
                    const damage = this.calculateDamage(projectile);
                    // this.handleOpponentHit(projectile, damage);
                    // projectiles.splice(i, 1); // Rimuovi proiettile

                    projectile.hit = true;

                    if (this.isConnected) {
                        this.ws.send(JSON.stringify({
                            type: 'projectileHit',
                            matchId: this.matchData.matchId,
                            target: this.playerRole === 'player1' ? 'player2' : 'player1',
                            damage: damage,
                            element: projectile.element,
                            timestamp: Date.now()
                        }));
                    }
                }
            }
        }
    }

    isProjectileHittingPlayer(projectile, playerPosition) {
        const distance = Math.hypot(
            projectile.x - playerPosition.x,
            projectile.y - playerPosition.y
        );
        return distance < 30; // Raggio di collisione
    }

    calculateDamage(projectile) {
        let baseDamage = 1;
        
        // Modifica danno in base al tipo di proiezione
        switch (projectile.tipo) {
            case 'proiettile':
                baseDamage = 15;
                break;
            case 'spaziale':
                baseDamage = 2;
                break;
            default:
                baseDamage = 10;
        }
        
        // Modifica danno in base all'elemento
        if (projectile.element) {
            switch (projectile.element) {
                case 'fuoco':
                    baseDamage *= 1.3;
                    break;
                case 'acqua':
                    baseDamage *= 1.1;
                    break;
                case 'aria':
                    baseDamage *= 1.2;
                    break;
                case 'terra':
                    baseDamage *= 1.4;
                    break;
            }
        }
        
        return Math.floor(baseDamage);
    }

    handleLocalPlayerHit(projectile, damage) {
        const healthBefore = this.gameHooks.playerHealth;
        // this.gameHooks.playerHealth -= damage;
        this.showDamageEffect(damage, true);
        const healthAfter = this.gameHooks.playerHealth;
        
        console.log(`💥 [PLAYER] Colpito! Danno: ${damage} | Vita: ${healthBefore} → ${healthAfter}`);

        triggerCameraShake(10, 250);
        updateRedOverlay(this.gameHooks.playerHealth, 100);
        console.log(`💥 Colpito! Danno: ${damage}, Salute rimanente: ${this.gameHooks.playerHealth}`);
        
        if (this.gameHooks.playerHealth <= 0) {
            this.endMatch(false);
        }
    }

    handleOpponentHit(projectile, damage) {
        // this.opponent.health -= damage;
        this.showDamageEffect(damage, false);
        
        // Invia hit al server
        if (this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'projectileHit',
                matchId: this.matchData.matchId,
                target: this.playerRole === 'player1' ? 'player2' : 'player1',
                damage: damage,
                element: projectile.element,
                timestamp: Date.now()
            }));
        }
        
        console.log(`🎯 Avversario colpito! Danno: ${damage}, Salute rimanente: ${this.opponent.health}`);
        
        if (this.opponent.health <= 0) {
            this.endMatch(true);
        }
    }

    // METODI DI RENDERING INTEGRATI

    /**
     * Chiamato dal loop di rendering di main.js per disegnare elementi PvP
     */
    renderPvPElements(ctx) {
        if (!this.isActive()) return;
        
        // Disegna avversario con la stessa grafica del player ma rosso
        this.drawOpponent(ctx);
        
        // Disegna cerchio magico avversario
        if (this.opponent.magicCircle) {
            this.drawOpponentMagicCircle(ctx);
        }
        
        // Disegna casting dell'avversario
        if (this.opponent.casting && this.opponent.castingPoints) {
            this.drawOpponentCasting(ctx);
        }
    }

    drawOpponent(ctx) {
        const pos = this.opponent.virtualMouse; // Usa virtualMouse invece di position
        // Disegna virtual mouse dell'avversario IDENTICO al player ma rosso
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ff4444"; // Rosso invece di azzurro
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x - 6, pos.y);
        ctx.lineTo(pos.x + 6, pos.y);
        ctx.moveTo(pos.x, pos.y - 6);
        ctx.lineTo(pos.x, pos.y + 6);
        ctx.stroke();
        ctx.restore();
    }

    drawOpponentProjectilePattern(ctx, x, y, r, color) {
        ctx.save();
        ctx.translate(x, y);
        
        const R = r * 0.3;
        
        // Cerchio principale con colore avversario
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, 2 * Math.PI);
        ctx.lineWidth = 4.2;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        
        // Anello interno sottile
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.63, 0, 2 * Math.PI);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Anello esterno sottile
        ctx.beginPath();
        ctx.arc(0, 0, R * 1, 0, 2 * Math.PI);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Glifi magici (piccoli archi)
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI * 2 / 6) * i;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.arc(R * 0.82, 0, R * 0.1, 0, Math.PI);
            ctx.lineWidth = 1.1;
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        
        // Punti decorativi interni
        for (let i = 0; i < 8; i++) {
            let angle = (Math.PI * 2 / 8) * i;
            let px = Math.cos(angle) * r * 0.82 * 0.3;
            let py = Math.sin(angle) * r * 0.82 * 0.3;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        ctx.restore();
    }

    drawOpponentSpazialePattern(ctx, x, y, r, color, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Cerchi concentrici con colore avversario
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r * (0.2 + i * 0.15), 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.4 + i * 0.1;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Pattern di onde spaziali
        const waves = 12;
        for (let i = 0; i < waves; i++) {
            const angle = (Math.PI * 2 / waves) * i;
            ctx.save();
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.moveTo(r * 0.2, 0);
            
            // Curva ondulata
            for (let j = 0; j < 10; j++) {
                const t = j / 9;
                const waveX = r * (0.2 + t * 0.6);
                const waveY = Math.sin(t * Math.PI * 3) * r * 0.1;
                ctx.lineTo(waveX, waveY);
            }
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        
        // Centro luminoso
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.15, 0, 2 * Math.PI);
        ctx.fillStyle = color.replace(')', ', 0.3)');
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }

    drawOpponentMagicCircle(ctx) {
        const circle = this.opponent.magicCircle;
        if (!circle) return;
        
        const { x, y, radius, element } = circle;
        const thickness = 3;
        
        ctx.save();
        // Applica la stessa rotazione del player
        ctx.translate(x, y);
        ctx.rotate(this.opponentCircleRotation);
        ctx.translate(-x, -y);

        // Glow radiale per avversario
        if (element) {
            const opponentColor = this.getOpponentElementColor(element);
            const glowRadius = radius + 24;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
            grad.addColorStop(0, opponentColor + 'cc');
            grad.addColorStop(0.45, opponentColor + '44');
            grad.addColorStop(0.85, opponentColor + '11');
            grad.addColorStop(1, opponentColor + '00');
            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }

        // Pattern elementale per avversario
        if (element) {
            this.drawOpponentElementPattern(ctx, x, y, radius * 0.82, element);
        }

        // Pattern di proiezione per avversario
        let projColor = element ? this.getOpponentElementColor(element) : "#ff6666";
        if (circle.projections && circle.projections.length > 0) {
            this.drawOpponentProjectilePolygonPattern(
                ctx,
                x,
                y,
                radius * 1.2,
                circle.projections.length,
                projColor,
                -2 * this.opponentCircleRotation, // Stessa rotazione del player
                circle.projections
            );
        }

        // Cerchi principali
        ctx.lineWidth = thickness;
        ctx.strokeStyle = element ? this.getOpponentElementColor(element) : "#ff6666";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius + 20, 0, 2 * Math.PI);
        ctx.stroke();

        // Segmenti radiali (identici al player)
        ctx.lineWidth = 1;
        const numSegments = 24;
        for (let i = 0; i < numSegments; i++) {
            const angle = (2 * Math.PI / numSegments) * i;
            const innerX = x + Math.cos(angle) * radius;
            const innerY = y + Math.sin(angle) * radius;
            const outerX = x + Math.cos(angle) * (radius + 20);
            const outerY = y + Math.sin(angle) * (radius + 20);
            ctx.beginPath();
            ctx.moveTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
            ctx.stroke();
        }
        ctx.restore();

        // Particelle fluttuanti attorno al cerchio avversario (identiche al player)
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius + 10 + Math.random() * 15;
            const px = x + Math.cos(angle + this.opponentCircleRotation) * dist;
            const py = y + Math.sin(angle + this.opponentCircleRotation) * dist;
            
            if (this.gameHooks.activeMagicParticles) {
                this.gameHooks.activeMagicParticles.push({
                    x: px,
                    y: py,
                    radius: Math.random() * 1.5 + 0.5,
                    alpha: 0.1 + Math.random() * 0.1,
                    dx: (Math.random() - 0.5) * 0.3,
                    dy: (Math.random() - 0.5) * 0.3,
                    color: element ? this.getOpponentElementColor(element) + "," : "rgba(255, 102, 102,",
                });
            }
        }
    }

    drawOpponentProjectilePolygonPattern(ctx, x, y, r, count, color, rotation, tipi) {
        drawProjectilePolygonPattern(ctx, x, y, r, count, color, rotation, tipi);
    }

    getElementColor(element) {
        const colors = {
            fuoco: '#ff5555',
            acqua: '#5555ff',
            aria: '#aaaaee',
            terra: '#55aa55',
            fulmine: '#ffff55',
            luce: '#ffffff'
        };
        return colors[element] || '#ffffff';
    }

    getOpponentElementColor(element) {
        const opponentColors = {
            fuoco: '#ff8888',    // Rosso più chiaro
            acqua: '#ff6666',    // Rosso-violaceo
            aria: '#ff9999',     // Rosa-rosso
            terra: '#cc4444',    // Rosso scuro
            fulmine: '#ffaaaa',  // Rosa chiaro
            luce: '#ff7777'      // Rosso medio
        };
        return opponentColors[element] || '#ff6666';
    }

    replaceColorWithOpponent(color, element) {
        const opponentColor = this.getOpponentElementColor(element);

        // Lista dei colori da sostituire
        const elementColorMap = {
            'orange': opponentColor,
            opponentColor: opponentColor,
            '#ff5555': opponentColor,
            '#5555ff': opponentColor,
            '#aaaaee': opponentColor,
            '#55aa55': opponentColor,
            '#ffff55': opponentColor,
            '#ffffff': opponentColor
        };

        // Sostituisci se trova una corrispondenza
        for (const [original, replacement] of Object.entries(elementColorMap)) {
            if (color && color.includes && color.includes(original.replace('#', ''))) {
                return replacement;
            }
        }

        return color;
    }

    drawOpponentElementPattern(ctx, x, y, r, element) {
        // Approccio diretto: disegniamo manualmente i pattern con i colori avversario
        const opponentColor = this.getOpponentElementColor(element);

        ctx.save();
        ctx.translate(x, y);

        if (element === 'fuoco') {
            // Copia esatta del pattern fuoco da element-patterns.js ma con colore avversario
            for (let i = 0; i < 16; i++) {
                let angle = (Math.PI * 2 / 16) * i;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(r * 0.5, 0);
                ctx.lineTo(r * 0.7, Math.sin(Math.PI / 8) * r * 0.2);
                ctx.lineTo(r * 0.9, 0);
                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }

            // Cerchio piccolo centrale
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.22, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();

            // Cerchio medio
            let rMedio = (r * 0.22 + r * 0.9) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, rMedio, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();

            // Cerchio esterno che racchiude le fiamme
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.9, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Secondo cerchio esterno
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();

            // Gradiente di riempimento
            let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, opponentColor + '40');
            grad.addColorStop(0.5, opponentColor + '20');
            grad.addColorStop(1, opponentColor + '10');
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.95, 0, 2 * Math.PI);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        else if (element === 'aria') {
            // Cerchi concentrici
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, r * (0.3 + i * 0.18), 0, 2 * Math.PI);
                ctx.strokeStyle = opponentColor;
                ctx.globalAlpha = 0.5;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // Cerchio alle estremità interne delle linee radiali
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.3, 0, 2 * Math.PI);
            ctx.strokeStyle = '#aaf';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Cerchio alle estremità esterne delle linee radiali
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.81, 0, 2 * Math.PI);
            ctx.strokeStyle = '#aaf';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Linee radiali
            for (let i = 0; i < 12; i++) {
                let angle = (Math.PI * 2 / 12) * i;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3);
                ctx.lineTo(Math.cos(angle) * r * 0.84, Math.sin(angle) * r * 0.84);
                ctx.strokeStyle = '#aaf';
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // Curve a spirale
            ctx.save();
            ctx.rotate(Math.PI / 12);
            for (let s = 0; s < 3; s++) {
                ctx.beginPath();
                for (let t = 0; t < 60; t++) {
                    let theta = t * 0.2 + s * Math.PI * 2 / 3;
                    let rad = r * 0.3 + t * (r * 0.5 / 60) + Math.sin(theta * 2) * 2;
                    let px = Math.cos(theta) * rad;
                    let py = Math.sin(theta) * rad;
                    if (t === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.strokeStyle = opponentColor;
                ctx.globalAlpha = 0.7;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.restore();
            // Cerchio esterno aggiuntivo
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
            ctx.strokeStyle = '#aaf';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
        }

        else if (element === 'acqua') {
            // Pattern ondulato acqua
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, r * (0.25 + i * 0.15), 0, 2 * Math.PI);
                if (i === 1) {
                    ctx.strokeStyle = opponentColor;
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 1;
                } else {
                    ctx.strokeStyle = 'rgba(0,180,255,0.5)';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 1;
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // Onde regolari
            for (let i = 1; i <= 3; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI / 6);
                ctx.beginPath();
                for (let t = 0; t <= 64; t++) {
                    let theta = t * Math.PI * 2 / 64;
                    let rad = r * (0.35 + i * 0.13) + Math.sin(theta * 6 + i) * 7;
                    let px = Math.cos(theta) * rad;
                    let py = Math.sin(theta) * rad;
                    if (t === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
            // Piccoli glifi/gocce
            for (let i = 0; i < 10; i++) {
                let angle = (Math.PI * 2 / 10) * i + Math.PI / 10;
                let rad = r * 0.7;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.ellipse(rad, 0, 6, 3, angle, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0,200,255,0.5)';
                ctx.fill();
                ctx.restore();
            }
            // Cerchio esterno aggiuntivo
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
        }

        else if (element === 'terra') {
            // Cerchi concentrici
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, r * (0.32 + i * 0.18), 0, 2 * Math.PI);
                if (i === 2) {
                    ctx.strokeStyle = opponentColor;
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 1;
                } else {
                    ctx.strokeStyle = opponentColor;
                    ctx.globalAlpha = 0.5;
                    ctx.lineWidth = 2;
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // Pentagono centrale
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                let angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                let px = Math.cos(angle) * r * 0.38;
                let py = Math.sin(angle) * r * 0.38;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
            // Pentacolo (stelletta)
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                let angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                let px = Math.cos(angle) * r * 0.38;
                let py = Math.sin(angle) * r * 0.38;
                ctx.lineTo(px, py);
                let next = (i + 2) % 5;
                let angle2 = (Math.PI * 2 / 5) * next - Math.PI / 2;
                let px2 = Math.cos(angle2) * r * 0.38;
                let py2 = Math.sin(angle2) * r * 0.38;
                ctx.lineTo(px2, py2);
            }
            ctx.closePath();
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
            // Linee radiali
            for (let i = 0; i < 10; i++) {
                let angle = (Math.PI * 2 / 10) * i;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * r * 0.85, Math.sin(angle) * r * 0.85);
                ctx.strokeStyle = '#4a3';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            // Cerchio esterno aggiuntivo
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.97, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.stroke();
        }

        else if (element === 'fulmine') {
            // Pattern zigzag
            const rays = 12;
            for (let i = 0; i < rays; i++) {
                let angle = (Math.PI * 2 / rays) * i;
                ctx.save();
                ctx.rotate(angle);

                ctx.beginPath();
                ctx.moveTo(r * 0.2, 0);

                // Zigzag
                for (let j = 1; j <= 8; j++) {
                    let zigX = r * (0.2 + j * 0.08);
                    let zigY = (j % 2 === 0 ? 1 : -1) * r * 0.05;
                    ctx.lineTo(zigX, zigY);
                }

                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.restore();
            }

            // Cerchio centrale
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.15, 0, 2 * Math.PI);
            ctx.strokeStyle = opponentColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Archi elettrici
            for (let i = 0; i < 6; i++) {
                let angle = (Math.PI * 2 / 6) * i;
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * r * 0.6, Math.sin(angle) * r * 0.6, r * 0.1, 0, 2 * Math.PI);
                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.7;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        else if (element === 'luce') {
            // Pattern raggi
            const rays = 16;
            for (let i = 0; i < rays; i++) {
                let angle = (Math.PI * 2 / rays) * i;
                ctx.save();
                ctx.rotate(angle);

                // Raggio principale
                ctx.beginPath();
                ctx.moveTo(r * 0.1, 0);
                ctx.lineTo(r * 0.9, 0);
                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
                ctx.globalAlpha = i % 2 === 0 ? 0.8 : 0.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.restore();
            }

            // Cerchi concentrici
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, r * (0.15 + i * 0.15), 0, 2 * Math.PI);
                ctx.strokeStyle = opponentColor;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.9 - i * 0.15;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Centro luminoso
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.1, 0, 2 * Math.PI);
            ctx.fillStyle = opponentColor + '99';
            ctx.fill();
        }

        ctx.restore();
    }

    replaceColorWithOpponent(color, element) {
        const opponentColor = this.getOpponentElementColor(element);
        
        // Lista dei colori da sostituire
        const elementColorMap = {
            'orange': opponentColor,
            opponentColor: opponentColor,
            '#ff5555': opponentColor,
            '#5555ff': opponentColor,
            '#aaaaee': opponentColor,
            '#55aa55': opponentColor,
            '#ffff55': opponentColor,
            '#ffffff': opponentColor
        };
        
        // Sostituisci se trova una corrispondenza
        for (const [original, replacement] of Object.entries(elementColorMap)) {
            if (color && color.includes && color.includes(original.replace('#', ''))) {
                return replacement;
            }
        }
        
        return color;
    }

    drawOpponentCasting(ctx) {
        if (!this.opponent.castingPoints || this.opponent.castingPoints.length < 2) return;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.opponent.castingPoints[0].x, this.opponent.castingPoints[0].y);
        
        for (let i = 1; i < this.opponent.castingPoints.length; i++) {
            ctx.lineTo(this.opponent.castingPoints[i].x, this.opponent.castingPoints[i].y);
        }
        
        ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    createOpponentSpellEffect(spellData) {
        // Crea effetti visual per le spell dell'avversario
        const pos = spellData.position;
        const count = 50;
        
        for (let i = 0; i < count; i++) {
            this.gameHooks.activeMagicParticles.push({
                x: pos.x + (Math.random() - 0.5) * 40,
                y: pos.y + (Math.random() - 0.5) * 40,
                radius: Math.random() * 2 + 1,
                alpha: 0.15 + Math.random() * 0.15,
                dx: (Math.random() - 0.5) * 1.5,
                dy: (Math.random() - 0.5) * 1.5,
                color: 'rgba(255, 100, 100,',
            });
        }
    }

    showDamageEffect(damage, isLocalPlayer) {
        // Crea effetto visivo di danno
        const position = isLocalPlayer ? this.gameHooks.virtualMouse : this.opponent.virtualMouse;
        
        // Crea particelle di danno
        if (this.gameHooks.activeMagicParticles) {
            for (let i = 0; i < 15; i++) {
                this.gameHooks.activeMagicParticles.push({
                    x: position.x + (Math.random() - 0.5) * 30,
                    y: position.y + (Math.random() - 0.5) * 30,
                    radius: Math.random() * 3 + 2,
                    alpha: 0.8,
                    dx: (Math.random() - 0.5) * 3,
                    dy: (Math.random() - 0.5) * 3 - 1,
                    color: isLocalPlayer ? 'rgba(255, 100, 100,' : 'rgba(100, 255, 100,',
                });
            }
        }
        
        // Mostra testo di danno
        console.log(`${isLocalPlayer ? '💥' : '🎯'} Danno: ${damage}`);
    }

    async endMatch(won, reason = 'normal') {
        let message;
        if (reason === 'forfeit') {
            message = won ? 'Hai vinto per forfeit dell\'avversario!' : 'Hai perso per forfeit!';
        } else if (reason === 'opponent_disconnect') {
            message = 'Vittoria per disconnessione avversario! 🎉';
        } else {
            message = won ? 'Vittoria! 🎉' : 'Sconfitta! 💀';
        }
        alert(message);
        await this.updatePlayerStats(won);
        this.cleanupMatch();
        setTimeout(() => {
            window.location.href = 'arena.html';
        }, 2000);
    }

    cleanupMatch() {
        // Rimuovi dati della partita
        localStorage.removeItem('currentMatchData');
        
        // Rimuovi dati di salute della partita
        if (this.healthPersistenceKey) {
            localStorage.removeItem(this.healthPersistenceKey);
            console.log('🗑️ Dati partita puliti');
        }
        
        // Marca come disconnessione volontaria e disconnetti WebSocket
        this.intentionalDisconnect = true;
        if (this.ws) {
            this.ws.close();
            this.isConnected = false;
        }
    }

    async updatePlayerStats(won) {
        try {
            const username = localStorage.getItem('currentPlayer');
            const { loadPlayerFromDB, savePlayerData } = await import('./player-db.js');
            
            let playerData = await loadPlayerFromDB(username);
            if (!playerData) return;
            
            // Incrementa partite giocate
            const partite = (playerData.partite || 0) + 1;
            // Incrementa vittorie solo se ha vinto
            const vittorie = won ? (playerData.vittorie || 0) + 1 : (playerData.vittorie || 0);
            
            // Salva solo vittorie e partite (winRate viene calcolato dinamicamente)
            await savePlayerData(username, {
                vittorie: vittorie,
                partite: partite
            });
            
            const winRate = partite > 0 ? (vittorie / partite) : 0;
            console.log(`📊 Statistiche aggiornate: ${won ? 'Vittoria' : 'Sconfitta'} - WinRate: ${(winRate * 100).toFixed(1)}%`);
            
        } catch (error) {
            console.error('❌ Errore aggiornamento statistiche:', error);
        }
    }

    isActive() {
        return this.matchData !== null && this.isConnected;
    }

    // Metodo per ottenere stato della salute (per l'interfaccia)
    getHealthStatus() {
        return {
            playerHealth: this.gameHooks.playerHealth,
            opponentHealth: this.opponent.health
        };
    }

    pointInPolygon(point, vs) {
        const x = point.x;
        const y = point.y;
        
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
}