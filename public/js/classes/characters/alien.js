import Player from '../player.js';

export default class Alien extends Player {
    constructor(opts = {}) {
        super({ ...opts, animationFolder: 'Alien' });
    }
}