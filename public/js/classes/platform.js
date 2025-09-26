export default class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.updateBounds();
    }

    updateBounds() {
        this.left = this.x - this.width / 2;
        this.right = this.x + this.width / 2;
        this.top = this.y - this.height / 2;
        this.bottom = this.y + this.height / 2;
    }

    /**
     * Ritorna:
     *  { collided: true, axis: 'x'|'y', direction: -1|1, penetration: number }
     *  direction: -1 = sposta negativo (x: left, y: up), +1 = sposta positivo (x: right, y: down)
     */
    checkCollision(player) {
        const hurtbox = player.getHurtbox();

        // getHurtbox() ritorna top-left (x,y)
        const playerLeft = hurtbox.x;
        const playerTop = hurtbox.y;
        const playerRight = hurtbox.x + hurtbox.width;
        const playerBottom = hurtbox.y + hurtbox.height;

        // test di sovrapposizione AABB
        if (playerRight <= this.left || playerLeft >= this.right || playerBottom <= this.top || playerTop >= this.bottom) {
            return { collided: false };
        }

        // calcola overlap su X e su Y (entità già si sovrappongono)
        const overlapX = Math.min(playerRight, this.right) - Math.max(playerLeft, this.left); // >0
        const overlapY = Math.min(playerBottom, this.bottom) - Math.max(playerTop, this.top); // >0

        // Scegli asse di risoluzione: quello con la min penetrazione
        // Tie-break: se sono praticamente uguali, preferiamo la risoluzione verticale se il player sta "cadendo" (vy > 0)
        let resolveVertical = overlapY <= overlapX;
        if (Math.abs(overlapX - overlapY) < 1e-3) {
            resolveVertical = (player.vy || 0) > 0;
        }

        if (resolveVertical) {
            // risolvo in Y
            // se il centro del player è sopra il centro della piattaforma -> sposto verso l'alto (landing)
            const playerCenterY = player.y;
            const dir = playerCenterY < this.y ? -1 : 1; // -1 = up, +1 = down
            if (dir < 0 && player.vy >= 0)
                return {
                    collided: true,
                    axis: 'y',
                    direction: dir,
                    penetration: overlapY
                };
            else
                return { collided: false };
        } else {
            // risolvo in X
            const playerCenterX = player.x;
            const dir = playerCenterX < this.x ? -1 : 1; // -1 = left, +1 = right
            return {
                collided: true,
                axis: 'x',
                direction: dir,
                penetration: overlapX
            };
        }
    }

    resolveCollision(player, collision) {
        if (!collision || !collision.collided) return;

        const p = collision.penetration - 0.00000001;
        if (collision.axis === 'y') {
            if (collision.direction === -1) {
                // push up: player sopra la piattaforma -> riallinea sopra
                player.y -= p;
                player.vy = 0;
                player.onGround = true;
            } else {
                // push down: player sotto la piattaforma
                player.y += p;
                player.vy = 0;
            }
        } else if (collision.axis === 'x') {
            if (collision.direction === -1) {
                // push left
                player.x -= p;
                player.vx = player.vx / -5;
            } else {
                // push right
                player.x += p;
                player.vx = player.vx / -5;
            }
        }

        // se la piattaforma può muoversi chiamare this.updateBounds() esternamente
    }
}
