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
        kPerPercent: 8,           // impatto per % danno
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
            hitbox = { offsetX: 0, offsetY: 0, width: 32, height: 48 },
            // spawnPoint: meglio percentuale rispetto all'arena o world coords
            spawnPoint = { x: x, y: y }, // puoi passare {x:0.15, y:0.9} se usi percentuali
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
        this.state = 'Idle';
        this.onGround = onGround;

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
        if (this.timers.hitstun > 0) {
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
        if (this.activeHitbox) {
            if (this.timers.active > 0 && this.timers.startup <= 0) {
                const cfg = this.activeHitbox._cfg || { range: 48 };
                // ricostruisci center coords coerenti come in attack()
                const hitboxCenterX = this.x + this.facing * (cfg.range + (this.hitbox.width / 2)) + (cfg.offsetX || 0);

                let hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + (cfg.offsetY || 0);
                if (cfg.anchor === 'top') {
                    hitboxCenterY = this.y + (this.hitbox.offsetY || 0) - (this.hitbox.height / 2) + cfg.height / 2 + (cfg.offsetY || 0);
                } else if (cfg.anchor === 'bottom') {
                    hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + (this.hitbox.height / 2) - cfg.height / 2 + (cfg.offsetY || 0);
                }

                this.activeHitbox.x = hitboxCenterX - (this.activeHitbox.width / 2);
                this.activeHitbox.y = hitboxCenterY - (this.activeHitbox.height / 2);
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
    attack(damage, knockback, hitboxCfg = {}) {
        if (this.timers.startup > 0 || this.timers.active > 0 || this.timers.recovery > 0 || this.timers.hitstun > 0) {
            return;
        }

        const α = 0.004;
        const startup = this.attackFrames.startupBase * (1 - this.reaction * α);
        const active = this.attackFrames.activeBase;
        const recovery = this.attackFrames.recoveryBase * (1 - this.reaction * 0.003);

        this.timers.startup = Math.max(0.02, startup);
        this.timers.active = active;
        this.timers.recovery = recovery;

        // config della hitbox (defaults)
        const cfg = {
            range: hitboxCfg.range ?? 48,
            width: hitboxCfg.width ?? 48,
            height: hitboxCfg.height ?? (this.hitbox.height * 0.6),
            anchor: hitboxCfg.anchor ?? 'center', // 'top' | 'center' | 'bottom'
            offsetX: hitboxCfg.offsetX ?? 0, // ulteriore offset relativo al centro player
            offsetY: hitboxCfg.offsetY ?? 0,
            damage: (typeof damage !== 'undefined') ? damage : Player.DEFAULTS.baseAttackDamage,
            knockbackBase: (typeof knockback !== 'undefined') ? knockback : Player.DEFAULTS.baseKnockback
        };

        // calcola y in base all'anchor (this.y è il centro del player)
        let hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + cfg.offsetY;
        if (cfg.anchor === 'top') {
            // metti la hitbox un poco più in alto rispetto al centro
            hitboxCenterY = this.y + (this.hitbox.offsetY || 0) - (this.hitbox.height / 2) + cfg.height / 2 + cfg.offsetY;
        } else if (cfg.anchor === 'bottom') {
            hitboxCenterY = this.y + (this.hitbox.offsetY || 0) + (this.hitbox.height / 2) - cfg.height / 2 + cfg.offsetY;
        }

        // calcola x del centro della hitbox (a partire dal centro del player)
        const hitboxCenterX = this.x + this.facing * (cfg.range + (this.hitbox.width / 2)) + cfg.offsetX;

        // salvo la hitbox con coordinate top-left coerenti
        this.activeHitbox = {
            x: hitboxCenterX - cfg.width / 2,
            y: hitboxCenterY - cfg.height / 2,
            width: cfg.width,
            height: cfg.height,
            damage: cfg.damage,
            knockbackBase: cfg.knockbackBase,
            owner: this,
            hitTargets: new Set(),
            // salvo i parametri utili per l'update
            _cfg: cfg
        };

        // console.log("Attack started!", this.activeHitbox);
    }


    // Parata riduce danno e knockback (semplice implementazione)
    parry() {
        // Parry: breve finestra in cui il giocatore subisce meno danno
        // Imposta invulnerability/guard flag per breve tempo
        const parryWindow = 0.14 + this.reaction * 0.001; // aumenta leggermente con reaction
        this.timers.invuln = parryWindow;
        this.state = 'Guarding';
    }

    // Schivata: breve invulnerabilità + spostamento
    dodge() {
        if (this.timers.invuln > 0 || this.timers.hitstun > 0) return;
        this.timers.invuln = 0.32; // invulnerabile 0.32s
        // scatto orizzontale:
        const dashV = 520;
        this.vx = this.facing * dashV;
        // leggera spinta verticale per evitare rimbalzi su terreno
        this.vy = Math.min(this.vy, -80);
    }

    // applyHit: chiamalo quando una hitbox rileva collisione con il tuo hurtbox
    applyHit(damagePercentAdded = 0, hitDirection = { x: 1, y: -0.2 }, baseKnockback = null) {
        // se stavi in invulnerabilità o KO, ignora
        if (this.timers.invuln > 0 || this.state === 'KO') return;

        // incremento danno
        this.damagePercent += damagePercentAdded;

        // calcola impulso
        const bkb = baseKnockback !== null ? baseKnockback : Player.DEFAULTS.baseKnockback;
        const k = Player.DEFAULTS.kPerPercent;
        const impulse = bkb + k * this.damagePercent;

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
}