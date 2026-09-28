/**
 * The table: a sedge mat (chiếu cói) spread over the whole screen, sky bleed included. Warm light
 * falls on its middle, and a red and green pattern is "woven" into it around the play area: a
 * double frame, a flower in each corner and a faint medallion under the pile. The pattern is drawn
 * with a multiply blend, so the strands show through it like dyed sedge.
 */
import Phaser from 'phaser';

/** How wide one tile of `mat.webp` (512 px) lies on the table, in design units. */
const TILE_UNITS = 220;
const RED = 0xb0261e;
const GREEN = 0x26683a;

export interface MatLayout {
  /** Everything the screen shows, bleed included (design units). */
  area: { x: number; y: number; width: number; height: number };
  /** The play area the pattern frames. */
  frame: { left: number; top: number; right: number; bottom: number };
}

export class Mat {
  private readonly weave: Phaser.GameObjects.TileSprite;
  private readonly light: Phaser.GameObjects.Image;
  private readonly dye: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, texture: string) {
    this.weave = scene.add.tileSprite(0, 0, 2, 2, texture).setOrigin(0).setDepth(-100);
    this.light = scene.add.image(0, 0, lightTexture(scene)).setOrigin(0).setDepth(-99);
    this.dye = scene.add.graphics().setDepth(-98).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  layout({ area, frame }: MatLayout) {
    const tile = this.weave.texture.getSourceImage().width || 512;
    const scale = TILE_UNITS / tile;
    // The weave stays put on the frame whatever the bleed: tiles are counted from (0, 0).
    this.weave
      .setPosition(area.x, area.y)
      .setSize(area.width / scale, area.height / scale)
      .setScale(scale)
      .setTilePosition(area.x / scale, area.y / scale);
    this.light.setPosition(area.x, area.y).setDisplaySize(area.width, area.height);
    this.drawPattern(frame);
  }

  private drawPattern({ left, top, right, bottom }: MatLayout['frame']) {
    const g = this.dye.clear();
    const w = right - left;
    const h = bottom - top;
    // Two bands: red outside, a thin green one inside it.
    g.lineStyle(10, RED, 0.62).strokeRect(left, top, w, h);
    g.lineStyle(4, GREEN, 0.55).strokeRect(left + 17, top + 17, w - 34, h - 34);
    // A flower (a small diamond) inside each corner.
    const d = 22;
    for (const [x, y] of [
      [left + 48, top + 48],
      [right - 48, top + 48],
      [left + 48, bottom - 48],
      [right - 48, bottom - 48],
    ] as const) {
      diamond(g, x, y, d, GREEN, 0.3, RED, 0.55);
    }
    // The medallion under the pile.
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const m = Math.min(h * 0.32, 120);
    diamond(g, cx, cy, m, RED, 0, RED, 0.24);
    diamond(g, cx, cy, m * 0.5, GREEN, 0, GREEN, 0.22);
  }
}

/** A square stood on its corner at (x, y), `r` from the middle to each corner. */
function diamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  fill: number,
  fillAlpha: number,
  line: number,
  lineAlpha: number,
) {
  const points = [
    new Phaser.Math.Vector2(x, y - r),
    new Phaser.Math.Vector2(x + r, y),
    new Phaser.Math.Vector2(x, y + r),
    new Phaser.Math.Vector2(x - r, y),
  ];
  if (fillAlpha > 0) g.fillStyle(fill, fillAlpha).fillPoints(points, true);
  g.lineStyle(Math.max(4, r * 0.16), line, lineAlpha).strokePoints(points, true);
}

/** Warm light on the middle of the mat, darker toward the edges (drawn once, then stretched). */
function lightTexture(scene: Phaser.Scene) {
  const key = 'mat-light';
  if (scene.textures.exists(key)) return key;
  const size = 256;
  const canvas = scene.textures.createCanvas(key, size, size);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) return key;
  const g = ctx.createRadialGradient(size / 2, size * 0.45, 0, size / 2, size * 0.45, size * 0.72);
  g.addColorStop(0, 'rgba(255, 238, 196, 0.28)');
  g.addColorStop(0.45, 'rgba(255, 238, 196, 0.06)');
  g.addColorStop(0.75, 'rgba(74, 40, 8, 0.18)');
  g.addColorStop(1, 'rgba(60, 30, 5, 0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
  return key;
}
