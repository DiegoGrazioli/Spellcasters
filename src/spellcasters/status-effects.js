// status-effects.js - Sistema modulare di effetti di stato elementali

// === CONFIGURAZIONE BILANCIAMENTO ===
export const ELEMENT_EFFECTS_CONFIG = {
    fuoco: {
        name: 'Burning',
        type: 'damage_over_time',
        damage: 1,
        interval: 0.5, // secondi
        duration: 1.5,  // secondi
        icon: '🔥',
        color: '#ff5555',
        description: 'Brucia per 1 danno ogni 0.5s per 1.5s'
    },
    acqua: {
        name: 'Slowed',
        type: 'movement_debuff',
        speedReduction: 0.2, // 20% più lento
        duration: 1.5,
        icon: '💧',
        color: '#5555ff',
        description: 'Movimento rallentato del 20% per 1.5s'
    },
    aria: {
        name: 'Confused',
        type: 'control_inversion',
        duration: 1.5,
        icon: '💨',
        color: '#aaaaee',
        description: 'Controlli invertiti per 1.5s'
    },
    terra: {
        name: 'Stunned',
        type: 'periodic_stun',
        stunDuration: 0.5,   // durata di ogni stun
        stunInterval: 0.5,   // intervallo tra stun
        duration: 1.0, // durata totale (2 stun)
        totalDuration: 1.0,  // durata totale (2 stun)
        icon: '🗿',
        color: '#55aa55',
        description: 'Impossibile muoversi per 0.5s ogni 0.5s per 2 volte'
    }
};

// === CLASSI EFFETTI ===
class StatusEffect {
    constructor(config, targetId) {
        this.id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.config = config;
        this.targetId = targetId;
        this.remainingTime = config.duration;
        this.isActive = true;
        this.createdAt = Date.now();
        
        // Timer specifici per ogni tipo di effetto
        this.nextTick = 0;
        this.lastStunTime = 0;
        this.stunCount = 0;
    }

    update(deltaTime) {
        if (!this.isActive) return false;
        
        this.remainingTime -= deltaTime;
        
        if (this.remainingTime <= 0) {
            this.deactivate();
            return false;
        }
        
        // Applica effetto specifico
        this.applyEffect(deltaTime);
        return true;
    }

    applyEffect(deltaTime) {
        // Implementazione base - verrà sovrascritta dalle classi figlie
    }

    deactivate() {
        this.isActive = false;
        this.onDeactivate();
    }

    onDeactivate() {
        // Hook per cleanup specifico dell'effetto
    }

    getDisplayInfo() {
        return {
            icon: this.config.icon,
            name: this.config.name,
            remainingTime: Math.ceil(this.remainingTime),
            color: this.config.color
        };
    }
}

class BurningEffect extends StatusEffect {
    constructor(config, targetId) {
        super(config, targetId);
        this.nextDamageTime = config.interval;
        this.nextParticleTime = 0; // ⭐ NUOVO: Timer per particelle
    }

    applyEffect(deltaTime) {
        this.nextDamageTime -= deltaTime;
        this.nextParticleTime -= deltaTime; // ⭐ NUOVO

        if (this.nextDamageTime <= 0) {
            StatusEffectManager.dealDamage(this.targetId, this.config.damage, 'burning');
            this.nextDamageTime = this.config.interval;
            StatusEffectManager.showBurningEffect(this.targetId);
        }

        // ⭐ NUOVO: Genera particelle ogni 0.1 secondi
        if (this.nextParticleTime <= 0) {
            StatusEffectManager.showDebuffParticles(this.targetId, 'fuoco');
            this.nextParticleTime = 0.1;
        }
    }
}

class SlowedEffect extends StatusEffect {
    constructor(config, targetId) {
        super(config, targetId);
        this.nextParticleTime = 0; // ⭐ NUOVO
    }

    applyEffect(deltaTime) {
        StatusEffectManager.applyMovementModifier(this.targetId, {
            speedMultiplier: 1 - this.config.speedReduction
        });

        // ⭐ NUOVO: Particelle di rallentamento
        this.nextParticleTime -= deltaTime;
        if (this.nextParticleTime <= 0) {
            StatusEffectManager.showDebuffParticles(this.targetId, 'acqua');
            this.nextParticleTime = 0.15;
        }
    }

    onDeactivate() {
        StatusEffectManager.removeMovementModifier(this.targetId);
    }
}

class ConfusedEffect extends StatusEffect {
    constructor(config, targetId) {
        super(config, targetId);
        this.nextParticleTime = 0; // ⭐ NUOVO
    }

    applyEffect(deltaTime) {
        StatusEffectManager.applyControlInversion(this.targetId, true);

        // ⭐ NUOVO: Particelle di confusione
        this.nextParticleTime -= deltaTime;
        if (this.nextParticleTime <= 0) {
            StatusEffectManager.showDebuffParticles(this.targetId, 'aria');
            this.nextParticleTime = 0.12;
        }
    }

    onDeactivate() {
        StatusEffectManager.applyControlInversion(this.targetId, false);
    }
}

class StunnedEffect extends StatusEffect {
    constructor(config, targetId) {
        super(config, targetId);
        this.isCurrentlyStunned = false;
        this.nextStunTime = 0;
        this.stunCount = 0;
        this.maxStuns = Math.floor(config.totalDuration / config.stunInterval);
        this.currentStunRemaining = 0;
        this.nextParticleTime = 0; // ⭐ NUOVO

        console.log(`🗿 Stun creato: ${this.maxStuns} stun totali ogni ${config.stunInterval}s`);
    }

    applyEffect(deltaTime) {
        if (this.stunCount >= this.maxStuns && !this.isCurrentlyStunned) {
            this.deactivate();
            return;
        }

        this.nextStunTime -= deltaTime;
        this.nextParticleTime -= deltaTime; // ⭐ NUOVO

        if (!this.isCurrentlyStunned && this.nextStunTime <= 0 && this.stunCount < this.maxStuns) {
            console.log(`🗿 Iniziando stun ${this.stunCount + 1}/${this.maxStuns}`);
            this.isCurrentlyStunned = true;
            this.currentStunRemaining = this.config.stunDuration;
            StatusEffectManager.applyStun(this.targetId, true);
            this.stunCount++;
            this.nextStunTime = this.config.stunInterval;
        }

        if (this.isCurrentlyStunned) {
            this.currentStunRemaining -= deltaTime;

            if (this.currentStunRemaining <= 0) {
                console.log(`🗿 Fine stun ${this.stunCount}/${this.maxStuns}`);
                this.isCurrentlyStunned = false;
                StatusEffectManager.applyStun(this.targetId, false);
            }
        }

        // ⭐ NUOVO: Particelle di stun più intense quando stunnato
        if (this.nextParticleTime <= 0) {
            StatusEffectManager.showDebuffParticles(this.targetId, 'terra');
            this.nextParticleTime = this.isCurrentlyStunned ? 0.05 : 0.2; // Più frequenti durante stun
        }
    }

    onDeactivate() {
        if (this.isCurrentlyStunned) {
            StatusEffectManager.applyStun(this.targetId, false);
        }
        console.log(`🗿 Effetto stun terminato completamente`);
    }
}

// === MANAGER PRINCIPALE ===
export class StatusEffectManager {
    constructor() {
        this.activeEffects = new Map(); // targetId -> Set di effetti
        this.damageCallbacks = new Map();
        this.movementCallbacks = new Map();
        this.controlCallbacks = new Map();
        this.stunCallbacks = new Map();
        this.visualCallbacks = new Map();
    }

    static showDebuffParticles(targetId, element) {
        const instance = statusEffectManager;
        const callback = instance.visualCallbacks.get(targetId);
        if (callback) callback('debuff_particles', element);
    }

    // === REGISTRAZIONE CALLBACKS ===
    registerDamageCallback(targetId, callback) {
        this.damageCallbacks.set(targetId, callback);
    }

    registerMovementCallback(targetId, callback) {
        this.movementCallbacks.set(targetId, callback);
    }

    registerControlCallback(targetId, callback) {
        this.controlCallbacks.set(targetId, callback);
    }

    registerStunCallback(targetId, callback) {
        this.stunCallbacks.set(targetId, callback);
    }

    registerVisualCallback(targetId, callback) {
        this.visualCallbacks.set(targetId, callback);
    }

    // === APPLICAZIONE EFFETTI ===
    applyElementalEffect(element, targetId) {
        const config = ELEMENT_EFFECTS_CONFIG[element];
        if (!config) {
            console.warn(`Elemento ${element} non ha effetti configurati`);
            return;
        }

        // Rimuovi effetti dello stesso tipo per evitare stack
        this.removeEffectsByType(targetId, config.type);

        let effect;
        switch (config.type) {
            case 'damage_over_time':
                effect = new BurningEffect(config, targetId);
                break;
            case 'movement_debuff':
                effect = new SlowedEffect(config, targetId);
                break;
            case 'control_inversion':
                effect = new ConfusedEffect(config, targetId);
                break;
            case 'periodic_stun':
                effect = new StunnedEffect(config, targetId);
                break;
            default:
                console.warn(`Tipo di effetto ${config.type} non implementato`);
                return;
        }

        this.addEffect(targetId, effect);
        console.log(`✨ Effetto ${config.name} applicato a ${targetId} per ${config.duration}s`);
    }

    addEffect(targetId, effect) {
        if (!this.activeEffects.has(targetId)) {
            this.activeEffects.set(targetId, new Set());
        }
        this.activeEffects.get(targetId).add(effect);
    }

    removeEffectsByType(targetId, type) {
        const effects = this.activeEffects.get(targetId);
        if (!effects) return;

        for (const effect of effects) {
            if (effect.config.type === type) {
                effect.deactivate();
                effects.delete(effect);
            }
        }
    }

    // === UPDATE LOOP ===
    update(deltaTime) {
        for (const [targetId, effects] of this.activeEffects) {
            for (const effect of effects) {
                if (!effect.update(deltaTime)) {
                    effects.delete(effect);
                }
            }
            
            // Pulisci set vuoti
            if (effects.size === 0) {
                this.activeEffects.delete(targetId);
            }
        }
    }

    // === CALLBACK HANDLERS ===
    static dealDamage(targetId, damage, source) {
        const instance = statusEffectManager;
        const callback = instance.damageCallbacks.get(targetId);
        if (callback) callback(damage, source);
    }

    static applyMovementModifier(targetId, modifier) {
        const instance = statusEffectManager;
        const callback = instance.movementCallbacks.get(targetId);
        if (callback) callback(modifier);
    }

    static removeMovementModifier(targetId) {
        const instance = statusEffectManager;
        const callback = instance.movementCallbacks.get(targetId);
        if (callback) callback({ speedMultiplier: 1 });
    }

    static applyControlInversion(targetId, inverted) {
        const instance = statusEffectManager;
        const callback = instance.controlCallbacks.get(targetId);
        if (callback) callback(inverted);
    }

    static applyStun(targetId, stunned) {
        const instance = statusEffectManager;
        const callback = instance.stunCallbacks.get(targetId);
        if (callback) callback(stunned);
    }

    static showBurningEffect(targetId) {
        const instance = statusEffectManager;
        const callback = instance.visualCallbacks.get(targetId);
        if (callback) callback('burning');
    }

    // === QUERY EFFETTI ===
    getActiveEffects(targetId) {
        return this.activeEffects.get(targetId) || new Set();
    }

    hasEffect(targetId, effectType) {
        const effects = this.getActiveEffects(targetId);
        for (const effect of effects) {
            if (effect.config.type === effectType) return true;
        }
        return false;
    }

    getEffectsForDisplay(targetId) {
        const effects = this.getActiveEffects(targetId);
        return Array.from(effects).map(effect => effect.getDisplayInfo());
    }

    // === PULIZIA ===
    clearAllEffects(targetId) {
        const effects = this.activeEffects.get(targetId);
        if (effects) {
            for (const effect of effects) {
                effect.deactivate();
            }
            this.activeEffects.delete(targetId);
        }
    }

    clearAllTargets() {
        for (const targetId of this.activeEffects.keys()) {
            this.clearAllEffects(targetId);
        }
    }
}

// === ISTANZA GLOBALE ===
export const statusEffectManager = new StatusEffectManager();

// === FUNZIONI DI UTILITÀ ===
export function applyElementalHit(element, targetId) {
    statusEffectManager.applyElementalEffect(element, targetId);
}

export function updateStatusEffects(deltaTime) {
    statusEffectManager.update(deltaTime);
}

export function clearPlayerEffects(playerId) {
    statusEffectManager.clearAllEffects(playerId);
}

// === CONFIGURAZIONE FACILE PER BILANCIAMENTO ===
export function updateElementConfig(element, newConfig) {
    if (ELEMENT_EFFECTS_CONFIG[element]) {
        Object.assign(ELEMENT_EFFECTS_CONFIG[element], newConfig);
        console.log(`⚖️ Configurazione ${element} aggiornata:`, newConfig);
    }
}

// Esempi per future modifiche di bilanciamento:
/*
// Nerf del fuoco (meno danno)
updateElementConfig('fuoco', { damage: 0.5 });
*/
// Buff dell'acqua (più durata)
updateElementConfig('acqua', { speedReduction: 0.6 });


// Modifica aria (durata più corta)
// updateElementConfig('aria', { duration: 1.0 });

// Nerf terra (meno stun)
updateElementConfig('terra', { totalDuration: 1.5, duration: 1.5 });


function createDebuffParticles(targetId, effectType, position) {
    const instance = statusEffectManager;
    const callback = instance.visualCallbacks.get(targetId);
    if (callback) callback(effectType, position);
}

export function createElementalDebuffParticles(element, position, activeMagicParticles) {
    if (!activeMagicParticles) return;

    const count = 8; // Meno particelle per i debuff (più sottili)

    switch (element) {
        case 'fuoco':
            // Particelle di fuoco che circondano il giocatore
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const radius = 25 + Math.sin(Date.now() * 0.01 + i) * 5;
                activeMagicParticles.push({
                    x: position.x + Math.cos(angle) * radius,
                    y: position.y + Math.sin(angle) * radius,
                    radius: Math.random() * 2 + 1,
                    alpha: 0.4 + Math.random() * 0.3,
                    dx: (Math.random() - 0.5) * 0.5,
                    dy: Math.random() * -1 - 0.5,
                    color: `rgba(255, ${50 + Math.random() * 50}, 0, `,
                });
            }
            break;

        case 'acqua':
            // Particelle che cadono dall'alto (effetto pioggia)
            for (let i = 0; i < count; i++) {
                activeMagicParticles.push({
                    x: position.x + (Math.random() - 0.5) * 50,
                    y: position.y - 30 + Math.random() * 10,
                    radius: Math.random() * 2 + 1,
                    alpha: 0.5 + Math.random() * 0.3,
                    dx: (Math.random() - 0.5) * 0.3,
                    dy: Math.random() * 2 + 1,
                    color: `rgba(${100 + Math.random() * 50}, ${150 + Math.random() * 100}, 255, `,
                });
            }
            break;

        case 'aria':
            // Particelle che ruotano in modo confuso
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 2 + 1;
                activeMagicParticles.push({
                    x: position.x + (Math.random() - 0.5) * 30,
                    y: position.y + (Math.random() - 0.5) * 30,
                    radius: Math.random() * 1.5 + 0.5,
                    alpha: 0.4 + Math.random() * 0.2,
                    dx: Math.cos(angle) * speed,
                    dy: Math.sin(angle) * speed,
                    color: `rgba(170, 170, 238, `,
                    swirl: Math.random() * 0.3 + 0.1
                });
            }
            break;

        case 'terra':
            // Particelle che vibrano in posizione (effetto tremore)
            for (let i = 0; i < count * 1.5; i++) {
                activeMagicParticles.push({
                    x: position.x + (Math.random() - 0.5) * 40,
                    y: position.y + (Math.random() - 0.5) * 40,
                    radius: Math.random() * 3 + 1,
                    alpha: 0.6 + Math.random() * 0.3,
                    dx: (Math.random() - 0.5) * 1,
                    dy: (Math.random() - 0.5) * 1,
                    color: `rgba(${180 + Math.random() * 40}, ${160 + Math.random() * 30}, ${100 + Math.random() * 40}, `,
                    baseX: position.x,
                    baseY: position.y,
                    vibrateSpeed: Math.random() * 0.2 + 0.1
                });
            }
            break;
    }
}