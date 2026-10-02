import type Phaser from 'phaser';
import { BOARD, isDeed, type State } from '../game/model.js';
import { boardAmounts } from './boardAmounts.js';
import { BOARD_CELLS } from './boardGeometry.js';

let textureId = 0;

/**
 * Prices and place names printed into the board plane without covering symbols or color bands.
 * An owned property's name takes its owner's color, as its symbol does (TileOwnerSymbols).
 */
export class BoardPrices {
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly ink: CanvasRenderingContext2D;
  private amounts: (string | null)[] = [];
  private amountsKey = '';

  constructor(
    scene: Phaser.Scene,
    sourceKey: string,
    private readonly playerColors: readonly number[],
  ) {
    const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    this.ink = canvas.getContext('2d')!;
    const key = `${sourceKey}.prices.${textureId++}`;
    this.texture = scene.textures.addCanvas(key, canvas)!;
    this.image = scene.add.image(0, 0, key).setDepth(-0.8);
    scene.events.once('shutdown', () => {
      this.image.destroy();
      scene.textures.remove(key);
    });
  }

  setState(
    state: Pick<State, 'properties' | 'players'> & Partial<Pick<State, 'round' | 'shortages'>>,
  ) {
    const amounts = boardAmounts(state);
    const owners = state.properties.map((property) => property.owner ?? '-');
    const key = `${amounts.join(',')}|${owners.join(',')}`;
    if (key === this.amountsKey) return;
    this.amountsKey = key;
    this.amounts = amounts;
    const ink = this.ink;
    const canvas = ink.canvas;
    ink.clearRect(0, 0, canvas.width, canvas.height);
    BOARD.forEach((square, index) => {
      const amount = amounts[index];
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
      if (amount !== null && amount !== undefined) {
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
        ink.fillText(amount, 0, 0, 142);
        ink.restore();
      }

      const corner = index % 10 === 0;
      const nameCenter = point(
        left ? 0.67 : right ? 0.33 : 0.5,
        top ? 0.67 : left || right ? 0.5 : corner ? 0.7 : 0.33,
      );
      const nameAlong = left
        ? point(0.67, 0.95)
        : right
          ? point(0.33, 0.05)
          : point(0.95, top ? 0.67 : corner ? 0.7 : 0.33);
      const nameAcross = left
        ? point(0.54, 0.5)
        : right
          ? point(0.46, 0.5)
          : point(0.5, top ? 0.8 : corner ? 0.83 : 0.46);
      ink.save();
      ink.setTransform(
        (nameAlong.x - nameCenter.x) / 80,
        (nameAlong.y - nameCenter.y) / 80,
        (nameAcross.x - nameCenter.x) / 24,
        (nameAcross.y - nameCenter.y) / 24,
        nameCenter.x,
        nameCenter.y,
      );
      const owner = isDeed(square) ? state.properties[index]?.owner : null;
      const color = owner === null || owner === undefined ? undefined : this.playerColors[owner];
      ink.fillStyle = color === undefined ? '#514432' : ownerInk(color);
      ink.textAlign = 'center';
      ink.textBaseline = 'middle';
      ink.font = 'bold 30px "Baloo 2", sans-serif';
      // The airport's tile says where it goes rather than what it is.
      const name = square.kind === 'airport' ? 'Chuyến bay đến…' : square.name;
      const words = name.split(' ');
      let lines = [name];
      if (ink.measureText(name).width > 154 && words.length > 1) {
        let narrowest = Number.POSITIVE_INFINITY;
        for (let split = 1; split < words.length; split++) {
          const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
          const width = Math.max(...candidate.map((line) => ink.measureText(line).width));
          if (width < narrowest) {
            narrowest = width;
            lines = candidate;
          }
        }
      }
      const widest = Math.max(...lines.map((line) => ink.measureText(line).width));
      const fontSize = Math.min(30, (30 * 154) / widest);
      ink.font = `bold ${fontSize}px "Baloo 2", sans-serif`;
      lines.forEach((line, row) => {
        ink.fillText(line, 0, (row - (lines.length - 1) / 2) * 28);
      });
      ink.restore();
    });
    this.texture.update();
  }

  layout(x: number, y: number, width: number, height: number) {
    this.image.setPosition(x, y).setDisplaySize(width, height);
  }
}

/** A player color darkened like the owner's symbol ink, as a CSS color. */
export function ownerInk(color: number) {
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.72);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}
