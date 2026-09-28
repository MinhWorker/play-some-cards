/**
 * The players, listed in the top-left corner like a voice-chat overlay: picture, name, cards in
 * hand and points. Whose turn it is lights up, with the turn clock running around the picture.
 */
import { titleStyle } from '@psc/sdk/client';
import type Phaser from 'phaser';

export interface PlayerRow {
  name: string;
  /** Texture key of their picture. */
  avatar: string;
  /** Second line, e.g. "13 lá · 5 điểm". */
  info: string;
  /** Their place this round ("Nhất"), "Bỏ lượt", "Rời bàn"…; `null` for none. */
  badge: string | null;
  badgeColor?: string;
  turn: boolean;
  /** Greyed out (left the table). */
  dim: boolean;
}

/** Green like a speaking ring, then yellow and red as the clock runs out. */
export function ringColor(left: number | null) {
  if (left === null || left > 0.5) return 0x43d17a;
  return left > 0.25 ? 0xffc93c : 0xff5a4f;
}

/**
 * A ring around a picture at (x, y): the turn highlight, and the part of the turn clock that
 * is `left` (1 → 0; `null` = no clock).
 */
export function drawRing(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  left: number | null,
) {
  const color = ringColor(left);
  g.lineStyle(Math.max(2, radius * 0.12), color, 0.35).strokeCircle(x, y, radius);
  const start = -Math.PI / 2;
  g.lineStyle(Math.max(3, radius * 0.18), color, 1);
  g.beginPath();
  g.arc(x, y, radius, start, start + Math.PI * 2 * (left ?? 1), false);
  g.strokePath();
}

interface RowObjects {
  back: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  avatar: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text;
}

export class PlayerList {
  private objects: RowObjects[] = [];
  private shown: PlayerRow[] = [];
  private place = { x: 0, y: 0, hud: 1, maxWidth: 200 };
  /** Where each row's turn ring goes, for `drawRing` (every frame while the clock runs). */
  private rings: { x: number; y: number; r: number }[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Shows these rows (in this order). */
  set(rows: PlayerRow[]) {
    while (this.objects.length < rows.length) this.objects.push(this.makeRow());
    while (this.objects.length > rows.length) {
      const o = this.objects.pop();
      for (const obj of Object.values(o ?? {})) obj.destroy();
    }
    this.shown = rows;
    this.draw();
  }

  /** Top-left corner of the list, the HUD scale, and how wide a row may get. */
  layout(x: number, y: number, hud: number, maxWidth: number) {
    this.place = { x, y, hud, maxWidth };
    this.draw();
  }

  /**
   * Redraws the turn ring with the clock (`left`: 1 → 0, `null` = no clock). Only the ring:
   * cheap enough for every frame, unlike the texts (each change redraws a text's texture).
   */
  drawRing(left: number | null) {
    this.shown.forEach((row, i) => {
      const o = this.objects[i] as RowObjects;
      const at = this.rings[i];
      o.ring.clear();
      if (row.turn && at) drawRing(o.ring, at.x, at.y, at.r, left);
    });
  }

  /** Places and fills every row (when the rows or the layout change). */
  private draw() {
    const { x, y, hud, maxWidth } = this.place;
    const size = 46 * hud;
    const rowH = 54 * hud;
    this.shown.forEach((row, i) => {
      const o = this.objects[i] as RowObjects;
      const cy = y + i * rowH + rowH / 2;
      const ax = x + size / 2;
      o.avatar.setTexture(row.avatar).setDisplaySize(size, size).setPosition(ax, cy);
      const textX = x + size + 8 * hud;
      const textW = maxWidth - size - 16 * hud;
      o.name.setFontSize(21 * hud).setPosition(textX, cy - 10 * hud);
      fit(o.name, row.name, textW);
      o.info.setFontSize(18 * hud).setPosition(textX, cy + 12 * hud);
      fit(o.info, row.info, textW);
      o.badge
        .setFontSize(14 * hud)
        .setText(row.badge ?? '')
        .setColor(row.badgeColor ?? '#ffe066')
        .setVisible(Boolean(row.badge));
      const nameEnd = textX + Math.max(o.name.width, o.info.width);
      o.badge.setPosition(nameEnd + 8 * hud, cy - 10 * hud);
      const w = Math.max(nameEnd, row.badge ? o.badge.x + o.badge.width : 0) - x + 12 * hud;
      o.back.clear();
      o.back
        .fillStyle(row.turn ? 0x123a22 : 0x000000, row.turn ? 0.78 : 0.45)
        .fillRoundedRect(x - 4 * hud, cy - rowH / 2 + 3 * hud, w, rowH - 6 * hud, rowH / 2);
      this.rings[i] = { x: ax, y: cy, r: size / 2 + 2 * hud };
      o.name.setColor(row.turn ? '#ffe066' : '#ffffff');
      for (const obj of Object.values(o)) obj.setAlpha(row.dim ? 0.45 : 1);
    });
    this.drawRing(null);
  }

  private makeRow(): RowObjects {
    const add = this.scene.add;
    const small = (size: number) => ({ ...titleStyle(size), strokeThickness: 3 });
    return {
      back: add.graphics().setDepth(800),
      avatar: add.image(0, 0, '__DEFAULT').setDepth(801),
      ring: add.graphics().setDepth(802),
      name: add.text(0, 0, '', small(19)).setOrigin(0, 0.5).setDepth(801),
      info: add.text(0, 0, '', small(14)).setOrigin(0, 0.5).setDepth(801).setColor('#d8f5e3'),
      badge: add.text(0, 0, '', small(14)).setOrigin(0, 0.5).setDepth(801),
    };
  }
}

/** Cuts `text` with "…" until it fits `maxWidth`. */
function fit(obj: Phaser.GameObjects.Text, text: string, maxWidth: number) {
  obj.setText(text);
  let chars = [...text];
  while (obj.width > maxWidth && chars.length > 1) {
    chars = chars.slice(0, -1);
    obj.setText(`${chars.join('').trimEnd()}…`);
  }
}
