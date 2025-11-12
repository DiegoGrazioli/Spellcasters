// audio-manager.js - Gestione SFX per Spellcasters

class AudioManager {
    constructor() {
        // Inizializza il contesto audio se non esiste
        this.audioContext = null;
        this.initAudioContext();

        // Stato globale per l'audio
        this.enabled = true;
        this.globalVolume = 1.0; // Volume generale (0.0 a 1.0)

        // Buffer audio caricati
        this.audioBuffers = new Map();

        // Sorgenti attive (per gestire loop e stop)
        this.activeSources = new Map(); // key: 'id', value: AudioBufferSourceNode

        this.globalVolume = this.loadGlobalVolume();
        window.addEventListener('storage', (e) => {
            if (e.key === 'audioVolume') {
                this.globalVolume = this.loadGlobalVolume();
                console.log(`🔊 AudioManager: Volume globale aggiornato a ${this.globalVolume}`);
            }
        });

        // Tipi di suoni definiti
        this.soundTypes = {
            // --- Suoni Attuali ---
            MAGIC_CIRCLE_ACTIVE: 'magic_circle_active',
            PROJECTILE_NEUTRAL: 'projectile_neutral',
            PROJECTILE_FUOCO: 'projectile_fuoco',
            PROJECTILE_ACQUA: 'projectile_acqua',
            PROJECTILE_ARIA: 'projectile_aria',
            PROJECTILE_TERRA: 'projectile_terra',
            // --- Suoni Futuri ---
            SPELL_SPATIAL_NEUTRAL: 'spell_spatial_neutral',
            SPELL_SPATIAL_FUOCO: 'spell_spatial_fuoco',
            SPELL_SPATIAL_ACQUA: 'spell_spatial_acqua',
            SPELL_SPATIAL_ARIA: 'spell_spatial_aria',
            SPELL_SPATIAL_TERRA: 'spell_spatial_terra',
            SPELL_FUOCO: 'spell_fuoco',
            SPELL_ACQUA: 'spell_acqua',
            SPELL_ARIA: 'spell_aria',
            SPELL_TERRA: 'spell_terra',
            COLLISION_1: 'collision_1',
            COLLISION_2: 'collision_2',
            COLLISION_3: 'collision_3',
            COLLISION_4: 'collision_4',
            DRAW_1: 'draw_1',
            DRAW_2: 'draw_2',
            DRAW_3: 'draw_3',
            DRAW_4: 'draw_4',
            DRAW_5: 'draw_5',
            DRAW_6: 'draw_6',
            DRAW_7: 'draw_7',
            DRAW_8: 'draw_8',
            DRAW_9: 'draw_9',
            DRAW_10: 'draw_10',
            DRAW_11: 'draw_11',
            DRAW_12: 'draw_12',
            DRAW_13: 'draw_13',
            DRAW_14: 'draw_14',
            DRAW_15: 'draw_15',
            DRAW_16: 'draw_16',
            DRAW_17: 'draw_17',
            DRAW_18: 'draw_18',
            DRAW_19: 'draw_19',
            DRAW_20: 'draw_20',
            DRAW_21: 'draw_21',
            DRAW_22: 'draw_22',
            DRAW_23: 'draw_23',
            DRAW_24: 'draw_24',
            DRAW_25: 'draw_25',
            DRAW_26: 'draw_26',
            DRAW_27: 'draw_27',
            DRAW_28: 'draw_28',
            DRAW_29: 'draw_29',
            DRAW_30: 'draw_30',
            DRAW_31: 'draw_31',
            DRAW_32: 'draw_32',
            DRAW_33: 'draw_33',
            DRAW_34: 'draw_34',
            DRAW_35: 'draw_35',
            DRAW_36: 'draw_36',
            DRAW_37: 'draw_37',
            DRAW_38: 'draw_38',
            DRAW_39: 'draw_39',
            DRAW_40: 'draw_40',
        };

        // Mappatura dei suoni ai file audio (da aggiornare con i percorsi reali)
        this.soundFiles = {
            // [ES: 'nome_sfx']: 'path/to/audio/file.wav'
            // --- ATTUALI ---
            [this.soundTypes.MAGIC_CIRCLE_ACTIVE]: '/src/sound/sfx/magic circle.wav', // Esempio
            [this.soundTypes.PROJECTILE_NEUTRAL]: '/src/sound/sfx/proj/right neutral swoosh.wav',
            [this.soundTypes.PROJECTILE_FUOCO]: '/src/sound/sfx/proj/right fire swoosh.wav',
            [this.soundTypes.PROJECTILE_ACQUA]: '/src/sound/sfx/proj/right water swoosh.wav',
            [this.soundTypes.PROJECTILE_ARIA]: '/src/sound/sfx/proj/right air swoosh.wav',
            [this.soundTypes.PROJECTILE_TERRA]: '/src/sound/sfx/proj/right earth swoosh.wav',
            // --- FUTURI ---
            [this.soundTypes.SPELL_SPATIAL_NEUTRAL]: '/src/sound/sfx/hold/spell_spatial_neutral.wav',
            [this.soundTypes.SPELL_SPATIAL_FUOCO]: '/src/sound/sfx/hold/fire hold.wav',
            [this.soundTypes.SPELL_SPATIAL_ACQUA]: '/src/sound/sfx/hold/water hold.wav',
            [this.soundTypes.SPELL_SPATIAL_ARIA]: '/src/sound/sfx/hold/air hold.wav',
            [this.soundTypes.SPELL_SPATIAL_TERRA]: '/src/sound/sfx/hold/earth hold.wav',
            [this.soundTypes.SPELL_FUOCO]: '/src/sound/sfx/simple/fire single.wav',
            [this.soundTypes.SPELL_ACQUA]: '/src/sound/sfx/simple/water single.wav',
            [this.soundTypes.SPELL_ARIA]: '/src/sound/sfx/simple/air single.wav',
            [this.soundTypes.SPELL_TERRA]: '/src/sound/sfx/simple/earth single.wav',
            [this.soundTypes.COLLISION_1]: '/src/sound/sfx/blade to blade/0.wav',
            [this.soundTypes.COLLISION_2]: '/src/sound/sfx/blade to blade/289.wav',
            [this.soundTypes.COLLISION_3]: '/src/sound/sfx/blade to blade/m193.wav',
            [this.soundTypes.COLLISION_4]: '/src/sound/sfx/blade to blade/m648.wav',
            [this.soundTypes.DRAW_1]: '/src/sound/sfx/draw/untitled - Track 1_2.wav',
            [this.soundTypes.DRAW_2]: '/src/sound/sfx/draw/untitled - Track 2.wav',
            [this.soundTypes.DRAW_3]: '/src/sound/sfx/draw/untitled - Track 3.wav',
            [this.soundTypes.DRAW_4]: '/src/sound/sfx/draw/untitled - Track 4.wav',
            [this.soundTypes.DRAW_5]: '/src/sound/sfx/draw/untitled - Track 5.wav',
            [this.soundTypes.DRAW_6]: '/src/sound/sfx/draw/untitled - Track 6.wav',
            [this.soundTypes.DRAW_7]: '/src/sound/sfx/draw/untitled - Track 7.wav',
            [this.soundTypes.DRAW_8]: '/src/sound/sfx/draw/untitled - Track 8.wav',
            [this.soundTypes.DRAW_9]: '/src/sound/sfx/draw/untitled - Track 9.wav',
            [this.soundTypes.DRAW_10]: '/src/sound/sfx/draw/untitled - Track 10.wav',
            [this.soundTypes.DRAW_11]: '/src/sound/sfx/draw/untitled - Track 11.wav',
            [this.soundTypes.DRAW_12]: '/src/sound/sfx/draw/untitled - Track 12.wav',
            [this.soundTypes.DRAW_13]: '/src/sound/sfx/draw/untitled - Track 13.wav',
            [this.soundTypes.DRAW_14]: '/src/sound/sfx/draw/untitled - Track 14.wav',
            [this.soundTypes.DRAW_15]: '/src/sound/sfx/draw/untitled - Track 15.wav',
            [this.soundTypes.DRAW_16]: '/src/sound/sfx/draw/untitled - Track 16.wav',
            [this.soundTypes.DRAW_17]: '/src/sound/sfx/draw/untitled - Track 17.wav',
            [this.soundTypes.DRAW_18]: '/src/sound/sfx/draw/untitled - Track 18.wav',
            [this.soundTypes.DRAW_19]: '/src/sound/sfx/draw/untitled - Track 19.wav',
            [this.soundTypes.DRAW_20]: '/src/sound/sfx/draw/untitled - Track 20.wav',
            [this.soundTypes.DRAW_21]: '/src/sound/sfx/draw/untitled - Track 21.wav',
            [this.soundTypes.DRAW_22]: '/src/sound/sfx/draw/untitled - Track 22.wav',
            [this.soundTypes.DRAW_23]: '/src/sound/sfx/draw/untitled - Track 23.wav',
            [this.soundTypes.DRAW_24]: '/src/sound/sfx/draw/untitled - Track 24.wav',
            [this.soundTypes.DRAW_25]: '/src/sound/sfx/draw/untitled - Track 25.wav',
            [this.soundTypes.DRAW_26]: '/src/sound/sfx/draw/untitled - Track 26.wav',
            [this.soundTypes.DRAW_27]: '/src/sound/sfx/draw/untitled - Track 27.wav',
            [this.soundTypes.DRAW_28]: '/src/sound/sfx/draw/untitled - Track 28.wav',
            [this.soundTypes.DRAW_29]: '/src/sound/sfx/draw/untitled - Track 29.wav',
            [this.soundTypes.DRAW_30]: '/src/sound/sfx/draw/untitled - Track 30.wav',
            [this.soundTypes.DRAW_31]: '/src/sound/sfx/draw/untitled - Track 31.wav',
            [this.soundTypes.DRAW_32]: '/src/sound/sfx/draw/untitled - Track 32.wav',
            [this.soundTypes.DRAW_33]: '/src/sound/sfx/draw/untitled - Track 33.wav',
            [this.soundTypes.DRAW_34]: '/src/sound/sfx/draw/untitled - Track 34.wav',
            [this.soundTypes.DRAW_35]: '/src/sound/sfx/draw/untitled - Track 35.wav',
            [this.soundTypes.DRAW_36]: '/src/sound/sfx/draw/untitled - Track 36.wav',
            [this.soundTypes.DRAW_37]: '/src/sound/sfx/draw/untitled - Track 37.wav',
            [this.soundTypes.DRAW_38]: '/src/sound/sfx/draw/untitled - Track 38.wav',
            [this.soundTypes.DRAW_39]: '/src/sound/sfx/draw/untitled - Track 39.wav',
            [this.soundTypes.DRAW_40]: '/src/sound/sfx/draw/untitled - Track 40.wav'
        };

        // Stato specifico per i loop
        this.loopStates = {
            [this.soundTypes.MAGIC_CIRCLE_ACTIVE]: { isPlaying: false, id: null },
            [this.soundTypes.SPELL_SPATIAL_NEUTRAL]: { isPlaying: false, id: null },
            [this.soundTypes.SPELL_SPATIAL_FUOCO]: { isPlaying: false, id: null },
            [this.soundTypes.SPELL_SPATIAL_ACQUA]: { isPlaying: false, id: null },
            [this.soundTypes.SPELL_SPATIAL_ARIA]: { isPlaying: false, id: null },
            [this.soundTypes.SPELL_SPATIAL_TERRA]: { isPlaying: false, id: null }
            // [this.soundTypes.DRAWING_LOOP]: { isPlaying: false, id: null }, // Se implementato come loop
        };

        this.collisionSoundTypes = [
            this.soundTypes.COLLISION_1,
            this.soundTypes.COLLISION_2,
            this.soundTypes.COLLISION_3,
            this.soundTypes.COLLISION_4
        ];

        this.drawingSoundTypes = [
            this.soundTypes.DRAW_1, this.soundTypes.DRAW_2, this.soundTypes.DRAW_3,
            this.soundTypes.DRAW_4, this.soundTypes.DRAW_5, this.soundTypes.DRAW_6,
            this.soundTypes.DRAW_7, this.soundTypes.DRAW_8, this.soundTypes.DRAW_9,
            this.soundTypes.DRAW_10, this.soundTypes.DRAW_11, this.soundTypes.DRAW_12,
            this.soundTypes.DRAW_13, this.soundTypes.DRAW_14, this.soundTypes.DRAW_15,
            this.soundTypes.DRAW_16, this.soundTypes.DRAW_17, this.soundTypes.DRAW_18,
            this.soundTypes.DRAW_19, this.soundTypes.DRAW_20, this.soundTypes.DRAW_21,
            this.soundTypes.DRAW_22, this.soundTypes.DRAW_23, this.soundTypes.DRAW_24,
            this.soundTypes.DRAW_25, this.soundTypes.DRAW_26, this.soundTypes.DRAW_27,
            this.soundTypes.DRAW_28, this.soundTypes.DRAW_29, this.soundTypes.DRAW_30,
            this.soundTypes.DRAW_31, this.soundTypes.DRAW_32, this.soundTypes.DRAW_33,
            this.soundTypes.DRAW_34, this.soundTypes.DRAW_35, this.soundTypes.DRAW_36,
            this.soundTypes.DRAW_37, this.soundTypes.DRAW_38, this.soundTypes.DRAW_39,
            this.soundTypes.DRAW_40
        ];
    }

    loadGlobalVolume() {
        const saved = localStorage.getItem('audioVolume');
        const percent = saved ? parseInt(saved) : 100;
        return Math.max(0, Math.min(1, percent / 100));
    }

    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log("🎵 AudioManager: Contesto audio ripreso con successo (post-click).");
            }).catch(err => {
                console.error("❌ AudioManager: Errore nel riprendere il contesto audio:", err);
            });
        }
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("🎵 AudioManager: Contesto audio inizializzato.");

            // --- 🎧 Reverb di base ---
            this.convolver = this.audioContext.createConvolver();

            // Se hai un file impulse response (es. 'reverb_hall.wav'):
            fetch('/src/sound/impulse/reverb_hall.wav')
                .then(res => res.arrayBuffer())
                .then(buf => this.audioContext.decodeAudioData(buf))
                .then(decoded => {
                    this.convolver.buffer = decoded;
                    console.log("🌫️ AudioManager: Reverb caricato da file impulse.");
                })
                .catch(() => {
                    console.warn("⚠️ AudioManager: Nessun file di impulse trovato, uso reverb sintetico.");
                    this.convolver.buffer = this.generateSimpleReverbImpulse(2.5, 2.0);
                });

            // Crea un nodo di mix per controllare la quantità di reverb
            this.reverbGain = this.audioContext.createGain();
            this.reverbGain.gain.value = 0.35; // regolabile (0.0 = secco, 1.0 = molto riverberato)

            // Collega la catena audio globale
            this.convolver.connect(this.reverbGain);
            this.reverbGain.connect(this.audioContext.destination);
        }
    }

    generateSimpleReverbImpulse(duration = 2.0, decay = 2.0) {
        const rate = this.audioContext.sampleRate;
        const length = rate * duration;
        const impulse = this.audioContext.createBuffer(2, length, rate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
            }
        }
        return impulse;
    }

    async loadAllSounds() {
        console.log("🎵 AudioManager: Caricamento di tutti i suoni...");
        const promises = Object.entries(this.soundFiles).map(([type, url]) => this.loadSound(type, url));
        try {
            await Promise.all(promises);
            console.log("🎵 AudioManager: Tutti i suoni caricati con successo.");
        } catch (e) {
            console.error("❌ AudioManager: Errore nel caricamento dei suoni:", e);
        }
    }

    async loadSound(type, url) {
        if (this.audioBuffers.has(type)) {
            console.warn(`🎵 AudioManager: Suono '${type}' già caricato.`);
            return this.audioBuffers.get(type);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Errore nel caricamento ${url}: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(type, audioBuffer);
            console.log(`🎵 AudioManager: Suono '${type}' caricato da ${url}`);
            return audioBuffer;
        } catch (error) {
            console.error(`❌ AudioManager: Impossibile caricare il suono '${type}' da ${url}:`, error);
            // Potresti voler impostare un buffer "silenzio" o null in caso di errore
            // this.audioBuffers.set(type, null);
            return null;
        }
    }

    // --- Metodi Pubblici per la Riproduzione ---

    playSound(type, volume = 1.0, playbackRate = 1.0) {
        if (!this.enabled || !this.audioBuffers.has(type)) return;

        const buffer = this.audioBuffers.get(type);
        if (!buffer) {
            console.warn(`🎵 AudioManager: Buffer mancante per il suono '${type}', impossibile riprodurre.`);
            return;
        }

        // Controlla se è un loop attivo e gestiscilo
        if (this.loopStates[type]) {
            if (this.loopStates[type].isPlaying) {
                console.log(`🎵 AudioManager: Loop '${type}' già in riproduzione.`);
                return; // Non riprodurlo se già attivo
            }
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate; // Velocità di riproduzione

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * this.globalVolume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        gainNode.connect(this.convolver);

        // Gestisci i loop
        if (this.loopStates[type]) {
            source.loop = true;
            this.loopStates[type].isPlaying = true;
            this.loopStates[type].id = source;
            console.log(`🔁 AudioManager: Loop '${type}' avviato.`);
        }

        source.start(0);

        // Gestisci la rimozione della sorgente attiva quando finisce (se non è un loop)
        if (!this.loopStates[type]) {
            source.onended = () => {
                this.activeSources.delete(`${type}_${source}`);
                console.log(`⏹️ AudioManager: Suono '${type}' terminato.`);
            };
            // Aggiungi la sorgente ai controlli attivi (se non è un loop gestito separatamente)
            // Non serve aggiungere i loop qui, sono gestiti separatamente
        }

        // Non serve aggiungere i loop qui, sono gestiti separatamente
        if (!this.loopStates[type]) {
            this.activeSources.set(`${type}_${source}`, source);
        }
    }

    stopSound(type) {
        if (this.loopStates[type] && this.loopStates[type].isPlaying) {
            const source = this.loopStates[type].id;
            if (source) {
                source.stop(); // <-- DECOMMENTA E USA QUESTA RIGA
                
                this.loopStates[type].isPlaying = false;
                this.loopStates[type].id = null;
                console.log(`⏹️ AudioManager: Loop '${type}' fermato.`);
            }
        }
        // Per suoni non loopati, potresti avere un sistema di stop specifico se necessario
        // ma generalmente si lasciano terminare naturalmente.
    }

    // Metodo specifico per gestire il loop del cerchio magico
    setMagicCircleLoopPlaying(isPlaying) {
        if (isPlaying) {
            if (!this.loopStates[this.soundTypes.MAGIC_CIRCLE_ACTIVE].isPlaying) {
                this.playSound(this.soundTypes.MAGIC_CIRCLE_ACTIVE, 0.5); // Volume leggermente più basso per il loop
            }
        } else {
            this.stopSound(this.soundTypes.MAGIC_CIRCLE_ACTIVE);
        }
    }

    // Metodo per riprodurre il suono di collisione normale
    playCollisionSound(volume = 0.8) { // <-- 1. Accetta un parametro 'volume'
        // Ferma temporaneamente il loop di collisione continua se attivo
        // (potrebbe non essere sempre desiderato, dipende dalla logica)
        // this.setCollisionContinuousLoopPlaying(false);

        const randomSoundType = this.collisionSoundTypes[Math.floor(Math.random() * this.collisionSoundTypes.length)];
        // 2. Usa il volume ricevuto (o 0.8 se non specificato)
        this.playSound(randomSoundType, volume); 
    }

    // Metodo per riprodurre il suono di un proiettile specifico
    playProjectileSound(element = null) {
        let soundType = this.soundTypes.PROJECTILE_NEUTRAL;
        if (element) {
            const elementMap = {
                'fuoco': this.soundTypes.PROJECTILE_FUOCO,
                'acqua': this.soundTypes.PROJECTILE_ACQUA,
                'aria': this.soundTypes.PROJECTILE_ARIA,
                'terra': this.soundTypes.PROJECTILE_TERRA,
            };
            soundType = elementMap[element] || soundType;
        }
        this.playSound(soundType, 0.6); // Volume leggermente più basso
    }

    // Metodo per riprodurre il suono di una magia spaziale specifica (futuro)
    setSpatialSpellLoopPlaying(element = null, isPlaying) {
        let soundType = this.soundTypes.SPELL_SPATIAL_NEUTRAL;
        if (element) {
            const elementMap = {
                'fuoco': this.soundTypes.SPELL_SPATIAL_FUOCO,
                'acqua': this.soundTypes.SPELL_SPATIAL_ACQUA,
                'aria': this.soundTypes.SPELL_SPATIAL_ARIA,
                'terra': this.soundTypes.SPELL_SPATIAL_TERRA,
            };
            soundType = elementMap[element] || soundType;
        }
    
        if (isPlaying) {
            if (!this.loopStates[soundType] || !this.loopStates[soundType].isPlaying) {
                this.playSound(soundType, 0.65); // Avvia il loop
            }
        } else {
            // Interrompe il loop se è in riproduzione
            this.stopSound(soundType); 
        }
        console.log("🔊 Spatial loop set:", element, " -> ", isPlaying);
    }

    // Metodo per riprodurre il suono di un elemento evocato (senza proiezione)
    playElementSpellSound(element) {
        if (!element) return;
        
        const elementMap = {
            'fuoco': this.soundTypes.SPELL_FUOCO,
            'acqua': this.soundTypes.SPELL_ACQUA,
            'aria': this.soundTypes.SPELL_ARIA,
            'terra': this.soundTypes.SPELL_TERRA,
        };
        
        const soundType = elementMap[element];
        if (soundType) {
            this.playSound(soundType, 0.7); // Volume 0.7
        }
    }

    // Metodo per riprodurre un suono di disegno casuale
    playDrawingSound() {
        const randomSoundType = this.drawingSoundTypes[Math.floor(Math.random() * this.drawingSoundTypes.length)];
        this.playSound(randomSoundType);
    }

    // --- Controllo Generale ---
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Ferma tutti i suoni attivi quando l'audio è disabilitato
            this.stopAllSounds();
        }
    }

    setGlobalVolume(volume) {
        this.globalVolume = Math.max(0, Math.min(1, volume)); // Limita tra 0 e 1
    }

    loopWithCrossfade(type, volume = 1.0, fadeTime = 0.2) {
        if (!this.audioBuffers.has(type)) return;
        const buffer = this.audioBuffers.get(type);
    
        const playLoop = () => {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
    
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.0; // parte silenzioso
    
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            gainNode.connect(this.convolver);
    
            source.start();
    
            // Fade in
            gainNode.gain.linearRampToValueAtTime(volume * this.globalVolume, this.audioContext.currentTime + fadeTime);
    
            // Prepara il prossimo loop prima che finisca
            const overlapTime = fadeTime; // crossfade duration
            const nextStart = this.audioContext.currentTime + buffer.duration - overlapTime;
            setTimeout(() => playLoop(), (buffer.duration - overlapTime) * 1000);
    
            // Fade out prima di fermare
            setTimeout(() => {
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeTime);
                source.stop(this.audioContext.currentTime + fadeTime);
            }, (buffer.duration - overlapTime) * 1000);
        };
    
        playLoop();
    }

    stopAllSounds() {
        // Ferma tutti i loop attivi
        for (const [type, state] of Object.entries(this.loopStates)) {
            if (state.isPlaying) {
                this.stopSound(type);
            }
        }
        // Ferma le sorgenti non loopate (se necessario, anche se spesso terminano da sole)
        // for (const [id, source] of this.activeSources) {
        //     source.stop();
        // }
        this.activeSources.clear();
    }
}

// --- Esportazione ---
// Crea un'istanza globale (o usa un pattern singleton se preferisci)
const audioManager = new AudioManager();

// Esporta l'istanza e i tipi di suono per l'uso in altri file
export { audioManager, AudioManager }; // Potresti esportare solo audioManager se non serve la classe intera altrove
