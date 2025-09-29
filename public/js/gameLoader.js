import { DEFAULT_DIMS, updateScale, screenToWorld, setEntity, getScale, setWorldSize } from './windowManager.js';
import Player from "./classes/player.js";
import Platform from "./classes/platform.js";
import Block from "./classes/block.js";
import Alien from './classes/characters/alien.js';


function loadGame(game, characters) {
    setWorldSize(DEFAULT_DIMS[game.DIM]);
    updateScale();

    let player1, player2;
    switch (characters.p1) {
        case 'Player':
            player1 = new Player({ x: game.player1.x, y: game.player1.y, spawnPoint: { x: game.player1.x, y: game.player1.y } });
            break;
        case 'Alien':
            player1 = new Alien({ x: game.player1.x, y: game.player1.y, spawnPoint: { x: game.player1.x, y: game.player1.y } });
            break;

        default: throw new Error("Characters errati in loadGame()!!! [" + characters.p1 + ']');
    }
    switch (characters.p2) {
        case 'Player':
            player2 = new Player({ x: game.player2.x, y: game.player2.y, spawnPoint: { x: game.player2.x, y: game.player2.y }, isShiny: true });
            break;
        case 'Alien':
            player2 = new Alien({ x: game.player2.x, y: game.player2.y, spawnPoint: { x: game.player2.x, y: game.player2.y }, isShiny: true });
            break;

        default: throw new Error("Characters errati in loadGame()!!! [" + characters.p2 + ']');
    }
    player1.preloadAllAnimations();
    player2.preloadAllAnimations();
    // console.log('player 1 iniziale', player1);
    // console.log('player 2 iniziale', player2);

    const p1 = document.getElementById('player1');
    const p2 = document.getElementById('player2');
    setEntity(p1, player1.x, player1.y, player1.getHurtbox().width, player1.getHurtbox().height);
    setEntity(p2, player2.x, player2.y, player2.getHurtbox().width, player2.getHurtbox().height);

    // Crea alcune piattaforme
    const platforms = [];
    game.platforms.forEach((p) => {
        platforms.push(new Platform(p.x, p.y, p.width, p.height));
    });

    // Crea elementi DOM per le piattaforme
    const platformElements = [];
    platforms.forEach((platform, index) => {
        const platEl = document.createElement('div');
        platEl.className = 'game-element platform';
        platEl.id = `platform-${index}`;
        document.getElementById('game').appendChild(platEl);
        platformElements.push(platEl);
        setEntity(platEl, platform.x, platform.y, platform.width, platform.height);
    });



    // Crea alcuni blocchi
    const blocks = [];
    game.blocks.forEach((b) => {
        blocks.push(new Block(b.x, b.y, b.width, b.height));
    });

    // Crea elementi DOM per le piattaforme
    const blockElements = [];
    blocks.forEach((block, index) => {
        const platEl = document.createElement('div');
        platEl.className = 'game-element block';
        platEl.id = `block-${index}`;
        document.getElementById('game').appendChild(platEl);
        platformElements.push(platEl);
        setEntity(platEl, block.x, block.y, block.width, block.height);
    });

    return {
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
        gameDims: {
            width: DEFAULT_DIMS[game.DIM].WORLD_WIDTH,
            height: DEFAULT_DIMS[game.DIM].WORLD_HEIGHT,
        }
    };
}

function loadInternalGame(path, characters) {

    const xhr = new XMLHttpRequest();
    xhr.open("GET", path, false); // false = sincrono
    try {
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);

            return loadGame(data.game, characters);

        } else {
            throw new Error("Errore HTTP " + xhr.status);
        }
    } catch (err) {
        console.error("Errore nella lettura del file:", err);
        return null;
    }
}

function loadAllInternalGames() {
    // ✅ vantaggio: ritorna subito i dati (nessun await)
    // ⚠️ svantaggio enorme: blocca tutto il browser finché non risponde il server

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "./public/data/manifest/internalMapList.json", false); // false = sincrono
    try {
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            const list = data.list;

            // console.log(data);

            const mapChooserMenu = document.getElementById('map-chooser');
            mapChooserMenu.setAttribute('maps-path', data.pathToInternalLevels);
            mapChooserMenu.innerHTML = '';

            list.forEach(game => {
                mapChooserMenu.innerHTML += `
                <div class='level-card' id='${game.path}'>
                    <h2 class='level-card-title'>${game.name}</h2>
                    <img class='level-card-img' src='${game.imgBase64}'>
                </div>`;
            });

        } else {
            throw new Error("Errore HTTP " + xhr.status);
        }
    } catch (err) {
        console.error("Errore nella lettura del file:", err);
        return null;
    }

}

function getMenuClick() {
    return new Promise((resolve) => {
        const menu = document.getElementById("map-chooser");
        // NOTE: select elements with the class .level-card (not "level-card")
        const buttons = menu.querySelectorAll(".level-card");

        function handler(e) {
            // remove listeners so we resolve only once
            buttons.forEach(b => b.removeEventListener("click", handler));
            resolve(e.currentTarget.id);
        }

        buttons.forEach((btn) => btn.addEventListener("click", handler));
    });

}

// Esempio di utilizzo
async function chooseLevelFromMenu(characters) {
    const textTop = document.getElementById('text-top');
    const mapChooserMenu = document.getElementById('map-chooser');
    mapChooserMenu.classList.remove('hidden');


    console.log('Loading internal games...');
    loadAllInternalGames();
    console.log('Internal games loaded!');

    textTop.innerHTML = "CHOOSE THE MAP!";
    const scelta = await getMenuClick();
    console.log("Hai scelto: " + scelta);

    textTop.innerHTML = "";
    mapChooserMenu.classList.add('hidden');
    document.getElementById('loading-backdrop').classList.add('hidden');


    return loadInternalGame(mapChooserMenu.getAttribute('maps-path') + scelta, characters);
}


export { chooseLevelFromMenu };