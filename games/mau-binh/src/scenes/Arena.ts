/**
 * The "bàn đấu": a panel in the middle of the table where one chi of every player is laid down
 * side by side to be compared, each with a label (name, hand, points). MauBinhView flies the
 * cards in and out; this only draws the panel and the labels and works out where things go.
 */
import { titleStyle } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { CARD_RATIO } from './Card.js';

/** A card overlaps the one before it by this much of its width. */
export const ARENA_STEP = 0.6;
/** Five cards side by side, in card widths. */
const ROW_WIDTH = 1 + 4 * ARENA_STEP;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArenaLayout {
  /** Card width. */
  w: number;
  /** Where each entry's cards are centered. */
  cells: { x: number; y: number }[];
  /** The label's distance below a cell's center. */
  labelDy: number;
}

export class Arena {
  private panel: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(740).setVisible(false);
  }

  /**
   * Where `count` entries go inside `area`: one row, one column or two columns, whichever lets
   * the cards be biggest (at most `maxW` wide).
   */
  layout(area: Rect, count: number, maxW: number, hud: number): ArenaLayout {
    const gap = 10 * hud;
    const labelH = 24 * hud;
    let best = { w: 0, cols: 1 };
    for (const cols of new Set([1, 2, count])) {
      const rows = Math.ceil(count / cols);
      const w = Math.min(
        maxW,
        (area.w - (cols + 1) * gap) / (cols * ROW_WIDTH),
        (area.h - rows * (labelH + gap) - gap) / (rows * CARD_RATIO),
      );
      if (w > best.w) best = { w, cols };
    }
    const { w, cols } = best;
    const rows = Math.ceil(count / cols);
    const cellW = area.w / cols;
    const cellH = w * CARD_RATIO + labelH + gap;
    const top = area.y + (area.h - rows * cellH) / 2;
    const cells = Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // A last row that isn't full is centered.
      const inRow = row === rows - 1 ? count - row * cols : cols;
      const x = area.x + area.w / 2 + (col - (inRow - 1) / 2) * cellW;
      return { x, y: top + row * cellH + (w * CARD_RATIO) / 2 };
    });
    return { w, cells, labelDy: (w * CARD_RATIO) / 2 + labelH / 2 };
  }

  /** The panel fades in over `area`. */
  show(area: Rect, hud: number) {
    const r = 18 * hud;
    this.panel.clear();
    this.panel.fillStyle(0x0a2a22, 0.82).fillRoundedRect(area.x, area.y, area.w, area.h, r);
    this.panel.lineStyle(3, 0xf2c14e, 0.9).strokeRoundedRect(area.x, area.y, area.w, area.h, r);
    if (this.panel.visible) return;
    this.panel.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: 200 });
  }

  hide() {
    this.clearLabels();
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 0,
      duration: 200,
      onComplete: () => this.panel.setVisible(false),
    });
  }

  /** A label under an entry: "Lan: Thùng +1". */
  label(x: number, y: number, text: string, color: string, hud: number) {
    const label = this.scene.add
      .text(x, y, text, { ...titleStyle(16 * hud), strokeThickness: 3 })
      .setOrigin(0.5)
      .setColor(color)
      .setDepth(790)
      .setScale(0.3);
    this.scene.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.labels.push(label);
  }

  clearLabels() {
    for (const l of this.labels) l.destroy();
    this.labels = [];
  }
}
