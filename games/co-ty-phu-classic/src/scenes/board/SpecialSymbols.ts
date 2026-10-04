import type Phaser from 'phaser';
import { BOARD } from '../../game/model.js';
import { addGlow } from '../effects/glow.js';
import { BOARD_CELLS } from './boardGeometry.js';

type SourceImage = CanvasImageSource & { width: number; height: number };

/** A printed symbol cut out of the board image: its box (board-image pixels) and ink coverage. */
interface Ink {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0–255 per pixel: how much of it is the symbol's ink. */
  alpha: Uint8ClampedArray;
}

/** A canvas texture shown over the board; `draw` repaints it. */
interface Layer {
  ink: Ink;
  canvas: HTMLCanvasElement;
  texture: Phaser.Textures.CanvasTexture;
  image: Phaser.GameObjects.Image;
  glow?: Phaser.Filters.Glow;
}

const START = 0;
const POWER = 12;
const AIRPORT = 20;
const WATER = 28;

let nextId = 0;

/**
 * Special squares, brought to life on their printed symbols only (never the tile):
 * the power plant's bolt crackles violet, the waterworks' drop sloshes cyan, the airport's plane
 * blinks its night lights, and Start's arrow glows gold in turn with its printed gray.
 * Chance, Chest, stations and taxes have distinct glints; the jail stays plain gray.
 */
export class SpecialSymbols {
  private readonly layers: Layer[] = [];
  private readonly power: Layer;
  private readonly water: Layer;
  private readonly startArrow: Layer;
  private readonly accents: {
    square: number;
    kind: 'chance' | 'chest' | 'station' | 'tax';
    color: number;
    light: number;
    layer: Layer;
  }[] = [];
  private owners: readonly (number | null)[] = [];
  private playerColors: readonly number[] = [];
  private lastPaint = -Infinity;
  private readonly lights: { image: Phaser.GameObjects.Image; point: Point }[];
  private readonly lightTexture: Phaser.Textures.CanvasTexture;
  /** The plane's tail, nose-side wingtips (board-image pixels). */
  private readonly plane: { tail: Point; top: Point; bottom: Point };
  private readonly width: number;
  private readonly height: number;
  private place = { left: 0, top: 0, width: 1, height: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    sourceKey: string,
  ) {
    const source = scene.textures.get(sourceKey).getSourceImage() as SourceImage;
    this.width = source.width;
    this.height = source.height;
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, this.width, this.height);

    this.power = this.layer(this.inkOf(pixels, POWER), undefined, 0xa78bfa);
    this.water = this.layer(this.inkOf(pixels, WATER), undefined, 0x22d3ee);
    const arrow = this.inkOf(pixels, START);
    this.startArrow = this.layer(arrow, 0xf2a922, 0xffcf65);
    BOARD.forEach((square, index) => {
      const kind = square.kind;
      if (kind !== 'chance' && kind !== 'chest' && kind !== 'station' && kind !== 'tax') return;
      const [color, light] =
        kind === 'chance'
          ? [0x9d408f, 0xffcbf2]
          : kind === 'chest'
            ? [0xb98221, 0xffe6a0]
            : kind === 'tax'
              ? index === 4
                ? [0xb66b35, 0xffdf91]
                : [0xa44362, 0xffc7df]
              : [0x257d77, 0x79bfff];
      const layer = this.layer(
        this.inkOf(pixels, index),
        color,
        kind === 'chance' || kind === 'chest' ? light : undefined,
      );
      if (layer.glow) layer.glow.outerStrength = 1;
      this.accents.push({ square: index, kind, color: color!, light: light!, layer });
    });
    const plane = this.inkOf(pixels, AIRPORT);
    this.plane = planePoints(plane);
    const light = document.createElement('canvas');
    light.width = light.height = 16;
    const g = light.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(8, 8, 3, 0, Math.PI * 2);
    g.fill();
    const key = `co-ty-phu-classic.lights.${nextId++}`;
    this.lightTexture = scene.textures.addCanvas(key, light)!;
    this.lights = [
      { point: this.plane.top, color: 0xff4d4d },
      { point: this.plane.bottom, color: 0x4dff88 },
      { point: this.plane.tail, color: 0xfffbe6 },
    ].map(({ point, color }) => {
      const image = scene.add.image(0, 0, key).setTint(color).setDepth(-0.84).setVisible(false);
      addGlow(image, color, 3, 10);
      return { point, image };
    });
    scene.events.once('shutdown', () => this.destroy());
  }

  /** The board image's place on screen (center and size), as for the other board layers. */
  layout(x: number, y: number, width: number, height: number) {
    this.place = { left: x - width / 2, top: y - height / 2, width, height };
    for (const { ink, image } of this.layers) {
      const at = this.toWorld(ink.x, ink.y);
      image.setPosition(at.x, at.y).setDisplaySize(...this.size(ink.w, ink.h));
    }
    const diameter = this.size(this.width * 0.0021, 0)[0] * (16 / 3);
    for (const { point, image } of this.lights) {
      const at = this.toWorld(point.x, point.y);
      image.setPosition(at.x, at.y).setDisplaySize(diameter, diameter);
    }
  }

  /** Animates the symbols; `time` in ms. */
  update(time: number) {
    const t = time / 1000;
    this.drawPower(t);
    this.drawWater(t);
    // Start: its arrow glows gold, then fades back to the printed gray.
    const pulse = (Math.sin(t * Math.PI * 1.4) + 1) / 2;
    this.startArrow.image.setAlpha(pulse);
    if (this.startArrow.glow) this.startArrow.glow.outerStrength = 1 + pulse * 2;
    this.drawPlaneLights(t);
    // Limit canvas uploads while keeping glow and plane lights smooth on every frame.
    if (time - this.lastPaint >= 1000 / 24) {
      this.lastPaint = time;
      for (const accent of this.accents) this.drawAccent(accent, t);
    }
  }

  setOwners(owners: readonly (number | null)[], colors: readonly number[]) {
    this.owners = owners;
    this.playerColors = colors;
  }

  private drawAccent(accent: (typeof this.accents)[number], time: number) {
    const { layer, kind, square, light } = accent;
    const { ink, canvas, texture } = layer;
    const { w, h } = ink;
    const g = canvas.getContext('2d')!;
    const t = time + square * 0.17;
    const owner = this.owners[square];
    const color =
      kind === 'station' && owner !== null && owner !== undefined
        ? (this.playerColors[owner] ?? accent.color)
        : accent.color;
    const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.fillStyle = hex(color);
    g.fillRect(0, 0, w, h);
    if (kind === 'chance') {
      // Four rotating glints inside the printed star, with a breathing bright center.
      const radius = Math.max(w, h) * (0.25 + 0.14 * Math.sin(t * 2));
      const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
      glow.addColorStop(0, '#fff5fd');
      glow.addColorStop(0.45, hex(light));
      glow.addColorStop(1, hex(color));
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,245,253,0.75)';
      g.lineWidth = Math.max(1, w * 0.065);
      for (let ray = 0; ray < 4; ray++) {
        const angle = t * 0.65 + (ray * Math.PI) / 2;
        g.beginPath();
        g.moveTo(w / 2, h / 2);
        g.lineTo(w / 2 + Math.cos(angle) * w * 0.5, h / 2 + Math.sin(angle) * h * 0.5);
        g.stroke();
      }
    } else {
      // Chest: a rising gold sheen; stations: a passing headlight; taxes: falling coin glints.
      const vertical = kind !== 'station' || square === 15 || square === 35;
      const length = vertical ? h : w;
      const speed = kind === 'chest' ? 0.3 : kind === 'station' ? 0.55 : 0.4;
      const progress = (t * speed) % 1;
      const position = (kind === 'chest' ? 1 - progress : progress) * length * 1.8 - length * 0.4;
      const band = length * (kind === 'station' ? 0.3 : 0.4);
      const shine = vertical
        ? g.createLinearGradient(0, position - band, 0, position + band)
        : g.createLinearGradient(position - band, 0, position + band, 0);
      shine.addColorStop(0, hex(color));
      shine.addColorStop(0.4, hex(color));
      shine.addColorStop(0.5, hex(light));
      shine.addColorStop(0.6, hex(color));
      shine.addColorStop(1, hex(color));
      g.fillStyle = shine;
      g.fillRect(0, 0, w, h);
      if (kind === 'chest') {
        g.fillStyle = `rgba(255,245,204,${0.2 + (Math.sin(t * 3) + 1) * 0.25})`;
        g.beginPath();
        g.arc(w * 0.5, h * 0.55, Math.min(w, h) * 0.12, 0, Math.PI * 2);
        g.fill();
      }
    }
    this.cutTo(g, ink);
    texture.update();
  }

  private drawPower(t: number) {
    const { canvas, ink, texture } = this.power;
    const g = canvas.getContext('2d')!;
    const { w, h } = ink;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    // A bright band races across the violet bolt, with an odd quick flicker.
    const sweep = ((t * 2.6) % 1) * (w + h) * 2 - (w + h);
    const gradient = g.createLinearGradient(sweep, 0, sweep + w + h, h);
    gradient.addColorStop(0, '#5b21b6');
    gradient.addColorStop(0.35, '#8b5cf6');
    gradient.addColorStop(0.5, '#f5f3ff');
    gradient.addColorStop(0.65, '#a78bfa');
    gradient.addColorStop(1, '#5b21b6');
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, h);
    const flicker = Math.sin(t * 47) * Math.sin(t * 13);
    if (flicker > 0.6) {
      g.fillStyle = `rgba(237, 233, 254, ${(flicker - 0.6) * 1.5})`;
      g.fillRect(0, 0, w, h);
    }
    this.cutTo(g, ink);
    texture.update();
  }

  private drawWater(t: number) {
    const { canvas, ink, texture } = this.water;
    const g = canvas.getContext('2d')!;
    const { w, h } = ink;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#0e7490';
    g.fillRect(0, 0, w, h);
    // A light surface sloshing over the deep water, a glint along its edge.
    const surface = (x: number) =>
      h * (0.48 + 0.1 * Math.sin((x / w) * Math.PI * 2.2 + t * 3.2) * Math.sin(t * 1.3 + 0.6));
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= w; x += 2) g.lineTo(x, surface(x));
    g.lineTo(w, 0);
    g.closePath();
    g.fillStyle = '#22d3ee';
    g.fill();
    g.beginPath();
    for (let x = 0; x <= w; x += 2) g.lineTo(x, surface(x));
    g.strokeStyle = 'rgba(236, 254, 255, 0.9)';
    g.lineWidth = Math.max(1.5, h * 0.06);
    g.stroke();
    this.cutTo(g, ink);
    texture.update();
  }

  /** Red and green wingtips blinking together, a white double strobe at the tail. */
  private drawPlaneLights(t: number) {
    const blink = t % 1.1 < 0.16;
    const strobe = t % 1.6;
    const white = strobe < 0.07 || (strobe > 0.16 && strobe < 0.23);
    this.lights.forEach(({ image }, i) => {
      image.setVisible(i === 2 ? white : blink);
    });
  }

  /** Keeps only the symbol's ink of what was painted. */
  private cutTo(g: CanvasRenderingContext2D, ink: Ink) {
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(maskOf(ink), 0, 0);
  }

  /**
   * The symbol's dark gray ink in a square's middle (its border and the game's own text stay
   * out: names and prices are not in the board image).
   */
  private inkOf(pixels: ImageData, square: number): Ink {
    const cell = BOARD_CELLS[square]!;
    const xs = cell.map(([x]) => x * this.width);
    const ys = cell.map(([, y]) => y * this.height);
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const insetX = (maxX - minX) * 0.14;
    const insetY = (maxY - minY) * 0.14;
    const x0 = Math.ceil(minX + insetX);
    const x1 = Math.floor(maxX - insetX);
    const y0 = Math.ceil(minY + insetY);
    const y1 = Math.floor(maxY - insetY);
    const coverage = (x: number, y: number) => {
      const o = (y * this.width + x) * 4;
      const [r, g, b, a] = [
        pixels.data[o]!,
        pixels.data[o + 1]!,
        pixels.data[o + 2]!,
        pixels.data[o + 3]!,
      ];
      const light = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (!a || light > 132 || chroma > 58) return 0;
      return Math.min(1, (142 - light) / 40);
    };
    // Shrink the box to the ink itself.
    let [bx0, by0, bx1, by1] = [x1, y1, x0, y0];
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (coverage(x, y) > 0.2) {
          bx0 = Math.min(bx0, x);
          bx1 = Math.max(bx1, x);
          by0 = Math.min(by0, y);
          by1 = Math.max(by1, y);
        }
    const pad = 2;
    const x = Math.max(0, bx0 - pad);
    const y = Math.max(0, by0 - pad);
    const w = Math.max(1, Math.min(this.width - x, bx1 - bx0 + 1 + pad * 2));
    const h = Math.max(1, Math.min(this.height - y, by1 - by0 + 1 + pad * 2));
    const alpha = new Uint8ClampedArray(w * h);
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) alpha[row * w + col] = coverage(x + col, y + row) * 255;
    return { x, y, w, h, alpha };
  }

  /** A canvas over `ink`'s box; with `tint`, a still copy of the symbol in that color. */
  private layer(ink: Ink, tint?: number, glowColor?: number): Layer {
    const canvas = document.createElement('canvas');
    canvas.width = ink.w;
    canvas.height = ink.h;
    if (tint !== undefined) {
      const g = canvas.getContext('2d')!;
      const image = g.createImageData(ink.w, ink.h);
      ink.alpha.forEach((a, i) => {
        image.data[i * 4] = (tint >> 16) & 0xff;
        image.data[i * 4 + 1] = (tint >> 8) & 0xff;
        image.data[i * 4 + 2] = tint & 0xff;
        image.data[i * 4 + 3] = a;
      });
      g.putImageData(image, 0, 0);
    }
    const key = `co-ty-phu-classic.symbol.${nextId++}`;
    const texture = this.scene.textures.addCanvas(key, canvas)!;
    const image = this.scene.add.image(0, 0, key).setOrigin(0).setDepth(-0.85);
    const glow = glowColor === undefined ? undefined : addGlow(image, glowColor);
    const layer = { ink, canvas, texture, image, glow };
    this.layers.push(layer);
    return layer;
  }

  private toWorld(x: number, y: number) {
    return {
      x: this.place.left + (x / this.width) * this.place.width,
      y: this.place.top + (y / this.height) * this.place.height,
    };
  }

  private size(w: number, h: number): [number, number] {
    return [(w / this.width) * this.place.width, (h / this.height) * this.place.height];
  }

  private destroy() {
    for (const { image, texture } of this.layers) {
      image.destroy();
      this.scene.textures.remove(texture.key);
    }
    for (const { image } of this.lights) image.destroy();
    this.scene.textures.remove(this.lightTexture.key);
  }
}

interface Point {
  x: number;
  y: number;
}

const masks = new WeakMap<Ink, HTMLCanvasElement>();

/** `ink` as a canvas: white, as opaque as the ink. */
function maskOf(ink: Ink) {
  let mask = masks.get(ink);
  if (mask) return mask;
  mask = document.createElement('canvas');
  mask.width = ink.w;
  mask.height = ink.h;
  const g = mask.getContext('2d')!;
  const image = g.createImageData(ink.w, ink.h);
  ink.alpha.forEach((a, i) => {
    image.data.fill(255, i * 4, i * 4 + 3);
    image.data[i * 4 + 3] = a;
  });
  g.putImageData(image, 0, 0);
  masks.set(ink, mask);
  return mask;
}

/** The plane's tail (its leftmost ink) and wingtips (top- and bottom-most), in board pixels. */
function planePoints(ink: Ink) {
  let tail = { x: Number.POSITIVE_INFINITY, y: 0 };
  let top = { x: 0, y: Number.POSITIVE_INFINITY };
  let bottom = { x: 0, y: Number.NEGATIVE_INFINITY };
  for (let y = 0; y < ink.h; y++)
    for (let x = 0; x < ink.w; x++) {
      if (ink.alpha[y * ink.w + x]! < 128) continue;
      if (x < tail.x) tail = { x, y };
      if (y < top.y) top = { x, y };
      if (y > bottom.y) bottom = { x, y };
    }
  const at = (p: Point) => ({ x: ink.x + p.x, y: ink.y + p.y });
  return { tail: at(tail), top: at(top), bottom: at(bottom) };
}
