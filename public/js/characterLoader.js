// file dove faccio scegliere agli utenti che personaggio usare (characterLoader.js)


/*
    Metodo che prende la lista di possibili personaggi da 'selectableCharacters.json'
    e crea una card per ogniuno contenente tutti i loro dati (la className sta nell'id) 
*/
function loadAllCharacters() {
    // ✅ vantaggio: ritorna subito i dati (nessun await)
    // ⚠️ svantaggio enorme: blocca tutto il browser finché non risponde il server

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "./public/data/manifest/selectableCharacters.json", false); // false = sincrono
    try {
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            const list = data.list;

            console.log(data);

            const characterChooserMenu = document.getElementById('character-chooser');
            characterChooserMenu.innerHTML = '';

            list.forEach(character => {
                characterChooserMenu.innerHTML += `
                <div class='character-card' id='${character.className}'>
                    <h2 class='character-card-title'>${character.name}</h2>
                    <img class='character-card-img' src='${character.imgBase64}' alt='${character.name}'>
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

/**
 * Prende 
**/
function getCharacterMenuClick(removeEventListeners) {
    return new Promise((resolve) => {
        const menu = document.getElementById("character-chooser");
        const buttons = menu.querySelectorAll(".character-card");

        function handler(e) {
            // remove listeners so we resolve only once
            if (removeEventListeners)
                buttons.forEach(b => b.removeEventListener("click", handler));
            resolve(e.currentTarget.id);
        }

        buttons.forEach((btn) => btn.addEventListener("click", handler));
    });

}

// Esempio di utilizzo
async function chooseCharactersFromMenu() {
    const textTop = document.getElementById('text-top');
    const characterChooserMenu = document.getElementById('character-chooser');
    characterChooserMenu.classList.remove('hidden');


    console.log('Loading characters...');
    loadAllCharacters();
    console.log('Characters loaded!');


    textTop.innerHTML = "CHOOSE YOUR CHARACTER!<br>PLAYER 1";
    const sceltaP1 = await getCharacterMenuClick();
    console.log("Player 1 ha scelto: " + sceltaP1);

    textTop.innerHTML = "CHOOSE YOUR CHARACTER!<br>PLAYER 2";
    const sceltaP2 = await getCharacterMenuClick(true);
    console.log("Player 2 ha scelto: " + sceltaP2);

    
    textTop.innerHTML = "";
    characterChooserMenu.classList.add('hidden');


    return { p1: sceltaP1, p2: sceltaP2 };
}


export { chooseCharactersFromMenu };