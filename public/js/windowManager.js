const DEFAULT_DIMS = {
    'xs': {
        WORLD_WIDTH: 1280 / 2,
        WORLD_HEIGHT: 720 / 2,
    },
    's': {
        WORLD_WIDTH: 1280,
        WORLD_HEIGHT: 720,
    },
    'm': {
        WORLD_WIDTH: 1280 * 2,
        WORLD_HEIGHT: 720 * 2,
    },
    'l': {
        WORLD_WIDTH: 1280 * 3,
        WORLD_HEIGHT: 720 * 3,
    },
}
let { WORLD_WIDTH, WORLD_HEIGHT } = DEFAULT_DIMS['m'];

function setWorldSize({ WORLD_WIDTH: width, WORLD_HEIGHT: height }) {
    WORLD_WIDTH = width;
    WORLD_HEIGHT = height;
    const root = document.documentElement;
    // esponiamo le misure del mondo come variabili CSS (senza unità)
    root.style.setProperty('--world-width', String(WORLD_WIDTH));
    root.style.setProperty('--world-height', String(WORLD_HEIGHT));
    // manteniamo anche aspect-ratio sul container per maggiore robustezza (solo se supportato)
    const gameRoot = document.getElementById('game-root');
    if (gameRoot && typeof gameRoot.style.aspectRatio !== 'undefined') {
        gameRoot.style.aspectRatio = `${WORLD_WIDTH} / ${WORLD_HEIGHT}`;
    }
    // aggiorniamo subito la scala (se inizializzato)
    if (doUpdateRef) doUpdateRef();
}

let doUpdateRef = null;

function updateScale() {
    // chiama questa funzione una volta all'inizio (fa anche window.addEventListener)
    const root = document.documentElement;
    const gameRoot = document.getElementById('game-root');
    const game = document.getElementById('game');

    function doUpdate() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // px per unità di mondo: scala uniforme che mantiene le proporzioni WORLD_WIDTH:WORLD_HEIGHT
        const scale = Math.max(0.0001, Math.min(vw / WORLD_WIDTH, vh / WORLD_HEIGHT));

        // scriviamo la variabile CSS come "<number>px"
        root.style.setProperty('--wc-unit', `${scale}px`);

        // aggiorniamo le variabili del mondo (per sincronizzare se setWorldSize non è stato chiamato)
        root.style.setProperty('--world-width', String(WORLD_WIDTH));
        root.style.setProperty('--world-height', String(WORLD_HEIGHT));

        // aggiorniamo le dimensioni del container centrato (utile per centrare correttamente)
        if (gameRoot) {
            gameRoot.style.width = `${Math.round(WORLD_WIDTH * scale)}px`;
            gameRoot.style.height = `${Math.round(WORLD_HEIGHT * scale)}px`;
            // centratura se vuoi: gameRoot.style.margin = "0 auto";
        }

        // (opzionale): puoi aggiornare anche il background-size a seconda della scala
        if (game) {
            // usa la variabile wc-unit in CSS, ma qui aggiorniamo come fallback diretto
            // game.style.backgroundSize = `calc(20 * var(--wc-unit)) calc(20 * var(--wc-unit))`;
        }

        // debug rapido (togglare in produzione)
        // console.log('--wc-unit', getComputedStyle(root).getPropertyValue('--wc-unit'));
    }

    // rimuoviamo listener precedente se presente
    if (doUpdateRef) window.removeEventListener('resize', doUpdateRef);
    doUpdateRef = doUpdate;
    window.addEventListener('resize', doUpdate);
    doUpdate();
    return doUpdate;
}

function getScale() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--wc-unit') || '1px';
    return parseFloat(raw); // ritorna pixels per world unit (numero)
}

function screenToWorld(clientX, clientY) {
    // usiamo game-root (container centrato) per la conversione: è quello che contiene il mondo scalato
    const gameRoot = document.getElementById('game-root') || document.getElementById('game');
    if (!gameRoot) return { x: 0, y: 0 };

    const rect = gameRoot.getBoundingClientRect();
    const scale = getScale() || 1;

    // clientX/clientY sono relativi al viewport
    const wx = (clientX - rect.left) / scale;
    const wy = (clientY - rect.top) / scale;
    return { x: wx, y: wy };
}

function setEntity(el, worldX, worldY, worldW = 32, worldH = 48) {
    if (!el) return;
    // impostiamo le variabili CSS numeriche (senza unità)
    el.style.setProperty('--x', String(worldX));
    el.style.setProperty('--y', String(worldY));
    el.style.setProperty('--w', String(worldW));
    el.style.setProperty('--h', String(worldH));

    // opzionale: forniamo anche left/top/width/height in px arrotondati per evitare blur subpixel
    // const scale = getScale();
    // el.style.left = `${Math.round(worldX * scale)}px`;
    // el.style.top  = `${Math.round(worldY * scale)}px`;
    // el.style.width = `${Math.round(worldW * scale)}px`;
    // el.style.height = `${Math.round(worldH * scale)}px`;
}

function setPlayersDamage(players=[]) {
    if(players.length < 2) throw new Error("I player devono essere 2 in setPlayersDamage  (windowManager.js)");
    
    document.getElementById('player1-info-damage').innerText = players[0].damagePercent;
    document.getElementById('player2-info-damage').innerText = players[1].damagePercent;
}

export {
    DEFAULT_DIMS,
    setWorldSize,
    updateScale,
    screenToWorld,
    setEntity,
    getScale,
    setPlayersDamage,
};
