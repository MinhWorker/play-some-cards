/**
 * "Kết quả": a full-screen overlay with every finished round of the match, one tab per round.
 * Each player shows their three chi (the cards, the hand, the points), binh lủng / tới trắng,
 * and the round's points. Opened and closed with its button on this screen only.
 */
import { type Button, titleStyle } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import type { Card } from '../game/cards.js';
import { CARD_RATIO, CardSprite, type CardTextures } from './Card.js';

/** One player in one round, told from your side (see MauBinhView.chiOutcome). */
export interface ResultEntry {
  name: string;
  avatar: string;
  /** Their points this round. */
  points: number;
  /** "Binh lủng", "Sảnh rồng", "Hết giờ, máy xếp"… */
  mark: { text: string; color: string } | null;
  /** Chi 1, 2, 3. */
  rows: Card[][];
  chi: { name: string; points: number | null }[];
  me: boolean;
}

/** A card overlaps the one before it by this much of its width; rows overlap the same way. */
const STEP = 0.56;
const ROW_STEP = 0.55;

interface Section {
  back: Phaser.GameObjects.Graphics;
  avatar: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  points: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  cards: CardSprite[];
  labels: Phaser.GameObjects.Text[];
}

export class ResultsPanel {
  private backdrop: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private empty: Phaser.GameObjects.Text;
  private tabs: Button[] = [];
  private sections: Section[] = [];
  private rounds: ResultEntry[][] = [];
  private selected = 0;
  private area = { width: 0, height: 0, top: 0, hud: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textures: CardTextures,
    /** Makes a tab button (the scene's `button`). */
    private readonly makeButton: (text: string, onTap: () => void) => Button,
  ) {
    // Covers the whole screen and keeps taps off the table underneath.
    this.backdrop = scene.add
      .rectangle(0, 0, 10, 10, 0x05140f, 0.78)
      .setOrigin(0)
      .setDepth(980)
      .setInteractive()
      .setVisible(false);
    this.panel = scene.add.graphics().setDepth(981).setVisible(false);
    this.title = this.text('Kết quả các vòng', 30).setDepth(982).setVisible(false);
    this.empty = this.text('Chưa có vòng nào xong', 20)
      .setColor('#d8f5e3')
      .setDepth(982)
      .setVisible(false);
  }

  get visible() {
    return this.backdrop.visible;
  }

  private text(text: string, size: number) {
    return this.scene.add
      .text(0, 0, text, { ...titleStyle(size), strokeThickness: 3 })
      .setOrigin(0.5);
  }

  /** Shows these rounds (oldest first), on the last one unless `keepTab` and it still exists. */
  show(rounds: ResultEntry[][], keepTab = false) {
    const same = keepTab && this.visible && this.rounds.length === rounds.length;
    this.rounds = rounds;
    if (!same) this.selected = Math.max(0, rounds.length - 1);
    for (const obj of [this.backdrop, this.panel, this.title]) obj.setVisible(true);
    this.empty.setVisible(rounds.length === 0);
    for (const t of this.tabs) t.container.destroy();
    this.tabs = rounds.map((_, i) => {
      const tab = this.makeButton(`Vòng ${i + 1}`, () => this.pick(i));
      tab.container.setDepth(983);
      return tab;
    });
    this.buildSections();
    this.layout(this.area);
  }

  hide() {
    for (const obj of [this.backdrop, this.panel, this.title, this.empty]) obj.setVisible(false);
    for (const t of this.tabs) t.container.destroy();
    this.tabs = [];
    this.clearSections();
  }

  private pick(round: number) {
    this.selected = round;
    this.buildSections();
    this.layout(this.area);
  }

  private clearSections() {
    for (const s of this.sections) {
      for (const obj of [s.back, s.avatar, s.name, s.points, s.mark, ...s.cards, ...s.labels]) {
        obj.destroy();
      }
    }
    this.sections = [];
  }

  private buildSections() {
    this.clearSections();
    const add = this.scene.add;
    this.sections = (this.rounds[this.selected] ?? []).map((entry) => ({
      back: add.graphics().setDepth(982),
      avatar: add.image(0, 0, entry.avatar).setDepth(983),
      name: this.text(entry.me ? `${entry.name} (bạn)` : entry.name, 18)
        .setOrigin(0, 0.5)
        .setDepth(983),
      points: this.text(signed(entry.points), 24)
        .setOrigin(1, 0.5)
        .setColor(colorOf(entry.points))
        .setDepth(983),
      mark: this.text(entry.mark?.text ?? '', 15)
        .setOrigin(0, 0.5)
        .setColor(entry.mark?.color ?? '#ffffff')
        .setDepth(983),
      cards: entry.rows.flatMap((row, r) =>
        row.map((card, i) =>
          new CardSprite(this.scene, this.textures, card).setDepth(984 + (3 - r) * 10 + i),
        ),
      ),
      labels: entry.chi.map(({ name, points }, r) =>
        this.text(`Chi ${r + 1}: ${name}${points === null ? '' : ` ${signed(points)}`}`, 15)
          .setOrigin(0, 0.5)
          .setColor(points === null ? '#ffffff' : colorOf(points))
          .setDepth(1020),
      ),
    }));
  }

  /** The whole screen: `top` is the first free pixel below the room bar. */
  layout(area: { width: number; height: number; top: number; hud: number }) {
    this.area = area;
    if (!this.visible) return;
    const { width, height, top, hud } = area;
    this.backdrop.setSize(width, height);
    const pad = 12 * hud;
    const x0 = 8 * hud;
    const y0 = top + 4 * hud;
    const panelW = width - 2 * x0;
    const panelH = height - y0 - 8 * hud;
    this.panel.clear();
    this.panel.fillStyle(0x0f3d34, 0.97).fillRoundedRect(x0, y0, panelW, panelH, 18 * hud);
    this.panel.lineStyle(4, 0xf2c14e, 1).strokeRoundedRect(x0, y0, panelW, panelH, 18 * hud);
    // Room on the right of the title for the screen's own "Đóng" button.
    this.title
      .setFontSize(26 * hud)
      .setPosition(x0 + pad, y0 + 26 * hud)
      .setOrigin(0, 0.5);
    // Tabs: one row of chips, as wide as they may be.
    const tabH = 38 * hud;
    const tabsY = y0 + 64 * hud;
    const gap = 6 * hud;
    const tabW = Math.min(
      110 * hud,
      (panelW - 2 * pad - gap * (this.tabs.length - 1)) / this.tabs.length,
    );
    this.tabs.forEach((tab, i) => {
      tab.setSize(tabW, tabH).setPosition(x0 + pad + tabW / 2 + i * (tabW + gap), tabsY);
      tab.container
        .setAlpha(i === this.selected ? 1 : 0.55)
        .setScale(i === this.selected ? 1.05 : 1);
    });
    const bodyTop = tabsY + tabH / 2 + 10 * hud;
    const bodyH = y0 + panelH - pad - bodyTop;
    this.empty.setFontSize(20 * hud).setPosition(width / 2, bodyTop + bodyH / 2);
    const n = this.sections.length;
    if (!n) return;
    // One column on phones, two on wide screens.
    const cols = width >= 700 && n > 1 ? 2 : 1;
    const rows = Math.ceil(n / cols);
    const colW = (panelW - 2 * pad - (cols - 1) * gap) / cols;
    const sectionH = (bodyH - (rows - 1) * gap) / rows;
    const head = 30 * hud;
    const labelW = 120 * hud;
    // Cards as big as the section allows: three overlapping rows under the name line.
    const w = Math.min(
      54 * hud,
      (sectionH - head - 10 * hud) / (CARD_RATIO * (1 + 2 * ROW_STEP)),
      (colW - labelW - 16 * hud) / (1 + 4 * STEP),
    );
    this.sections.forEach((s, k) => {
      const sx = x0 + pad + (k % cols) * (colW + gap);
      const sy = bodyTop + Math.floor(k / cols) * (sectionH + gap);
      const entry = this.rounds[this.selected]?.[k];
      s.back.clear();
      s.back
        .fillStyle(entry?.me ? 0xf2c14e : 0x000000, entry?.me ? 0.18 : 0.25)
        .fillRoundedRect(sx, sy, colW, sectionH, 12 * hud);
      const size = 24 * hud;
      s.avatar.setDisplaySize(size, size).setPosition(sx + 8 * hud + size / 2, sy + head / 2);
      s.name.setFontSize(17 * hud).setPosition(sx + 14 * hud + size, sy + head / 2);
      s.points.setFontSize(22 * hud).setPosition(sx + colW - 8 * hud, sy + head / 2);
      s.mark.setFontSize(14 * hud).setPosition(s.name.x + s.name.width + 8 * hud, sy + head / 2);
      const cardsTop = sy + head + (w * CARD_RATIO) / 2;
      let card = 0;
      (entry?.rows ?? []).forEach((row, r) => {
        // Chi 3 on top, chi 1 at the bottom, like on the table.
        const y = cardsTop + (2 - r) * w * CARD_RATIO * ROW_STEP;
        row.forEach((_, i) => {
          s.cards[card++]?.setCardWidth(w).setPosition(sx + 8 * hud + w / 2 + i * w * STEP, y);
        });
        s.labels[r]
          ?.setFontSize(14 * hud)
          .setPosition(sx + 16 * hud + w * (1 + 4 * STEP), y - w * CARD_RATIO * 0.25);
      });
    });
  }
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const colorOf = (n: number) => (n > 0 ? '#7dff9a' : n < 0 ? '#ff8a7a' : '#ffffff');
