/**
 * A ranking board over the table: after each round ("Hết vòng 2") and at the end of the match
 * ("Tổng kết"). Rows slide in one after another, best first.
 */
import { type GameScene, titleStyle } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

export interface StandingRow {
  /** "Nhất", "Nhì"… */
  place: string;
  placeColor: string;
  avatar: string;
  name: string;
  /** Right column, e.g. "+3" or "12 điểm". */
  score: string;
  /** Under the name, e.g. "Tổng 7 điểm" or "Rời bàn". */
  note: string;
  /** This screen's own player. */
  me: boolean;
}

export class Standings {
  private container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private footer: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Container[] = [];
  private data: StandingRow[] = [];
  private area = { cx: 0, top: 0, bottom: 0, width: 0, hud: 1 };

  constructor(private readonly scene: GameScene) {
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5);
    this.footer = scene.add
      .text(0, 0, '', { ...titleStyle(18), strokeThickness: 3 })
      .setOrigin(0.5)
      .setColor('#d8f5e3');
    this.container = scene.add
      .container(0, 0, [this.panel, this.title, this.footer])
      .setDepth(950)
      .setVisible(false);
  }

  get visible() {
    return this.container.visible;
  }

  show(title: string, rows: StandingRow[], animate: boolean) {
    for (const row of this.rows) row.destroy();
    this.data = rows;
    this.rows = rows.map((row) => this.makeRow(row));
    this.container.add(this.rows);
    this.title.setText(title);
    this.container.setVisible(true).setAlpha(1).setScale(1);
    this.layout(this.area);
    if (!animate) return;
    this.container.setAlpha(0).setScale(0.9);
    (this.scene as GameScene).runtime.tween({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
    this.rows.forEach((row, i) => {
      const x = row.x;
      row.setAlpha(0).setX(x - 40);
      (this.scene as GameScene).runtime.tween({
        targets: row,
        x,
        alpha: 1,
        delay: 180 + i * 140,
        duration: 260,
        ease: 'Quad.easeOut',
      });
    });
  }

  /** The line under the rows ("Vòng 3 bắt đầu sau 4 giây"). */
  setFooter(text: string) {
    // Called every frame while the countdown runs: redraw only when the words change.
    if (this.footer.text !== text) this.footer.setText(text);
  }

  hide() {
    this.container.setVisible(false);
  }

  /** Centered at `cx` between `top` and `bottom`, at most `width` wide. */
  layout(area: { cx: number; top: number; bottom: number; width: number; hud: number }) {
    this.area = area;
    if (!this.container.visible) return;
    const { cx, top, bottom, hud } = area;
    const width = Math.min(area.width, 460 * hud);
    const rowH = 58 * hud;
    const titleH = 64 * hud;
    const footerH = 36 * hud;
    const height = titleH + this.rows.length * rowH + footerH + 12 * hud;
    const y = top + Math.max(0, (bottom - top - height) / 2);
    // Scale around the panel's middle for the entrance.
    this.container.setPosition(cx, y + height / 2);
    const x0 = -width / 2;
    const y0 = -height / 2;
    this.panel.clear();
    this.panel.fillStyle(0x0d4a33, 0.94).fillRoundedRect(x0, y0, width, height, 20 * hud);
    this.panel.lineStyle(4, 0xf2c14e, 1).strokeRoundedRect(x0, y0, width, height, 20 * hud);
    this.title.setFontSize(36 * hud).setPosition(0, y0 + titleH / 2);
    this.rows.forEach((row, i) => {
      row.setPosition(0, y0 + titleH + i * rowH + rowH / 2);
      this.placeRow(row, this.data[i] as StandingRow, width, rowH, hud);
    });
    this.footer.setFontSize(17 * hud).setPosition(0, y0 + height - footerH / 2 - 4 * hud);
  }

  private makeRow(row: StandingRow) {
    const small = (size: number) => ({ ...titleStyle(size), strokeThickness: 3 });
    const add = this.scene.add;
    const back = add.graphics();
    const place = add.text(0, 0, row.place, small(20)).setOrigin(0.5).setColor(row.placeColor);
    const avatar = add.image(0, 0, row.avatar);
    const name = add.text(0, 0, row.name, small(20)).setOrigin(0, 0.5);
    const note = add.text(0, 0, row.note, small(14)).setOrigin(0, 0.5).setColor('#d8f5e3');
    const score = add.text(0, 0, row.score, small(22)).setOrigin(1, 0.5).setColor('#ffe066');
    return add.container(0, 0, [back, place, avatar, name, note, score]);
  }

  private placeRow(
    container: Phaser.GameObjects.Container,
    row: StandingRow,
    width: number,
    rowH: number,
    hud: number,
  ) {
    const [back, place, avatar, name, note, score] = container.list as [
      Phaser.GameObjects.Graphics,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Image,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ];
    const left = -width / 2 + 14 * hud;
    const inner = width - 28 * hud;
    back.clear();
    back
      .fillStyle(row.me ? 0xf2c14e : 0x000000, row.me ? 0.25 : 0.22)
      .fillRoundedRect(
        left - 6 * hud,
        -rowH / 2 + 4 * hud,
        inner + 12 * hud,
        rowH - 8 * hud,
        12 * hud,
      );
    place.setFontSize(19 * hud).setPosition(left + 24 * hud, 0);
    const size = 40 * hud;
    avatar.setDisplaySize(size, size).setPosition(left + 52 * hud + size / 2, 0);
    const textX = left + 60 * hud + size;
    name.setFontSize(19 * hud).setPosition(textX, -9 * hud);
    note.setFontSize(14 * hud).setPosition(textX, 12 * hud);
    score.setFontSize(21 * hud).setPosition(left + inner, 0);
    const room = left + inner - score.width - 10 * hud - textX;
    for (const [obj, text] of [
      [name, row.name],
      [note, row.note],
    ] as const) {
      obj.setText(text);
      let chars = [...text];
      while (obj.width > room && chars.length > 1) {
        chars = chars.slice(0, -1);
        obj.setText(`${chars.join('').trimEnd()}…`);
      }
    }
  }
}
