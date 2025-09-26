function loadAudio() {
    const audio = {
        background: new Audio('./public/audio/bg_music.mp3'),
        sfx: {
            running: {
                p1: new Audio('./public/audio/sfx/footsteps.mp3'),
                p2: new Audio('./public/audio/sfx/footsteps.mp3'),
            },
            jumping: {
                p1: new Audio('./public/audio/sfx/jump.mp3'),
                p2: new Audio('./public/audio/sfx/jump.mp3'),
            },
            hitting: {
                p1: new Audio('./public/audio/sfx/punch.mp3'),
                p2: new Audio('./public/audio/sfx/punch.mp3'),
            },
        }
    }

    // bg music
    audio.background.loop = true;
    audio.background.volume = 0.2;
    // running
    audio.sfx.running.p1.loop = true;
    audio.sfx.running.p2.loop = true;
    audio.sfx.running.p1.volume = 0.5;
    audio.sfx.running.p2.volume = 0.5;
    // hitting
    audio.sfx.hitting.p1.volume = 0.5;
    audio.sfx.hitting.p2.volume = 0.5;

    return audio;
}

function manageAudio(players, audio) {
    audio.sfx.running.p1.pause();
    audio.sfx.running.p2.pause();

    switch (players[0].state) {
        case 'Moving':
            audio.sfx.running.p1.play();
            break;
        case 'Jumping':
            audio.sfx.jumping.p1.play();
            break;
        case 'AttackingActive':
            audio.sfx.hitting.p1.play();
            break;
        default:
            break;
    }

    switch (players[1].state) {
        case 'Moving':
            audio.sfx.running.p2.play();
            break;
        case 'Jumping':
            audio.sfx.jumping.p2.play();
            break;
        case 'AttackingActive':
            audio.sfx.hitting.p2.play();
            break;
        default:
            break;
    }
}


export { loadAudio, manageAudio };