// duel.js - Sistema di gestione partite 1v1
import * as Main from "./main.js";
import { globalCollisionSystem } from './collision-system.js';
import { getPlayerData } from './player-db.js';

export class DuelManager {
    constructor() {
        this.gameId = null;
        this.ws = null;
        this.localPlayer = null;
        this.opponent = null;
        this.gameStarted = false;
        this.gameEnded = false;
        this.playerPosition = 'left'; // 'left' o 'right'
        this.opponentSpells = new Map(); // ID spell -> spell object
        this.localSpells = new Map();
        this.canvas = document.getElementById("spellCanvas");
        this.ctx = this.canvas.getContext("2d");
        
        this.setupCanvas();
        this.setupWebSocket();
        this.parseGameParams();
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    parseGameParams() {
        const params = new URLSearchParams(window.location.search);
        this.gameId = params.get('gameId');
        this.playerPosition = params.get('position');
        this.opponentName = params.get('opponent');
        
        console.log(`Duel initialized: ${this.gameId}, Position: ${this.playerPosition}`);
    }
    
    setupWebSocket() {
        this.ws = new WebSocket('wss://spellcasters.onrender.com');
        
        this.ws.onopen = () => {
            console.log('🎮 Connected to duel server');
            this.sendPlayerJoinData();
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (e) {
                console.error('Error parsing server message:', e);
            }
        };
        
        this.ws.onclose = () => {
            console.log('🔌 Disconnected from duel server');
            if (!this.gameEnded) {
                alert('Connection lost! Returning to arena...');
                window.location.href = 'arena.html';
            }
        };
    }
    
    async sendPlayerJoinData() {
        const username = localStorage.getItem('currentPlayer');
        if (!username) return;
        
        const playerData = await getPlayerData(username);
        if (playerData) {
            this.localPlayer = {
                username: playerData.username,
                level: playerData.livello || 1,
                health: 20,
                maxHealth: 20,
                position: this.playerPosition === 'left' ? 
                    { x: 200, y: 400 } : { x: 1400, y: 400 }
            };
            
            // Informa il server che siamo pronti
            this.ws.send(JSON.stringify({
                type: 'playerReady',
                gameId: this.gameId,
                username: username
            }));
        }
    }
    
    handleServerMessage(data) {
        switch (data.type) {
            case 'gameStart':
                this.handleGameStart(data);
                break;
                
            case 'spellCast':
                this.handleOpponentSpell(data);
                break;
                
            case 'playerMove':
                this.handleOpponentMove(data);
                break;
                
            case 'playerDamaged':
                this.handlePlayerDamaged(data);
                break;
                
            case 'gameEnd':
                this.handleGameEnd(data);
                break;
                
            case 'opponentDisconnected':
                this.handleOpponentDisconnected(data);
                break;
        }
    }
    
    handleGameStart(data) {
        this.gameStarted = true;
        console.log('🚀 Duel started!');
        
        // Inizializza l'opponent
        this.opponent = {
            username: this.opponentName,
            health: 20,
            maxHealth: 20,
            position: this.playerPosition === 'left' ? 
                { x: 1400, y: 400 } : { x: 200, y: 400 }
        };
        
        // Avvia il loop di gioco
        this.startGameLoop();
        
        // Mostra messaggio di inizio
        this.showGameMessage('DUEL STARTED!', 2000);
    }
    
    handleOpponentSpell(data) {
        if (data.caster === this.localPlayer.username) return; // Nostra spell
        
        const spell = data.spell;
        
        // Crea l'oggetto spell per l'avversario
        const opponentSpell = {
            id: spell.id,
            position: { ...spell.position },
            direction: { ...spell.direction },
            damage: spell.damage,
            type: spell.type,
            owner: 'opponent',
            active: true,
            radius: 8, // Raggio per collisioni
            speed: 300
        };
        
        this.opponentSpells.set(spell.id, opponentSpell);
        globalCollisionSystem.registerEntity(opponentSpell);
        
        console.log(`Opponent cast spell: ${spell.type}`);
    }
    
    handleOpponentMove(data) {
        if (this.opponent) {
            this.opponent.position = data.position;
        }
    }
    
    handlePlayerDamaged(data) {
        if (data.playerId === this.localPlayer.username) {
            this.localPlayer.health = data.newHealth;
            this.showDamageEffect();
            console.log(`Took ${data.damage} damage! Health: ${this.localPlayer.health}`);
        } else if (this.opponent) {
            this.opponent.health = data.newHealth;
            console.log(`Opponent took ${data.damage} damage! Health: ${this.opponent.health}`);
        }
        
        this.updateHealthBars();
    }
    
    handleGameEnd(data) {
        this.gameEnded = true;
        const isWinner = data.winner === this.localPlayer.username;
        
        const message = isWinner ? 
            '🎉 VICTORY!' : '💀 DEFEAT!';
        
        this.showGameMessage(message, 5000);
        
        setTimeout(() => {
            window.location.href = 'arena.html';
        }, 5000);
    }
    
    handleOpponentDisconnected(data) {
        this.gameEnded = true;
        this.showGameMessage('🏃 Opponent Disconnected - You Win!', 3000);
        
        setTimeout(() => {
            window.location.href = 'arena.html';
        }, 3000);
    }
    
    startGameLoop() {
        const gameLoop = () => {
            if (this.gameEnded) return;
            
            this.update();
            this.render();
            
            requestAnimationFrame(gameLoop);
        };
        
        gameLoop();
    }
    
    update() {
        if (!this.gameStarted) return;
        
        const dt = 1/60; // Fixed timestep
        
        // Aggiorna spell dell'avversario
        this.opponentSpells.forEach((spell, id) => {
            if (!spell.active) {
                this.opponentSpells.delete(id);
                globalCollisionSystem.unregisterEntity(spell);
                return;
            }
            
            // Muovi la spell
            spell.position.x += spell.direction.x * spell.speed * dt;
            spell.position.y += spell.direction.y * spell.speed * dt;
            
            // Controlla collisioni con il player locale
            if (this.checkSpellPlayerCollision(spell, this.localPlayer)) {
                this.handleSpellHit(spell, this.localPlayer);
                spell.active = false;
            }
            
            // Rimuovi spell fuori schermo
            if (spell.position.x < -50 || spell.position.x > this.canvas.width + 50 ||
                spell.position.y < -50 || spell.position.y > this.canvas.height + 50) {
                spell.active = false;
            }
        });
        
        // Aggiorna spell locali (gestite da main.js ma controlliamo collisioni)
        this.checkLocalSpellCollisions();
        
        // Aggiorna sistema di collisioni
        globalCollisionSystem.update();
    }
    
    checkSpellPlayerCollision(spell, player) {
        const dx = spell.position.x - player.position.x;
        const dy = spell.position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < (spell.radius + 25); // 25 è il raggio del player
    }
    
    checkLocalSpellCollisions() {
        // Questa funzione dovrebbe essere chiamata da main.js
        // per controllare se le nostre spell colpiscono l'avversario
        if (window.localSpells && this.opponent) {
            window.localSpells.forEach(spell => {
                if (spell.owner === 'local' && 
                    this.checkSpellPlayerCollision(spell, this.opponent)) {
                    this.handleSpellHit(spell, this.opponent);
                    spell.active = false;
                }
            });
        }
    }
    
    handleSpellHit(spell, target) {
        const damage = spell.damage || 1;
        
        if (target === this.localPlayer) {
            // Noi siamo stati colpiti
            this.ws.send(JSON.stringify({
                type: 'gameAction',
                action: 'playerDamage',
                targetPlayerId: this.localPlayer.username,
                damage: damage,
                gameId: this.gameId
            }));
        } else {
            // Abbiamo colpito l'avversario
            this.ws.send(JSON.stringify({
                type: 'gameAction',
                action: 'playerDamage',
                targetPlayerId: this.opponent.username,
                damage: damage,
                gameId: this.gameId
            }));
        }
        
        console.log(`Spell hit! Damage: ${damage}`);
    }
    
    render() {
        // Pulisci canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Disegna sfondo arena
        this.drawArenaBackground();
        
        // Disegna player locale
        if (this.localPlayer) {
            this.drawPlayer(this.localPlayer, '#4CAF50'); // Verde per noi
        }
        
        // Disegna opponent
        if (this.opponent) {
            this.drawPlayer(this.opponent, '#F44336'); // Rosso per avversario
        }
        
        // Disegna spell dell'avversario
        this.opponentSpells.forEach(spell => {
            if (spell.active) {
                this.drawSpell(spell, '#FF6B6B'); // Rosso per spell nemiche
            }
        });
        
        // Disegna UI
        this.drawUI();
    }
    
    drawArenaBackground() {
        // Sfondo arena
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Linea centrale
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawPlayer(player, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(player.position.x, player.position.y, 25, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Nome del player
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.username, player.position.x, player.position.y - 35);
    }
    
    drawSpell(spell, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(spell.position.x, spell.position.y, spell.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Effetto glow
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }
    
    drawUI() {
        // Barre della vita
        this.drawHealthBar(50, 50, this.localPlayer.health, this.localPlayer.maxHealth, '#4CAF50');
        this.drawHealthBar(this.canvas.width - 250, 50, this.opponent?.health || 0, 20, '#F44336');
        
        // Nomi
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.localPlayer.username, 50, 40);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(this.opponent?.username || 'Opponent', this.canvas.width - 50, 40);
    }
    
    drawHealthBar(x, y, health, maxHealth, color) {
        const width = 200;
        const height = 20;
        const healthPercentage = health / maxHealth;
        
        // Sfondo barra
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, width, height);
        
        // Barra vita
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width * healthPercentage, height);
        
        // Bordo
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Testo vita
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${health}/${maxHealth}`, x + width/2, y + height/2 + 4);
    }
    
    showGameMessage(message, duration) {
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: bold;
            z-index: 1000;
            text-align: center;
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, duration);
    }
    
    showDamageEffect() {
        // Effetto flash rosso quando prendiamo danno
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.3);
            pointer-events: none;
            z-index: 999;
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 200);
    }
    
    updateHealthBars() {
        // Le barre vengono aggiornate nel render loop
    }
    
    // Metodi per integrare con main.js
    onSpellCast(spell) {
        if (!this.gameStarted || !this.ws) return;
        
        // Invia la spell al server
        this.ws.send(JSON.stringify({
            type: 'spellCast',
            gameId: this.gameId,
            spellType: spell.type,
            position: spell.position,
            direction: spell.direction,
            damage: spell.damage || 1
        }));
    }
    
    onPlayerMove(position) {
        if (!this.gameStarted || !this.ws) return;
        
        // Aggiorna posizione locale
        this.localPlayer.position = position;
        
        // Invia al server (con throttling)
        if (!this.lastMoveTime || Date.now() - this.lastMoveTime > 50) {
            this.ws.send(JSON.stringify({
                type: 'playerMove',
                gameId: this.gameId,
                position: position
            }));
            this.lastMoveTime = Date.now();
        }
    }
}

// Inizializza il duel manager se siamo in modalità duel
if (window.location.search.includes('mode=duel')) {
    window.duelManager = new DuelManager();
}