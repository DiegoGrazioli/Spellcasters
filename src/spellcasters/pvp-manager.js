// pvp-manager.js - Gestione partite PvP integrata con main.js
import { VirtualMouseEntity, globalCollisionSystem } from "./collision-system.js";
import { triggerCameraShake, updateRedOverlay } from './damage-effects.js';

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

        this.healthPersistenceKey = null;

        this.intentionalDisconnect = false;

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
            case 'error':
                console.error('❌ Errore server:', data.message);
                break;
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
        // Aggiorna cerchio magico avversario
        this.opponent.magicCircle = data.magicCircle;
    }

    handleOpponentSpell(data) {
        // Gestisce effetti spell dell'avversario
        if (data.spellType && this.gameHooks.activeMagicParticles) {
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

    // METODI DI SINCRONIZZAZIONE CON MAIN.JS

    /**
     * Chiamato dal loop principale di main.js per sincronizzare lo stato
     */
    syncWithMainGame(gameState) {
        const now = Date.now();
        
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
        } : null;
        
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
        if (!this.isConnected || !magicCircle) return;

        const data = {
            type: 'magicCircleUpdate',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            magicCircle: {
                x: magicCircle.x,
                y: magicCircle.y,
                radius: magicCircle.radius,
                element: magicCircle.elemento,
                projections: magicCircle.projections
            },
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(data));
    }

    sendSpellCast(spellData) {
        if (!this.isConnected) return;

        const data = {
            type: 'spellCast',
            matchId: this.matchData.matchId,
            playerRole: this.playerRole,
            spellType: spellData.type,
            position: spellData.position,
            element: spellData.element,
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

    drawOpponentMagicCircle(ctx) {
        const circle = this.opponent.magicCircle;
        if (!circle) return;
        
        ctx.save();
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Tratteggiato per distinguere
        
        // Cerchio principale
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Cerchio esterno
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius + 20, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.restore();
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
}