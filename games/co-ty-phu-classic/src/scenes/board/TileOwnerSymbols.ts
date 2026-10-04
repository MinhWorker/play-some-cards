import type Phaser from 'phaser';
import { BOARD, isDeed } from '../../game/model.js';
import { BOARD_CELLS } from './boardGeometry.js';

type Owner = number | null;
type SourceImage = CanvasImageSource & { width: number; height: number };

let nextTextureId = 0;

/** Recolors the printed property symbols while keeping their original Blender artwork. */
export class TileOwnerSymbols {
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly original: ImageData;
  private readonly width: number;
  private readonly height: number;
  private ownersKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    sourceTextureKey: string,
  ) {
    if (!scene.textures.exists(sourceTextureKey)) {
      throw new Error(`Missing tile owner source texture: ${sourceTextureKey}`);
    }
    const source = scene.textures.get(sourceTextureKey).getSourceImage() as SourceImage;
    this.width = source.width;
    this.height = source.height;

    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create tile owner symbol canvas');
    context.drawImage(source, 0, 0);
    this.original = context.getImageData(0, 0, this.width, this.height);
    context.clearRect(0, 0, this.width, this.height);
    this.context = context;

    const key = `${sourceTextureKey}.owners.${nextTextureId++}`;
    const texture = scene.textures.addCanvas(key, canvas);
    if (!texture) throw new Error(`Could not create tile owner texture: ${key}`);
    this.texture = texture;
    this.image = scene.add.image(0, 0, key).setDepth(-0.9);
    scene.events.once('shutdown', () => this.destroy());
  }

  layout(x: number, y: number, width: number, height: number) {
    this.image.setPosition(x, y).setDisplaySize(width, height);
  }

  setOwners(owners: readonly Owner[], playerColors: readonly number[]) {
    const key = owners.map((owner) => owner ?? '-').join(',');
    if (key === this.ownersKey) return;
    this.ownersKey = key;

    const frame = new ImageData(this.width, this.height);
    BOARD.forEach((square, index) => {
      const owner = owners[index];
      if (!isDeed(square) || owner === null || owner === undefined) return;
      const color = playerColors[owner];
      const cell = BOARD_CELLS[index];
      if (color === undefined || !cell) return;
      this.recolorSymbol(frame.data, cell, color);
    });

    this.context.putImageData(frame, 0, 0);
    this.texture.update();
  }

  destroy() {
    const key = this.image.texture.key;
    this.image.destroy();
    this.scene.textures.remove(key);
  }

  private recolorSymbol(
    pixels: Uint8ClampedArray,
    cell: readonly (readonly [number, number])[],
    color: number,
  ) {
    const xs = cell.map(([x]) => x * this.width);
    const ys = cell.map(([, y]) => y * this.height);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const halfWidth = (Math.max(...xs) - Math.min(...xs)) * 0.34;
    const halfHeight = (Math.max(...ys) - Math.min(...ys)) * 0.36;
    const x0 = Math.max(0, Math.floor(centerX - halfWidth));
    const x1 = Math.min(this.width - 1, Math.ceil(centerX + halfWidth));
    const y0 = Math.max(0, Math.floor(centerY - halfHeight));
    const y1 = Math.min(this.height - 1, Math.ceil(centerY + halfHeight));
    const targetRed = ((color >> 16) & 0xff) * 0.72;
    const targetGreen = ((color >> 8) & 0xff) * 0.72;
    const targetBlue = (color & 0xff) * 0.72;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const offset = (y * this.width + x) * 4;
        const red = this.original.data[offset]!;
        const green = this.original.data[offset + 1]!;
        const blue = this.original.data[offset + 2]!;
        const light = (red + green + blue) / 3;
        const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (this.original.data[offset + 3] === 0 || light > 132 || chroma > 58) continue;

        // Cover the printed ink fully (only its soft edge stays partial), so the symbol reads in
        // the owner's color, the same ink as the tile's name.
        const coverage = Math.min(1, (142 - light) / 40);
        pixels[offset] = targetRed;
        pixels[offset + 1] = targetGreen;
        pixels[offset + 2] = targetBlue;
        pixels[offset + 3] = coverage * 255;
      }
    }
  }
}
