/**
 * The scoring rules over the table, opened and closed with the "Luật" button (on this screen
 * only). Every number comes from scoring.ts, so the panel always matches the game.
 */
import { titleStyle } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import { CHI_BONUSES, CHI_POINT, FOUL_POINTS, SCOOP_BONUS, SPECIALS } from '../game/scoring.js';

/** A heading (no points) or a rule with its points. */
type Line = { heading: string } | { text: string; points: string };

function lines(rounds: number, seconds: number): Line[] {
  return [
    { heading: `${rounds} vòng · ${seconds} giây xếp bài` },
    { text: 'Chi 1 (5 lá) ≥ chi 2 (5 lá) ≥ chi 3 (3 lá)', points: '' },
    { heading: 'So từng chi với từng người' },
    { text: 'Thắng / thua một chi', points: `+${CHI_POINT} / −${CHI_POINT}` },
    { text: 'Sập 3 chi (thắng cả ba)', points: `thêm +${SCOOP_BONUS}` },
    { text: 'Binh lủng, với mỗi người', points: `−${FOUL_POINTS}` },
    { heading: 'Thắng chi bằng bộ đặc biệt' },
    ...CHI_BONUSES.map((b) => ({ text: b.name, points: `+${b.points}` })),
    { heading: 'Tới trắng (thắng luôn mỗi người)' },
    ...[...SPECIALS].reverse().map((s) => ({ text: s.name, points: `+${s.points}` })),
  ];
}

export class RulesPanel {
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  /** Tapping the panel closes it too. */
  private hit: Phaser.GameObjects.Zone;
  private title: Phaser.GameObjects.Text;
  private rows: { line: Line; left: Phaser.GameObjects.Text; right: Phaser.GameObjects.Text }[] =
    [];
  private area = { cx: 0, top: 0, bottom: 0, width: 0, hud: 1 };

  constructor(
    private readonly scene: Phaser.Scene,
    onClose: () => void,
  ) {
    this.panel = scene.add.graphics();
    this.hit = scene.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive();
    this.hit.on('pointerup', onClose);
    this.title = scene.add.text(0, 0, 'Luật tính điểm', titleStyle(34)).setOrigin(0.5);
    this.container = scene.add
      .container(0, 0, [this.panel, this.hit, this.title])
      .setDepth(960)
      .setVisible(false);
  }

  get visible() {
    return this.container.visible;
  }

  /** Shows the rules of this room. */
  show(rounds: number, seconds: number) {
    for (const r of this.rows) {
      r.left.destroy();
      r.right.destroy();
    }
    const small = (size: number) => ({ ...titleStyle(size), strokeThickness: 3 });
    this.rows = lines(rounds, seconds).map((line) => {
      const heading = 'heading' in line;
      const left = this.scene.add
        .text(0, 0, heading ? line.heading : line.text, small(18))
        .setOrigin(heading ? 0.5 : 0, 0.5)
        .setColor(heading ? '#ffe8a3' : '#ffffff');
      const right = this.scene.add
        .text(0, 0, heading ? '' : line.points, small(18))
        .setOrigin(1, 0.5)
        .setColor('#ffe066');
      return { line, left, right };
    });
    this.container.add(this.rows.flatMap((r) => [r.left, r.right]));
    this.container.setVisible(true);
    this.layout(this.area);
  }

  hide() {
    this.container.setVisible(false);
  }

  /** Centered at `cx` between `top` and `bottom`, at most `width` wide. */
  layout(area: { cx: number; top: number; bottom: number; width: number; hud: number }) {
    this.area = area;
    if (!this.container.visible) return;
    const { cx, top, bottom } = area;
    const titleH = 52;
    const lineH = 27;
    const pad = 18;
    const natural = titleH + this.rows.length * lineH + pad * 2;
    // Shrinks to fit short screens.
    const scale = Math.min(area.hud, (bottom - top) / natural);
    const width = Math.min(area.width, 440 * scale);
    const height = natural * scale;
    const x0 = cx - width / 2;
    const y0 = top + Math.max(0, (bottom - top - height) / 2);
    this.hit.setPosition(x0, y0).setSize(width, height);
    this.panel.clear();
    this.panel.fillStyle(0x0f3d34, 0.96).fillRoundedRect(x0, y0, width, height, 20 * scale);
    this.panel.lineStyle(4, 0xf2c14e, 1).strokeRoundedRect(x0, y0, width, height, 20 * scale);
    this.title.setFontSize(30 * scale).setPosition(cx, y0 + (pad + titleH / 2) * scale);
    this.rows.forEach(({ line, left, right }, i) => {
      const y = y0 + (pad + titleH + i * lineH + lineH / 2) * scale;
      const heading = 'heading' in line;
      left.setFontSize((heading ? 17 : 16) * scale).setPosition(heading ? cx : x0 + 18 * scale, y);
      right.setFontSize(16 * scale).setPosition(x0 + width - 18 * scale, y);
    });
  }
}
