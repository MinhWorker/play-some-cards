import Phaser from 'phaser';
import { portals } from '@/games';
import { IMAGE_KEYS, imagePath } from '@/phaser/assets';

/** Loads the app's images and each game's portal (island) once, then starts the sky and tells PhaserStage it is ready. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const key of IMAGE_KEYS) this.load.image(key, imagePath(key));
    for (const portal of portals) if (portal.url) this.load.image(portal.texture, portal.url);
  }

  create() {
    this.scene.launch('sky');
    this.game.events.emit('booted');
  }
}
