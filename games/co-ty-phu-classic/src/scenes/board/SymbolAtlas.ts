import type Phaser from 'phaser';

let nextId = 0;

export type SymbolAnimation = { frames: string[]; duration: number };

/** Packs prepainted symbol loops into one texture so frame changes stay in the image batch. */
export class SymbolAtlas {
  private readonly canvas = document.createElement('canvas');
  private readonly ink: CanvasRenderingContext2D;
  private readonly frames: { name: string; x: number; y: number; w: number; h: number }[] = [];
  private x = 1;
  private y = 1;
  private rowHeight = 0;

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 2048;
    this.ink = this.canvas.getContext('2d')!;
  }

  add(source: HTMLCanvasElement) {
    const { width: w, height: h } = source;
    if (this.x + w + 1 > this.canvas.width) {
      this.x = 1;
      this.y += this.rowHeight + 2;
      this.rowHeight = 0;
    }
    if (this.y + h + 1 > this.canvas.height) throw new Error('Symbol atlas is full');
    const name = String(this.frames.length);
    this.ink.drawImage(source, this.x, this.y);
    this.frames.push({ name, x: this.x, y: this.y, w, h });
    this.x += w + 2;
    this.rowHeight = Math.max(this.rowHeight, h);
    return name;
  }

  animation(source: HTMLCanvasElement, duration: number, paint: (phase: number) => void) {
    const count = Math.max(1, Math.round((duration / 1000) * 24));
    const frames = Array.from({ length: count }, (_, frame) => {
      paint(frame / count);
      return this.add(source);
    });
    return { frames, duration };
  }

  upload(scene: Phaser.Scene) {
    // Upload once, cropped to the packed rows. Animation never refreshes this texture.
    const cropped = document.createElement('canvas');
    cropped.width = this.canvas.width;
    cropped.height = this.y + this.rowHeight + 1;
    cropped.getContext('2d')!.drawImage(this.canvas, 0, 0);
    const texture = scene.textures.addCanvas(
      `co-ty-phu-classic.symbol-atlas.${nextId++}`,
      cropped,
    )!;
    for (const frame of this.frames) texture.add(frame.name, 0, frame.x, frame.y, frame.w, frame.h);
    return texture;
  }
}
