import type Phaser from 'phaser';
import { BOARD_IMAGE_RATIO } from '../board/boardGeometry.js';
import { planePoint } from '../board/boardPlane.js';
import { PlayerPanelPattern } from './PlayerPanelPattern.js';

type PanelObject = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
type Anchor = { u: number; v: number };
type Point = { x: number; y: number };
type Layout = { left: number; top: number; size: number; imageH: number };
let nextId = 0;

/** Projects live text/image textures onto the same plane as the printed player panel. */
export class PlayerPanel {
  private readonly entries: { source: PanelObject; anchor: () => Anchor | null }[] = [];
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly ink: CanvasRenderingContext2D;
  private readonly width = 2048;
  private readonly height = this.width / BOARD_IMAGE_RATIO;
  private readonly offset: Point;
  private key = '';
  private readonly pattern: PlayerPanelPattern;

  constructor(scene: Phaser.Scene) {
    // Keep only the panel's bounding rectangle rather than another full-board texture.
    const corners = [
      [0.17, 0.16],
      [0.82, 0.16],
      [0.82, 0.41],
      [0.17, 0.41],
    ].map(([u, v]) => planePoint(u!, v!));
    const left = Math.floor(Math.min(...corners.map((p) => p.x)) * this.width) - 8;
    const top = Math.floor(Math.min(...corners.map((p) => p.y)) * this.height) - 8;
    this.offset = { x: left, y: top };
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(Math.max(...corners.map((p) => p.x)) * this.width) - left + 8;
    canvas.height = Math.ceil(Math.max(...corners.map((p) => p.y)) * this.height) - top + 8;
    this.ink = canvas.getContext('2d')!;
    this.pattern = new PlayerPanelPattern(
      scene,
      this.width,
      this.height,
      this.offset,
      canvas.width,
      canvas.height,
    );
    this.texture = scene.textures.addCanvas(`co-ty-phu-classic.player-panel.${nextId++}`, canvas)!;
    this.image = scene.add.image(0, 0, this.texture.key).setOrigin(0).setDepth(8);
    scene.events.once('shutdown', () => {
      this.image.destroy();
      scene.textures.remove(this.texture.key);
      for (const { source } of this.entries) source.destroy();
      this.entries.length = 0;
    });
  }

  add(source: PanelObject, anchor: () => Anchor | null) {
    this.entries.push({ source, anchor });
  }

  update(layout: Layout) {
    this.pattern.layout(layout);
    this.image
      .setPosition(
        layout.left + (this.offset.x / this.width) * layout.size,
        layout.top + (this.offset.y / this.height) * layout.imageH,
      )
      .setDisplaySize(
        (this.ink.canvas.width / this.width) * layout.size,
        (this.ink.canvas.height / this.height) * layout.imageH,
      );
    const visible: { source: PanelObject; anchor: Anchor }[] = [];
    for (const { source, anchor: getAnchor } of this.entries) {
      const anchor = getAnchor();
      // The countdown also appears in floating event/trade/auction controls.
      if (!anchor) {
        source.addToDisplayList();
        continue;
      }
      source.removeFromDisplayList();
      if (source.visible) visible.push({ source, anchor });
    }
    const key = [
      layout.size,
      layout.imageH,
      ...visible.map(({ source, anchor }) =>
        [
          anchor.u,
          anchor.v,
          source.displayWidth,
          source.displayHeight,
          source.originX,
          source.originY,
          source.alpha,
          source.texture.key,
          source.frame.name,
          source.frame.cutWidth,
          source.frame.cutHeight,
          'text' in source ? `${source.text}|${source.style.fontSize}|${source.style.color}` : '',
        ].join('|'),
      ),
    ].join(';');
    if (key === this.key) return;
    this.key = key;
    this.ink.clearRect(0, 0, this.ink.canvas.width, this.ink.canvas.height);
    for (const { source, anchor } of visible) this.draw(source, anchor, layout);
    this.texture.update();
  }

  private draw(source: PanelObject, anchor: Anchor, layout: Layout) {
    const point = planePoint(anchor.u, anchor.v);
    const along = planePoint(anchor.u + 0.001, anchor.v);
    const scale = ((along.x - point.x) * layout.size) / 0.001;
    const width = source.displayWidth / scale;
    const height = source.displayHeight / scale;
    const frame = source.frame;
    const image = frame.source.image as CanvasImageSource;
    const steps = 4;
    const at = (x: number, y: number) => {
      const p = planePoint(
        anchor.u + (x / steps - source.originX) * width,
        anchor.v + (y / steps - source.originY) * height,
      );
      return { x: p.x * this.width - this.offset.x, y: p.y * this.height - this.offset.y };
    };
    const dx = frame.cutWidth / steps;
    const dy = frame.cutHeight / steps;
    this.ink.globalAlpha = source.alpha;
    for (let y = 0; y < steps; y++) {
      for (let x = 0; x < steps; x++) {
        const tl = at(x, y),
          tr = at(x + 1, y),
          bl = at(x, y + 1),
          br = at(x + 1, y + 1);
        this.triangle(image, frame, [tl, tr, bl], tl, tr, bl, x * dx, y * dy, dx, dy);
        this.triangle(image, frame, [br, bl, tr], br, bl, tr, (x + 1) * dx, (y + 1) * dy, -dx, -dy);
      }
    }
    this.ink.globalAlpha = 1;
  }

  private triangle(
    image: CanvasImageSource,
    frame: Phaser.Textures.Frame,
    points: Point[],
    origin: Point,
    along: Point,
    across: Point,
    x: number,
    y: number,
    dx: number,
    dy: number,
  ) {
    const ink = this.ink;
    ink.save();
    // Subpixel overlap closes antialiasing seams between adjacent texture triangles.
    const cx = points.reduce((sum, p) => sum + p.x, 0) / 3;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / 3;
    ink.beginPath();
    points.forEach((p, i) => {
      const length = Math.hypot(p.x - cx, p.y - cy);
      const px = p.x + ((p.x - cx) / length) * 0.4;
      const py = p.y + ((p.y - cy) / length) * 0.4;
      if (i === 0) ink.moveTo(px, py);
      else ink.lineTo(px, py);
    });
    ink.closePath();
    ink.clip();
    const a = (along.x - origin.x) / dx,
      b = (along.y - origin.y) / dx;
    const c = (across.x - origin.x) / dy,
      d = (across.y - origin.y) / dy;
    ink.setTransform(a, b, c, d, origin.x - a * x - c * y, origin.y - b * x - d * y);
    ink.drawImage(
      image,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      0,
      0,
      frame.cutWidth,
      frame.cutHeight,
    );
    ink.restore();
  }
}
