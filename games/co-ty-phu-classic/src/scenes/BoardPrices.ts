import type Phaser from 'phaser';
import { BOARD } from '../game/model.js';
import { BOARD_CELLS } from './boardGeometry.js';

let textureId = 0;

/** A single ink overlay with each price projected onto the outer strip of its tile. */
export class BoardPrices {
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, sourceKey: string) {
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ink = canvas.getContext('2d')!;
    BOARD.forEach((square, index) => {
      const amount = square.price ?? square.tax;
      if (amount === undefined) return;
      const quad = BOARD_CELLS[index]!;
      const point = (u: number, v: number) => {
        const [tl, tr, br, bl] = quad;
        return {
          x:
            (tl![0] * (1 - u) * (1 - v) +
              tr![0] * u * (1 - v) +
              br![0] * u * v +
              bl![0] * (1 - u) * v) *
            canvas.width,
          y:
            (tl![1] * (1 - u) * (1 - v) +
              tr![1] * u * (1 - v) +
              br![1] * u * v +
              bl![1] * (1 - u) * v) *
            canvas.height,
        };
      };
      const left = index > 10 && index < 20;
      const right = index > 30 && index < 40;
      const top = index > 20 && index < 30;
      const center = point(
        left ? 0.18 : right ? 0.82 : 0.5,
        top ? 0.17 : left || right ? 0.5 : 0.84,
      );
      const along = left
        ? point(0.18, 0.88)
        : right
          ? point(0.82, 0.12)
          : point(0.88, top ? 0.17 : 0.84);
      const across = left
        ? point(0.05, 0.5)
        : right
          ? point(0.95, 0.5)
          : point(0.5, top ? 0.3 : 0.97);
      ink.save();
      ink.setTransform(
        (along.x - center.x) / 80,
        (along.y - center.y) / 80,
        (across.x - center.x) / 24,
        (across.y - center.y) / 24,
        center.x,
        center.y,
      );
      ink.font = 'bold 44px "Baloo 2", sans-serif';
      ink.fillStyle = '#514432';
      ink.textAlign = 'center';
      ink.textBaseline = 'middle';
      ink.fillText(String(amount), 0, 0, 142);
      ink.restore();
    });
    const key = `${sourceKey}.prices.${textureId++}`;
    scene.textures.addCanvas(key, canvas);
    this.image = scene.add.image(0, 0, key).setDepth(-0.8);
    scene.events.once('shutdown', () => {
      this.image.destroy();
      scene.textures.remove(key);
    });
  }

  layout(x: number, y: number, width: number, height: number) {
    this.image.setPosition(x, y).setDisplaySize(width, height);
  }
}
