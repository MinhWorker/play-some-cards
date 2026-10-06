import { FONT } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { BOARD, type View } from '../../game/model.js';
import { mortgageAmount, mortgageSquares } from '../../game/rules.js';

type Button = { hit: Phaser.GameObjects.Zone; label: Phaser.GameObjects.Text; enabled: boolean };
type Row = {
  hit: Phaser.GameObjects.Zone;
  name: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  amount: Phaser.GameObjects.Text;
  square?: number;
};

/** Select deeds together and review their individual and total mortgage proceeds. */
export class MortgagePanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly total: Phaser.GameObjects.Text;
  private readonly terms: Phaser.GameObjects.Text;
  private readonly pageLabel: Phaser.GameObjects.Text;
  readonly rows: Row[];
  readonly confirm: Button;
  private readonly cancel: Button;
  private readonly previous: Button;
  private readonly next: Button;
  private readonly selected = new Set<number>();
  private state?: View;
  private seat = 0;
  private page = 0;
  private width = 780;
  visible = false;

  constructor(scene: Phaser.Scene, onConfirm: (squares: number[]) => void, onClose: () => void) {
    this.container = scene.add.container(0, 0).setDepth(32);
    this.ink = scene.add.graphics();
    this.container.add(this.ink);
    const text = (size: number, color = '#493a28') => {
      const label = scene.add.text(0, 0, '', {
        fontFamily: FONT,
        fontSize: size,
        color,
        fontStyle: 'bold',
      });
      this.container.add(label);
      return label;
    };
    const zone = (action: () => void) => {
      const hit = scene.add
        .zone(0, 0, 10, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', action);
      this.container.add(hit);
      return hit;
    };
    this.title = text(34).setOrigin(0, 0.5);
    this.total = text(26).setOrigin(0.5);
    this.terms = text(18, '#79501e').setOrigin(0.5);
    this.pageLabel = text(22).setOrigin(0.5);
    this.rows = Array.from({ length: 6 }, () => {
      const row: Row = {
        hit: zone(() => {
          if (row.square === undefined) return;
          if (this.selected.has(row.square)) this.selected.delete(row.square);
          else this.selected.add(row.square);
          this.draw();
        }),
        name: text(24).setOrigin(0, 0.5),
        detail: text(18, '#79501e').setOrigin(0, 0.5),
        amount: text(25, '#875020').setOrigin(1, 0.5),
      };
      return row;
    });
    const button = (action: () => void): Button => {
      const button: Button = {
        hit: zone(() => {
          if (button.enabled) action();
        }),
        label: text(24).setOrigin(0.5),
        enabled: true,
      };
      return button;
    };
    this.cancel = button(onClose);
    this.confirm = button(() => onConfirm([...this.selected]));
    this.previous = button(() => {
      this.page--;
      this.draw();
    });
    this.next = button(() => {
      this.page++;
      this.draw();
    });
    this.hide();
  }

  get ownerSeat() {
    return this.seat;
  }

  show(state: View, seat: number, initial?: number) {
    this.state = state;
    this.seat = seat;
    this.page = 0;
    this.selected.clear();
    const squares = mortgageSquares(state, seat);
    if (initial !== undefined && squares.includes(initial)) {
      this.selected.add(initial);
      this.page = Math.floor(squares.indexOf(initial) / this.rows.length);
    }
    this.visible = true;
    this.container.setVisible(true);
    this.draw();
  }

  layout(screen: { width: number; height: number; top: number }) {
    this.width = Math.min(780, screen.width - 40);
    this.container.setPosition(
      (screen.width - this.width) / 2,
      screen.top + (screen.height - screen.top - 592) / 2,
    );
    if (this.visible) this.draw();
  }

  update(state: View) {
    if (this.state === state) return;
    this.state = state;
    if (this.visible) this.draw();
  }

  private draw() {
    if (!this.state) return;
    const state = this.state;
    const squares = mortgageSquares(state, this.seat);
    for (const square of this.selected) if (!squares.includes(square)) this.selected.delete(square);
    const pages = Math.max(1, Math.ceil(squares.length / this.rows.length));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const width = this.width;
    this.ink.clear().fillStyle(0xfff8e5).fillRoundedRect(0, 0, width, 592, 16);
    this.ink.lineStyle(3, 0xd2a14c).strokeRoundedRect(0, 0, width, 592, 16);
    this.title.setText('Thế chấp tài sản').setPosition(24, 38);
    this.pageLabel.setText(`${this.page + 1} / ${pages}`).setPosition(width - 112, 38);
    this.drawButton(this.previous, '‹', width - 176, 38, 54, 40, this.page > 0);
    this.drawButton(this.next, '›', width - 48, 38, 54, 40, this.page + 1 < pages);
    this.rows.forEach((row, i) => {
      row.square = squares[this.page * this.rows.length + i];
      const y = 76 + i * 60;
      const visible = row.square !== undefined;
      for (const obj of [row.hit, row.name, row.detail, row.amount]) obj.setVisible(visible);
      if (row.square === undefined) return;
      const selected = this.selected.has(row.square);
      const cell = BOARD[row.square]!;
      const houses = state.properties[row.square]!.houses;
      this.ink.fillStyle(selected ? 0xffe0a0 : 0xfffdf4).fillRoundedRect(16, y, width - 32, 56, 8);
      this.ink.lineStyle(2, selected ? 0x9a681c : 0xc7af82).strokeRect(30, y + 18, 20, 20);
      if (selected)
        this.ink
          .lineStyle(3, 0x79501e)
          .beginPath()
          .moveTo(34, y + 27)
          .lineTo(40, y + 33)
          .lineTo(48, y + 22)
          .strokePath();
      row.hit.setPosition(width / 2, y + 28).setSize(width - 32, 56);
      row.name.setText(cell.name).setPosition(66, y + 18);
      row.detail
        .setText(
          houses === 5
            ? 'Khách sạn'
            : houses > 0
              ? `${houses} nhà`
              : cell.kind === 'station'
                ? 'Bến xe'
                : 'Đất trống',
        )
        .setPosition(66, y + 41);
      row.amount
        .setText(`+${mortgageAmount(state, row.square).toLocaleString('vi-VN')} ₫`)
        .setPosition(width - 30, y + 28);
    });
    const amount = [...this.selected].reduce(
      (sum, square) => sum + mortgageAmount(state, square),
      0,
    );
    this.total
      .setText(`${this.selected.size} tài sản · Nhận ${amount.toLocaleString('vi-VN')} ₫`)
      .setPosition(width / 2, 454);
    this.terms.setText('Hạn chuộc: 3 lượt tiếp theo của người vay').setPosition(width / 2, 485);
    this.ink.lineStyle(1, 0xd2b885).lineBetween(24, 508, width - 24, 508);
    this.drawButton(this.cancel, 'Hủy', width * 0.22, 550, width * 0.34, 56, true);
    this.drawButton(
      this.confirm,
      `Xác nhận +${amount.toLocaleString('vi-VN')} ₫`,
      width * 0.68,
      550,
      width * 0.54,
      56,
      this.selected.size > 0,
    );
  }

  private drawButton(
    button: Button,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    enabled: boolean,
  ) {
    button.enabled = enabled;
    this.ink
      .fillStyle(enabled ? 0xffdf89 : 0xe2d8c4)
      .fillRoundedRect(x - w / 2, y - h / 2, w, h, 9);
    this.ink.lineStyle(2, 0xc39648).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 9);
    button.label
      .setText(label)
      .setPosition(x, y)
      .setAlpha(enabled ? 1 : 0.45);
    button.hit.setPosition(x, y).setSize(w, h);
  }

  hide() {
    this.visible = false;
    this.container.setVisible(false);
    this.selected.clear();
  }
}
