import Phaser from 'phaser';
import { IMAGE_KEYS } from '../assets';

/** Loads every image once, then starts the sky and tells PhaserStage it is ready. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const key of IMAGE_KEYS) this.load.image(key, `/assets/${key}.webp`);
  }

  create() {
    this.scene.launch('sky');
    this.game.events.emit('booted');
  }
}
