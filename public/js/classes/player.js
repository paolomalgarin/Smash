export default class Player {
    // defaults statici usabili per tutti i player (config globale)
    static DEFAULTS = {
        maxSpeed: 420,            // world units / s (orizzontale)
        accel: 3000,              // accel orizzontale
        airControlFactor: 0.6,    // controllo orizzontale in aria
        g: 3000,                  // gravità worldunits / s^2 (positive = verso il basso)
        terminalVy: 1600,
        jumpHeight: 140,          // world units
        coyoteTime: 0.10,         // s
        jumpBuffer: 0.10,         // s
        baseAttackDamage: 8,      // percent
        baseKnockback: 180,       // impulse base (units/s)
        kPerPercent: 20,           // impatto per % danno
        hitstunPerImpulse: 0.0015 // coefficiente per tradurre impulso in hitstun secs
    };

    constructor(opts = {}) {
        // Preferisco opzione oggetto per avere parametri opzionali leggibili
        const {
            x = 0, y = 0,
            weight = 30,
            reaction = 30,
            facing = 1,
            onGround = true,
            // hitbox: rettangolo relativo al centro [offsetX, offsetY, width, height]
            hitbox = { offsetX: 0, offsetY: 0, width: 64, height: 64 },
            // spawnPoint: meglio percentuale rispetto all'arena o world coords
            spawnPoint = { x: x, y: y }, // puoi passare {x:0.15, y:0.9} se usi percentuali
            animationFolder = null,
        } = opts;

        // posizione e velocità
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;

        // attributi di gioco
        this.damagePercent = 0;
        this.weight = weight;
        this.reaction = reaction;
        this.facing = facing; // +1 right, -1 left

        // stato macchina
        this.prevState = null;
        this.state = 'Idle';
        this.onGround = onGround;
        this.guarding = false;

        // hitbox/hurtbox e spawn
        this.hitbox = { ...hitbox }; // clone per evitare shared references
        this.spawnPoint = { ...spawnPoint };

        // timers per azioni (tutti in secondi)
        this.timers = {
            startup: 0,
            active: 0,
            recovery: 0,
            hitstun: 0,
            invuln: 0,
            coyote: 0,
            jumpBuffer: 0
        };

        // hitbox attiva dell'attacco corrente (null se nessuna)
        this.activeHitbox = null;

        // parametri personalizzabili per il singolo player
        this.config = { ...Player.DEFAULTS };

        // parametri di attacco base (startup/active/recovery) - possono essere tarati per personaggio
        this.attackFrames = {
            startupBase: 0.12,
            activeBase: 0.08,
            recoveryBase: 0.20
        };

        // double jump
        this.maxDoubleJumps = 1;
        this.jumpsRemaining = this.maxDoubleJumps;

        // attributi x animazioni
        this.animationFolder = animationFolder;
        this.animationFrame = 0;

        this.frames = {};
        this.frameCounts = {};
        this.frameDuration = 0.1; // Imposta un valore appropriato
        this.frameTimer = 0;
        this.prevState = null;
    }

    // -----------------------------
    // update: chiamalo dal tuo main loop per ogni player
    // dt è il fixed timestep (es. 1/60)
    // -----------------------------
    update(dt, arena = {}) {
        // timers
        for (const k in this.timers) {
            if (this.timers[k] > 0) this.timers[k] = Math.max(0, this.timers[k] - dt);
        }

        // gravity & vertical integration (semi-implicit)
        if (!this.onGround) {
            this.vy += this.config.g * dt;
            if (this.vy > this.config.terminalVy) this.vy = this.config.terminalVy;
        }

        // applica velocità a posizione
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // stato macchina base: es. uscire da hitstun quando timer finito
        if (this.guarding) {
            this.state = 'Guarding';
        } else if (this.timers.hitstun > 0) {
            this.state = 'Hitstun';
        } else if (this.timers.startup > 0) {
            this.state = 'AttackingStartup';
        } else if (this.timers.active > 0) {
            this.state = 'AttackingActive';
        } else if (this.timers.recovery > 0) {
            this.state = 'AttackingRecovery';
        } else if (this.timers.invuln > 0) {
            this.state = 'Invulnerable';
        } else if (!this.onGround) {
            this.state = this.vy < 0 ? 'Jumping' : 'Falling';
        } else if (Math.abs(this.vx) > 1) {
            this.state = 'Moving';
        } else {
            this.state = 'Idle';
        }

        // aggiorna coyote time: se sei a terra resetta, altrimenti conta
        if (this.onGround) {
            this.timers.coyote = this.config.coyoteTime;
            this.jumpsRemaining = this.maxDoubleJumps;
        } else {
            this.timers.coyote = Math.max(0, this.timers.coyote - dt);
        }

        // gestione activeHitbox: se scade active window, togli la hitbox
        // gestione activeHitbox: se scade active window, togli la hitbox
        if (this.activeHitbox && this.timers.active <= 0) {
            this.activeHitbox = null;
        }
        // aggiorna posizione hitbox solo se è attiva (startup finita, active > 0)
        // --- gestione attacchi in coda: se lo startup è finito, attiva la finestra active
        if (this._pendingAttack && this.timers.startup <= 0 && this.timers.active <= 0) {
            const { cfg, active, recovery } = this._pendingAttack;
            // avvia active/recovery
            this.timers.active = active;
            this.timers.recovery = recovery;
            // costruisci la hitbox iniziale basata sulla posizione corrente (come facevi in attack)
            let hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + cfg.offsetY;
            if (cfg.anchor === 'top') {
                hitboxCenterY = this.y + (this.hitbox.offsetY || 0) - (this.hitbox.height / 2) + cfg.height / 2 + cfg.offsetY;
            } else if (cfg.anchor === 'bottom') {
                hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + (this.hitbox.height / 2) - cfg.height / 2 + cfg.offsetY;
            }
            const hitboxCenterX = this.x + this.facing * (cfg.offsetX + this.hitbox.width);
            this.activeHitbox = {
                x: hitboxCenterX - cfg.width / 2,
                y: hitboxCenterY - cfg.height / 2,
                width: cfg.width,
                height: cfg.height,
                damage: cfg.damage,
                knockbackBase: cfg.knockbackBase,
                owner: this,
                hitTargets: new Set(),
                _cfg: cfg
            };
            delete this._pendingAttack;
            // console.log('start active hitbox from pending (change in update)');
        }

        // gestione activeHitbox: se scade active window, togli la hitbox
        if (this.activeHitbox && this.timers.active <= 0) {
            this.activeHitbox = null;
        }
        // aggiorna posizione hitbox solo se è attiva (startup finita, active > 0)
        if (this.activeHitbox) {
            // console.log("C'è hitbox!");
            if (this.timers.active > 0 && this.timers.startup <= 0) {
                // console.log('cambiamo la hitbox');
                const cfg = this.activeHitbox._cfg || { range: 48 };

                // ricostruisci center coords coerenti come in attack()
                let hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + cfg.offsetY;
                if (cfg.anchor === 'top') {
                    hitboxCenterY = this.y + (this.hitbox.offsetY || 0) - (this.hitbox.height / 2) + cfg.height / 2 + cfg.offsetY + (this.vy * dt);
                } else if (cfg.anchor === 'bottom') {
                    hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + (this.hitbox.height / 2) - cfg.height / 2 + cfg.offsetY + (this.vy * dt);
                }
                const hitboxCenterX = this.x + this.facing * (cfg.offsetX + this.hitbox.height / 2);
                const hitTargets = this.activeHitbox.hitTargets;

                this.activeHitbox = {
                    x: hitboxCenterX - cfg.width / 2,
                    y: hitboxCenterY - cfg.height / 2,
                    width: cfg.width,
                    height: cfg.height,
                    damage: cfg.damage,
                    knockbackBase: cfg.knockbackBase,
                    owner: this,
                    hitTargets: hitTargets ? hitTargets : new Set(),
                    _cfg: cfg
                };
                // console.log('change in update');
            } else if (this.timers.active <= 0) {
                this.activeHitbox = null;
            }
        }




        // gestione confini KO (se fornito arena con left/right/top/bottom e marginKO)
        if (arena && typeof arena.left === 'number') {
            const leftBound = arena.left - (arena.marginKO || arena.width * 0.1);
            const rightBound = arena.left + (arena.width || 0) + (arena.marginKO || arena.width * 0.1);
            const topBound = (arena.top || 0) - (arena.marginKOY || 200);
            const bottomBound = (arena.top || 0) + (arena.height || 0) + (arena.marginKOY || 200);

            if (this.x < leftBound || this.x > rightBound || this.y < topBound || this.y > bottomBound) {
                this.onKO();
            }
        }
    }

    // Movimento: direction = -1|0|1 ; accel e massima velocità
    move(direction, dt) {
        // se sta parando non lo lascio muovere (e saltare o attaccate)
        if (this.guarding) direction = 0;

        const target = direction * this.config.maxSpeed;
        const accel = this.onGround ? this.config.accel : this.config.accel * this.config.airControlFactor;
        // semplice approccio: velocity toward target with accel
        if (this.vx < target) {
            this.vx = Math.min(target, this.vx + accel * dt);
        } else if (this.vx > target) {
            this.vx = Math.max(target, this.vx - accel * dt);
        }
        if (direction !== 0) this.facing = Math.sign(direction);
    }

    // Salto: usa coyote time e jump buffer
    jump() {
        // se sta parando non gli lascio saltare (e muoversi o attaccate)
        if (this.guarding) return;

        // può saltare se onGround o coyote timer > 0
        if (this.onGround || this.timers.coyote > 0) {
            const vJump = Math.sqrt(2 * this.config.g * this.config.jumpHeight);
            this.vy = -vJump; // assumiamo y verso il basso, quindi negativo per salire
            this.onGround = false;
            this.timers.coyote = 0;
        } else if (this.jumpsRemaining > 0) {
            const vJump = Math.sqrt(2 * this.config.g * this.config.jumpHeight);
            this.vy = -vJump; // assumiamo y verso il basso, quindi negativo per salire
            this.jumpsRemaining--;
        } else {
            // se non può saltare, puoi salvare jumpBuffer (opzionale)
            this.timers.jumpBuffer = this.config.jumpBuffer;
        }
    }

    // Attacco base: imposta startup/active/recovery e crea activeHitbox durante active
    // --- modifica: attack() ---
    attack(damage, knockback, hitboxCfg = {}, recoveryTime) {
        console.log(this.timers.recovery);
        // se sta parando non lo lascio attaccate (e saltare o muovere) 
        if (this.guarding) return;

        if (this.timers.startup > 0 || this.timers.active > 0 || this.timers.recovery > 0 || this.timers.hitstun > 0) {
            return;
        }

        const α = 0.004;
        const startup = this.attackFrames.startupBase * (1 - this.reaction * α);
        const active = this.attackFrames.activeBase;
        const recovery = recoveryTime ? recoveryTime : this.attackFrames.recoveryBase * (1 - this.reaction * 0.003);

        // AVVIO solo lo startup subito; metto active/recovery in coda
        this.timers.startup = Math.max(0.02, startup);
        this.timers.active = 0;
        this.timers.recovery = 0;

        // config della hitbox (defaults)
        const cfg = {
            range: hitboxCfg.range ?? 48,
            width: hitboxCfg.width ?? 48,
            height: hitboxCfg.height ?? (this.hitbox.height * 0.6),
            anchor: hitboxCfg.anchor ?? 'center', // 'top' | 'center' | 'bottom'
            offsetX: hitboxCfg.offsetX ?? 0,
            offsetY: hitboxCfg.offsetY ?? 0,
            damage: (typeof damage !== 'undefined') ? damage : Player.DEFAULTS.baseAttackDamage,
            knockbackBase: (typeof knockback !== 'undefined') ? knockback : Player.DEFAULTS.baseKnockback
        };

        // non creare subito la activeHitbox qui: la salvo in pending
        this._pendingAttack = { cfg, active, recovery };

        // console.log('change in attack (queued)');
    }


    // Parata riduce danno e knockback (semplice implementazione)
    guard() {
        this.guarding = true;
    }
    removeGuard() {
        this.guarding = false;
    }

    // Schivata: breve invulnerabilità + spostamento
    dodge() {
        if (this.timers.invuln > 0 || this.timers.hitstun > 0) return;
        this.timers.invuln = 0.32; // invulnerabile 0.32s
        this.timers.dodgeRecovery = 1;
    }

    // applyHit: chiamalo quando una hitbox rileva collisione con il tuo hurtbox
    applyHit(damagePercentAdded = 0, hitDirection = { x: 1, y: -0.2 }, baseKnockback = null) {
        // se stavi in invulnerabilità o KO, ignora
        if (this.timers.invuln > 0 || this.state === 'KO') return;

        // incremento danno
        this.damagePercent += this.guarding ? Math.round(damagePercentAdded / 10) : damagePercentAdded;

        // calcola impulso
        const bkb = baseKnockback !== null ? baseKnockback : Player.DEFAULTS.baseKnockback;
        const k = Player.DEFAULTS.kPerPercent;
        const impulse = this.guarding ? (bkb + k * this.damagePercent) / 10 : (bkb + k * this.damagePercent);

        // weightFactor riduce efficacia impulso
        const weightFactor = this.weight / 100;
        const effectiveImpulse = impulse / (1 + weightFactor);

        // applicalo a vx, vy (norma direzione)
        // normalizzi la direzione
        const len = Math.hypot(hitDirection.x, hitDirection.y) || 1;
        const nx = hitDirection.x / len;
        const ny = hitDirection.y / len;

        this.vx += nx * effectiveImpulse;
        this.vy += ny * effectiveImpulse;

        // setta hitstun proporzionale all'impulso
        const hitstun = Math.min(1.2, effectiveImpulse * Player.DEFAULTS.hitstunPerImpulse);
        this.timers.hitstun = hitstun;

        // dopo essere colpito perdi controllo temporaneamente (gestito da timers)
    }

    // metodo astratto: override nelle sottoclassi per effetti speciali
    special() {
        throw new Error('special() must be implemented by subclass');
    }

    // KO: default - metti in stato KO e ferma input
    onKO() {
        this.state = 'KO';
        this.vx = 0;
        this.vy = 0;
        // puoi chiamare callback esterna per decrementare vite, ecc.
    }

    // resetto al punto di spawn. spawnPoint può essere percentuale o world coords
    resetToSpawn(arena = null) {
        if (arena && typeof this.spawnPoint.x === 'number' && this.spawnPoint.x <= 1) {
            // interpretato come percentuale
            this.x = arena.left + (arena.width || 0) * this.spawnPoint.x;
            this.y = arena.top + (arena.height || 0) * this.spawnPoint.y;
        } else {
            // coordinate world absolute
            this.x = this.spawnPoint.x;
            this.y = this.spawnPoint.y;
        }
        this.vx = 0;
        this.vy = 0;
        this.damagePercent = 0;
        this.state = 'Idle';
        this.onGround = true;
        this.timers = { startup: 0, active: 0, recovery: 0, hitstun: 0, invuln: 0, coyote: 0, jumpBuffer: 0 };
        this.activeHitbox = null;
    }

    // helper: ritorna il rettangolo hurtbox in world coords
    getHurtbox() {
        return {
            x: this.x + (this.hitbox.offsetX || 0) - this.hitbox.width / 2,
            y: this.y + (this.hitbox.offsetY || 0) - this.hitbox.height / 2,
            width: this.hitbox.width,
            height: this.hitbox.height
        };
    }

    animate(dt) {
        if (!this.animationFolder) return;

        // Inizializza se non esiste
        if (!this.frames) this.frames = {};
        if (!this.frameCounts) this.frameCounts = {};

        // fallback: dt è tempo in secondi trascorsi dall'ultimo frame
        if (typeof dt !== 'number') dt = 1 / 60;

        // se non abbiamo il conteggio dei frame per questo state, proviamo a stimarlo
        // (meglio se hai già chiamato preloadAnimation)
        const state = this.state;
        const frameCount = this.frameCounts[state] || (this.frames[state] ? this.frames[state].length : 0);

        // cambia stato -> reset frame index e timer
        if (state !== this.prevState) {
            this.animationFrame = 1;
            this.frameTimer = 0;
            this.prevState = state;
        } else {
            // avanzamento temporale controllato da frameDuration
            this.frameTimer += dt;
            while (this.frameTimer >= this.frameDuration) {
                this.frameTimer -= this.frameDuration;
                if (frameCount > 0) {
                    this.animationFrame = (this.animationFrame + 1) % frameCount;
                } else {
                    this.animationFrame = (this.animationFrame + 1); // fallback: numeri; ma meglio avere frameCount
                }
            }
        }

        // se abbiamo immagini preloadate, restituisci src dell'Image
        if (this.frames[state] && this.frames[state][this.animationFrame]) {
            return this.frames[state][this.animationFrame].src;
        }

        // fallback costruendo il path (utile se non hai precaricato e sai quanti frame ci sono)
        const idx = this.animationFrame;
        return `./public/img/animations/${this.animationFolder}/${state === 'AttackingRecovery' ? 'Idle' : state}/frame${idx}.png`;
    }


    preloadAllAnimations(states = ['Idle', 'Moving', 'Jumping', 'Falling', 'AttackingStartup', 'AttackingActive', 'AttackingRecovery', 'Hitstun', 'Invulnerable', 'Guarding', 'KO']) {
        if (!this.animationFolder) return Promise.resolve();

        if (!this.frames) this.frames = {};
        if (!this.frameCounts) this.frameCounts = {};

        const promises = [];

        for (const state of states) {
            promises.push(new Promise((resolve) => {
                // Prova a caricare i frame finché non incontri un errore
                let frameIndex = 1;
                const loadedFrames = [];

                const loadNextFrame = () => {
                    const img = new Image();
                    img.onload = () => {
                        loadedFrames.push(img);
                        frameIndex++;
                        loadNextFrame();
                    };
                    img.onerror = () => {
                        // Fine dei frame per questo stato
                        if (loadedFrames.length > 0) {
                            this.frames[state] = loadedFrames;
                            this.frameCounts[state] = loadedFrames.length;
                        }
                        resolve();
                    };
                    img.src = `./public/img/animations/${this.animationFolder}/${state}/frame${frameIndex}.png`;
                };

                loadNextFrame();
            }));
        }

        return Promise.all(promises);
    }

}