import { DEFAULT_DIMS, updateScale, screenToWorld, setEntity, getScale, setWorldSize } from './windowManager.js';
import { chooseLevelFromMenu } from './gameLoader.js';
import { chooseCharactersFromMenu } from './characterLoader.js';
import { processAttackHit, aabbOverlap } from "./collisionManager.js";
import Player from "./classes/player.js";
import Platform from "./classes/Platform.js";

document.addEventListener('DOMContentLoaded', async () => {

    // Scelgo i personaggi da usare
    const charactersType = await chooseCharactersFromMenu();

    // carico il game (interno e di default per ora)
    const {
        player1: {
            elm: p1,
            obj: player1,
        },
        player2: {
            elm: p2,
            obj: player2,
        },
        platforms: { objList: platforms, elmList: platformElements },
        blocks: { objList: blocks, elmList: blockElements },
    } = await chooseLevelFromMenu(charactersType);

    const keys = {};

    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        switch (e.code) {
            case 'KeyW': // jump player 1
                player1.jump?.();
                break;
            case 'ArrowUp': // jump player 2
                player2.jump?.();
                break;
            case 'KeyF':
                console.log('Attack!');
                getAttckByKeys(player1, { top: keys['keyW'], bottom: keys['keyS'] });
                break;
            case 'ShiftRight':
                console.log('Attack!');
                getAttckByKeys(player2, { top: keys['ArrowUp'], bottom: keys['ArrowDown'] });
                break;
            case 'KeyG':
                console.log('Special!');
                // player1.special?.();
                player1.resetToSpawn();
                player2.resetToSpawn();
                break;
        }
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    function gameLoop() {
        let last = performance.now();

        function gameLoop(now) {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            // ================== ROBA PER IL PLAYER 1 ==================
            let dx = 0;
            if (keys['KeyA']) dx = -1;
            if (keys['KeyD']) dx = +1;

            player1.move(dx, dt);
            player1.update(dt);

            // Controlla collisioni con le piattaforme
            let onGround = false;
            platforms.forEach(platform => {
                const collision = platform.checkCollision(player1);
                if (collision.collided) {
                    platform.resolveCollision(player1, collision);
                    // se la risoluzione è verticale verso l'alto, sei sul terreno
                    if (collision.axis === 'y' && collision.direction === -1) {
                        onGround = true;
                    }
                }
            });
            blocks.forEach(block => {
                const collision = block.checkCollision(player1);
                if (collision.collided) {
                    block.resolveCollision(player1, collision);
                    // se la risoluzione è verticale verso l'alto, sei sul terreno
                    if (collision.axis === 'y' && collision.direction === -1) {
                        onGround = true;
                    }
                }
            });
            player1.onGround = onGround;


            // ================== ROBA PER IL PLAYER 2 ==================
            dx = 0;
            if (keys['ArrowLeft']) dx = -1;
            if (keys['ArrowRight']) dx = +1;

            player2.move(dx, dt);
            player2.update(dt);

            // Controlla collisioni con le piattaforme
            onGround = false;
            platforms.forEach(platform => {
                const collision = platform.checkCollision(player2);
                if (collision.collided) {
                    platform.resolveCollision(player2, collision);
                    // se la risoluzione è verticale verso l'alto, sei sul terreno
                    if (collision.axis === 'y' && collision.direction === -1) {
                        onGround = true;
                    }
                }
            });
            blocks.forEach(block => {
                const collision = block.checkCollision(player2);
                if (collision.collided) {
                    block.resolveCollision(player2, collision);
                    // se la risoluzione è verticale verso l'alto, sei sul terreno
                    if (collision.axis === 'y' && collision.direction === -1) {
                        onGround = true;
                    }
                }
            });
            player2.onGround = onGround;

            // gestione attacchi
            processAttackHit(player1, player2);
            processAttackHit(player2, player1);



            // Debug: draw hitboxes and hurtboxes
            drawDebugBoxes();


            setEntity(p1, player1.x, player1.y, player1.getHurtbox().width, player1.getHurtbox().height);
            setEntity(p2, player2.x, player2.y, player2.getHurtbox().width, player2.getHurtbox().height);


            requestAnimationFrame(gameLoop);
        }
        requestAnimationFrame((t) => { last = t; gameLoop(t); });
    }
    gameLoop();






    function drawDebugBoxes() {

        // Draw hurtboxes for players
        const players = [player1, player2];
        for (let i = 1; i < 3; i++) {
            if (players[0].activeHitbox || players[1].activeHitbox) {
                const hurtbox = players[i - 1].getHurtbox();
                const hurtboxEl = document.getElementById(`player${i}-hurtbox`);

                setEntity(hurtboxEl, hurtbox.x, hurtbox.y, hurtbox.width, hurtbox.height);

            }
        }

        // Draw hitboxes for attacks
        for (let i = 1; i < 3; i++) {
            if (players[i - 1].activeHitbox) {
                const hitbox = players[i - 1].activeHitbox;
                const hitboxEl = document.getElementById(`player${i}-hitbox`);

                setEntity(hitboxEl, hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            }
        }

        // if (players[0].activeHitbox || players[1].activeHitbox) {
        //     console.log(player2.getHurtbox());
        //     console.log(player1.activeHitbox);
        //     console.log(aabbOverlap(player2.getHurtbox(), player1.activeHitbox));
        // }
    }

    function showHitMessage() {
        const message = document.createElement('div');
        message.className = 'message';
        message.textContent = 'HIT!';
        message.id = 'hit-message';
        document.getElementById('game').appendChild(message);

        message.style.display = 'block';
        setTimeout(() => {
            message.style.display = 'none';
        }, 500);
    }
});


function getAttckByKeys(player, keys = { top: false, bottom: false }) {
    if (keys.top) {
        player.attack?.(6, 80, { range: 40, anchor: 'top', width: 44, height: 36, offsetY: -10 }); //attacco alto / overhead
    } else if (keys.bottom) {
        player.attack?.(10, 120, { range: 36, anchor: 'bottom', offsetY: 6, width: 56, height: 28 }); //attacco basso / sweep
    } else
        player.attack?.(8, 180, { range: 48, anchor: 'center' });
}