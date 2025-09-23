// helper AABB collision
function aabbOverlap(a, b) {
    return !(a.x + a.width < b.x || a.x > b.x + b.width || a.y + a.height < b.y || a.y > b.y + b.height);
}

// processa attacchi di pA contro pB
function processAttackHit(attacker, target) {
    if (attacker.activeHitbox && aabbOverlap(target.getHurtbox(), attacker.activeHitbox)) {
        const hitbox = attacker.activeHitbox;

        // evita multi-hit ripetuti dallo stesso active window
        if (!hitbox.hitTargets.has(target)) {
            // marca il target come colpito per questa hitbox
            hitbox.hitTargets.add(target);

            // calcola direzione (usa i centri; puoi anche usare il punto di contatto se preferisci)
            const dx = (target.x - attacker.x);
            const dy = (target.y - attacker.y - (target.hitbox.offsetY || 0));
            let len = Math.hypot(dx, dy);

            // fallback robusto per evitare divisione per 0
            if (len < 1e-6) {
                // se i centri coincidono, usa la facing dell'attaccante come default
                const facing = attacker.facing || 1;
                // direzione leggermente verso l'alto per evitare solo orizzontale
                var dir = { x: facing, y: -0.2 };
            } else {
                var dir = { x: dx / len, y: dy / len };
            }

            // applica l'hit una sola volta
            target.applyHit(hitbox.damage, dir, hitbox.knockbackBase);
        }
    }
}

export { processAttackHit, aabbOverlap };