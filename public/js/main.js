import { DEFAULT_DIMS, updateScale, screenToWorld, setEntity, getScale, setWorldSize, setPlayersDamage } from './windowManager.js';
import { chooseLevelFromMenu } from './gameLoader.js';
import { chooseCharactersFromMenu } from './characterLoader.js';
import { processAttackHit, aabbOverlap } from "./collisionManager.js";
import Player from "./classes/player.js";
import Platform from "./classes/platform.js";

document.addEventListener('DOMContentLoaded', async () => {

    // ========================================================== FASE DI LOADING ==========================================================
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
        gameDims: gameDims,
    } = await chooseLevelFromMenu(charactersType);

    // mostriamo le info dei players
    document.getElementById('player-info-container').classList.remove('hidden');

    // mettiamo le icone dei player sui div dove si mostrano i danni
    if (player1.animationFolder)
        document.getElementById('player1-info-icon').src = `./public/img/icons/${player1.animationFolder}/icon.png`;
    else
        document.getElementById('player1-info-icon').src = "data:image/png;base64,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";
    if (player2.animationFolder)
        document.getElementById('player2-info-icon').src = `./public/img/icons/${player2.animationFolder}/icon.png`;
    else
        document.getElementById('player2-info-icon').src = "data:image/png;base64,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";







    // ========================================================== FASE DI ACTIONS SETUP ==========================================================

    const keys = {};
    const isDown = (code) => !!keys[code];


    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        switch (e.code) {
            case 'KeyF':
                getAttckByKeys(player1, { top: isDown('KeyW'), bottom: isDown('KeyS') });
                break;
            case 'ShiftRight':
                getAttckByKeys(player2, { top: isDown('ArrowUp'), bottom: isDown('ArrowDown') });
                break;
            case 'KeyG':
                console.log('Special!');
                break;
            case 'KeyE':
                console.log('dodge!');
                player1.dodge();
                break;

            // jump in fondo per permettere attacchi verso l'altro senza saltare
            case 'KeyW': // jump player 1
                player1.jump?.();
                break;
            case 'ArrowUp': // jump player 2
                player2.jump?.();
                break;
        }
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });




    // ========================================================== FASE DI GAME LOOP ==========================================================
    let prevKeys = {};
    function gameLoop() {
        let last = performance.now();

        function gameLoop(now) {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            const newly = {};
            for (const code in keys) {
                newly[code] = !!keys[code] && !prevKeys[code];
            }

            // ================== ROBA PER IL PLAYER 1 ==================
            // controllo se il player sta parando
            if (isDown('KeyQ'))
                player1.guard();
            else
                player1.removeGuard();

            // gestisco il movimento
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
            // controllo se il player sta parando
            if (isDown('Key.'))
                player2.guard();
            else
                player2.removeGuard();

            // gestisco il movimento
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

            // animations
            p1.style.backgroundImage = 'url(' + player1.animate(dt) + ')';
            p2.style.backgroundImage = 'url(' + player2.animate(dt) + ')';
            player1.facing < 0 ? p1.classList.add('reverse') : p1.classList.remove('reverse');
            player2.facing < 0 ? p2.classList.add('reverse') : p2.classList.remove('reverse');

            // info (percentuale danni)
            setPlayersDamage([player1, player2]);

            // aggiorno prevKeys alla fine del frame
            prevKeys = { ...keys };


            // ================== GESTIONE CONSEGUENZE DEI GIOCATORI (ES. PERDERE UNA VITA) ==================
            // gestisco l'uscita dall'arena
            let isP1Out = isOutOfTheWorld(player1, gameDims);
            let isP2Out = isOutOfTheWorld(player2, gameDims);
            if (isP1Out || isP2Out) {
                player1.resetToSpawn();
                player2.resetToSpawn();
            }


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
        player.attack?.(7, 80, { range: 40, anchor: 'top', width: 44, height: 36, offsetY: -20, offsetX: 0 }, .4); //attacco alto / overhead
    } else if (keys.bottom) {
        player.attack?.(8, 180, { range: 36, anchor: 'bottom', width: 56, height: 28, offsetY: 15, offsetX: 0 }, .5); //attacco basso / sweep
    } else
        player.attack?.(5, 100, { range: 48, anchor: 'center' }, .3);
}

function isOutOfTheWorld(player, gameDims) {
    // definisco dove esce il player 
    // orizzontalmente
    let isOutLeft = player.x <= (gameDims.width * (-0.1));
    let isOutRight = player.x >= (gameDims.width * 1.1);
    let isOutHorizontally = isOutLeft || isOutRight;
    // verticalmente
    let isOutTop = player.y <= (gameDims.height * (-0.1));
    let isOutBottom = player.y >= (gameDims.height * 1.1);
    let isOutVertically = isOutTop || isOutBottom;

    // ritorno solo se è fuori (per ora)
    return isOutHorizontally || isOutVertically;
}