import type Phaser from 'phaser';
import { BOARD_IMAGE_RATIO } from '../board/boardGeometry.js';
import { planePoint } from '../board/boardPlane.js';
import { PlayerPanelPattern } from './PlayerPanelPattern.js';

type PanelObject = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
type Anchor = { u: number; v: number };
type Point = { x: number; y: number };
type Layout = { left: number; top: number; size: number; imageH: number };
let nextId = 0;
type Entry = {
  source: PanelObject;
  anchor: () => Anchor | null;
  image: Phaser.GameObjects.Image;
  texture?: Phaser.Textures.CanvasTexture;
  key: string;
  offset: Point;
};

/** Projects live text/image textures onto the same plane as the printed player panel. */
export class PlayerPanel {
  private readonly entries: Entry[] = [];
  private readonly width = 2048;
  private readonly height = this.width / BOARD_IMAGE_RATIO;
  private readonly pattern: PlayerPanelPattern;

  constructor(private readonly scene: Phaser.Scene) {
    // Keep only the panel's bounding rectangle rather than another full-board texture.
    const corners = [
      [0.17, 0.16],
      [0.82, 0.16],
      [0.82, 0.41],
      [0.17, 0.41],
    ].map(([u, v]) => planePoint(u!, v!));
    const left = Math.floor(Math.min(...corners.map((p) => p.x)) * this.width) - 8;
    const top = Math.floor(Math.min(...corners.map((p) => p.y)) * this.height) - 8;
    const offset = { x: left, y: top };
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(Math.max(...corners.map((p) => p.x)) * this.width) - left + 8;
    canvas.height = Math.ceil(Math.max(...corners.map((p) => p.y)) * this.height) - top + 8;
    this.pattern = new PlayerPanelPattern(
      scene,
      this.width,
      this.height,
      offset,
      canvas.width,
      canvas.height,
    );
    scene.events.once('shutdown', () => {
      for (const entry of this.entries) {
        entry.image.destroy();
        entry.source.destroy();
        if (entry.texture) scene.textures.remove(entry.texture.key);
      }
      this.entries.length = 0;
    });
  }

  add(source: PanelObject, anchor: () => Anchor | null) {
    this.entries.push({
      source,
      anchor,
      image: this.scene.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(8).setVisible(false),
      key: '',
      offset: { x: 0, y: 0 },
    });
  }

  update(layout: Layout) {
    this.pattern.layout(layout);
    for (const entry of this.entries) {
      const { source } = entry;
      const anchor = entry.anchor();
      // The countdown also appears in floating event/trade/auction controls.
      if (!anchor) {
        if (!source.displayList) source.addToDisplayList();
        entry.image.setVisible(false);
        continue;
      }
      if (source.displayList) source.removeFromDisplayList();
      entry.image.setVisible(source.visible).setAlpha(source.alpha);
      if (!source.visible) continue;
      const key = [
        layout.size,
        layout.imageH,
        anchor.u,
        anchor.v,
        source.displayWidth,
        source.displayHeight,
        source.originX,
        source.originY,
        source.texture.key,
        source.frame.name,
        source.frame.cutWidth,
        source.frame.cutHeight,
        'text' in source ? `${source.text}|${source.style.fontSize}|${source.style.color}` : '',
      ].join('|');
      if (key !== entry.key) {
        entry.key = key;
        this.draw(entry, anchor, layout);
      }
      const texture = entry.texture!;
      entry.image
        .setPosition(
          layout.left + (entry.offset.x / this.width) * layout.size,
          layout.top + (entry.offset.y / this.height) * layout.imageH,
        )
        .setDisplaySize(
          (texture.width / this.width) * layout.size,
          (texture.height / this.height) * layout.imageH,
        );
    }
  }

  private draw(entry: Entry, anchor: Anchor, layout: Layout) {
    const { source } = entry;
    const point = planePoint(anchor.u, anchor.v);
    const along = planePoint(anchor.u + 0.001, anchor.v);
    const scale = ((along.x - point.x) * layout.size) / 0.001;
    const width = source.displayWidth / scale;
    const height = source.displayHeight / scale;
    const frame = source.frame;
    const image = frame.source.image as CanvasImageSource;
    const steps = 4;
    const project = (x: number, y: number) => {
      const p = planePoint(
        anchor.u + (x / steps - source.originX) * width,
        anchor.v + (y / steps - source.originY) * height,
      );
      return { x: p.x * this.width, y: p.y * this.height };
    };
    const corners = [project(0, 0), project(steps, 0), project(0, steps), project(steps, steps)];
    const left = Math.floor(Math.min(...corners.map((p) => p.x))) - 2;
    const top = Math.floor(Math.min(...corners.map((p) => p.y))) - 2;
    const w = Math.ceil(Math.max(...corners.map((p) => p.x))) - left + 2;
    const h = Math.ceil(Math.max(...corners.map((p) => p.y))) - top + 2;
    entry.offset = { x: left, y: top };
    if (!entry.texture) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(w / 32) * 32;
      canvas.height = Math.ceil(h / 16) * 16;
      entry.texture = this.scene.textures.addCanvas(
        `co-ty-phu-classic.panel-ink.${nextId++}`,
        canvas,
      )!;
      entry.image.setTexture(entry.texture.key);
    } else if (w > entry.texture.width || h > entry.texture.height) {
      // Grow in blocks so a changing currency amount doesn't reallocate every frame.
      entry.texture.setSize(
        Math.max(entry.texture.width, Math.ceil(w / 32) * 32),
        Math.max(entry.texture.height, Math.ceil(h / 16) * 16),
      );
    }
    const ink = entry.texture.context;
    ink.clearRect(0, 0, entry.texture.width, entry.texture.height);
    const at = (x: number, y: number) => {
      const p = project(x, y);
      return { x: p.x - left, y: p.y - top };
    };
    const dx = frame.cutWidth / steps;
    const dy = frame.cutHeight / steps;
    for (let y = 0; y < steps; y++) {
      for (let x = 0; x < steps; x++) {
        const tl = at(x, y),
          tr = at(x + 1, y),
          bl = at(x, y + 1),
          br = at(x + 1, y + 1);
        this.triangle(ink, image, frame, [tl, tr, bl], tl, tr, bl, x * dx, y * dy, dx, dy);
        this.triangle(
          ink,
          image,
          frame,
          [br, bl, tr],
          br,
          bl,
          tr,
          (x + 1) * dx,
          (y + 1) * dy,
          -dx,
          -dy,
        );
      }
    }
    // Only this entry changes: the clock never repaints the avatar or player balances.
    entry.texture.refresh();
  }

  private triangle(
    ink: CanvasRenderingContext2D,
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
