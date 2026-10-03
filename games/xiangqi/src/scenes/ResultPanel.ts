/**
 * The panel over the board once a game is over: a red lacquer banner with the outcome
 * ("Chiến thắng!", "Thua rồi", "Hoà", or who won for a spectator) and the winner's general,
 * how it ended, then how long it took, how many moves and how many pieces each side took.
 * "Xem bàn cờ" puts it away (the board's "Kết quả" button brings it back).
 */
import { type Button, FONT, type GameScene } from '@psc/sdk/client';
import type Phaser from 'phaser';

const PAPER = 0xfbf1dc;
const LACQUER = 0x8b1d17;
const GOLD = 0xd9a441;
const INK = '#5c2d12';

export interface ResultData {
  title: string;
  reason: string;
  /** Image keys of the generals shown on the banner (the winner's, or both for a draw). */
  generals: string[];
  rows: [label: string, value: string][];
}

export class ResultPanel {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private reason: Phaser.GameObjects.Text;
  private generals: Phaser.GameObjects.Image[] = [];
  private rows: Phaser.GameObjects.Text[][] = [];

  constructor(
    private scene: GameScene,
    private close: Button,
    depth: number,
  ) {
    this.bg = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontStyle: '800',
      color: '#ffffff',
      stroke: '#4a0d0a',
      align: 'center',
    });
    this.title.setOrigin(0.5);
    this.reason = scene.add.text(0, 0, '', { fontFamily: FONT, fontStyle: '700', color: INK });
    this.reason.setOrigin(0.5);
    this.container = scene.add
      .container(0, 0, [this.bg, this.title, this.reason, close.container])
      .setDepth(depth)
      .setVisible(false);
  }

  get shown() {
    return this.container.visible;
  }

  /**
   * Fills the panel for a board `width` wide centered at (x, y) and shows it; `pop` animates it
   * in (the game just ended in front of you).
   */
  show(data: ResultData, at: { x: number; y: number; width: number; hud: number }, pop: boolean) {
    const { scene } = this;
    const hud = at.hud;
    const w = Math.min(at.width * 0.82, 520 * hud);
    const pad = 22 * hud;
    const bannerH = 64 * hud;
    const rowH = 38 * hud;
    const buttonH = 52 * hud;
    const h = bannerH + pad + 36 * hud + pad * 0.5 + data.rows.length * rowH + pad + buttonH + pad;
    const top = -h / 2;

    const g = this.bg.clear();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 6, top + 8, w, h, 18 * hud);
    g.fillStyle(LACQUER, 1).fillRoundedRect(-w / 2, top, w, h, 18 * hud);
    const inset = 7 * hud;
    g.fillStyle(PAPER, 1).fillRoundedRect(
      -w / 2 + inset,
      top + bannerH,
      w - 2 * inset,
      h - bannerH - inset,
      12 * hud,
    );
    g.lineStyle(Math.max(1.5, 2 * hud), GOLD, 1);
    g.strokeRoundedRect(-w / 2 + inset / 2, top + inset / 2, w - inset, h - inset, 15 * hud);
    // Thin rules between the stats.
    g.lineStyle(1, 0x5c2d12, 0.18);

    this.title
      .setText(data.title)
      .setFontSize(38 * hud)
      .setStroke('#4a0d0a', 6 * hud)
      .setPosition(0, top + bannerH / 2 + 2 * hud);

    for (const img of this.generals) img.destroy();
    const icon = bannerH * 1.5;
    this.generals = data.generals.map((key, i) => {
      const side = data.generals.length === 1 ? -1 : i === 0 ? -1 : 1;
      return scene.add
        .image(side * (w / 2 - icon * 0.3), top + bannerH * 0.3, key)
        .setDisplaySize(icon, icon)
        .setAngle(side * -12);
    });
    this.container.add(this.generals);

    let y = top + bannerH + pad + 18 * hud;
    this.reason
      .setText(data.reason)
      .setFontSize(28 * hud)
      .setPosition(0, y);
    y += 18 * hud + pad * 0.5;

    for (const row of this.rows) for (const t of row) t.destroy();
    this.rows = data.rows.map(([label, value], i) => {
      const cy = y + rowH * (i + 0.5);
      if (i > 0) g.lineBetween(-w / 2 + pad * 1.5, cy - rowH / 2, w / 2 - pad * 1.5, cy - rowH / 2);
      const style = { fontFamily: FONT, fontSize: `${Math.round(24 * hud)}px`, color: INK };
      const left = scene.add
        .text(-w / 2 + pad * 1.5, cy, label, { ...style, fontStyle: '600' })
        .setOrigin(0, 0.5)
        .setAlpha(0.8);
      const right = scene.add
        .text(w / 2 - pad * 1.5, cy, value, { ...style, fontStyle: '800' })
        .setOrigin(1, 0.5);
      return [left, right];
    });
    this.container.add(this.rows.flat());
    y += data.rows.length * rowH + pad;

    this.close.setSize(Math.min(w - 2 * pad, 240 * hud), buttonH).setPosition(0, y + buttonH / 2);
    this.container.bringToTop(this.close.container);

    this.container.setPosition(at.x, at.y).setVisible(true);
    scene.runtime.cancelTweens(this.container);
    if (pop) {
      this.container.setScale(0.6).setAlpha(0);
      scene.runtime.tween({
        targets: this.container,
        scale: 1,
        alpha: 1,
        duration: 280,
        ease: 'Back.easeOut',
      });
    } else {
      this.container.setScale(1).setAlpha(1);
    }
  }

  hide() {
    (this.scene as GameScene).runtime.cancelTweens(this.container);
    this.container.setVisible(false);
  }
}

/** A game's length as m:ss (h:mm:ss past an hour). */
export function formatPlayed(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}
