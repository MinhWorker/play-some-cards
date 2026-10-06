import { FONT } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { auctionRaise, BOARD, type View } from '../../game/model.js';
import { propertyActionIcon } from './PropertyActionIcons.js';

/** Review the deed being offered before starting an irreversible bidding session. */
export class AuctionConfirmPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly raise: Phaser.GameObjects.Text;
  private readonly terms: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  readonly confirm: Phaser.GameObjects.Zone;
  readonly cancel: Phaser.GameObjects.Zone;
  private readonly confirmLabel: Phaser.GameObjects.Text;
  private readonly cancelLabel: Phaser.GameObjects.Text;
  private width = 620;
  private snapshot = '';
  private personalTurn = 0;
  ownerSeat = -1;
  square: number | null = null;
  visible = false;

  constructor(scene: Phaser.Scene, onConfirm: () => void, onClose: () => void) {
    this.container = scene.add.container(0, 0).setDepth(32);
    this.ink = scene.add.graphics();
    this.container.add(this.ink);
    const text = (size: number, color = '#493a28') => {
      const label = scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: size, color, fontStyle: 'bold' })
        .setOrigin(0.5);
      this.container.add(label);
      return label;
    };
    this.title = text(30);
    this.name = text(36, '#a74d36');
    this.detail = text(23);
    this.raise = text(24, '#875020');
    this.terms = text(22).setAlign('center');
    this.icon = scene.add.image(0, 0, propertyActionIcon(scene, 'auction')).setDisplaySize(42, 42);
    this.container.add(this.icon);
    const button = (action: () => void) => {
      const hit = scene.add
        .zone(0, 0, 10, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          if (this.visible) action();
        });
      this.container.add(hit);
      return hit;
    };
    this.confirmLabel = text(25).setText('Mở đấu giá');
    this.cancelLabel = text(25).setText('Hủy');
    this.cancel = button(onClose);
    this.confirm = button(onConfirm);
    this.hide();
  }

  show(state: View, seat: number, square: number) {
    const deed = state.properties[square]!;
    this.ownerSeat = seat;
    this.square = square;
    this.snapshot = JSON.stringify(deed);
    this.personalTurn = state.playerTurns[seat]!;
    this.name.setText(BOARD[square]!.name);
    this.detail.setText(
      deed.houses === 5
        ? 'Kèm khách sạn'
        : deed.houses
          ? `Kèm ${deed.houses} nhà`
          : 'Chưa có công trình',
    );
    this.raise.setText(
      `Mỗi lần tăng giá tối thiểu ${auctionRaise(square).toLocaleString('vi-VN')} ₫`,
    );
    this.terms.setText(
      'Người thắng nhận tài sản và công trình.\nKhông có người trả giá: bạn giữ tài sản.' +
        (deed.mortgaged ? '\nKhoản vay và hạn chuộc được giữ nguyên.' : ''),
    );
    this.visible = true;
    this.container.setVisible(true);
    this.draw();
  }

  matches(state: View, seat: number | null) {
    return (
      this.square !== null &&
      seat === this.ownerSeat &&
      this.personalTurn === state.playerTurns[this.ownerSeat] &&
      this.snapshot === JSON.stringify(state.properties[this.square])
    );
  }

  layout(screen: { width: number; height: number; top: number }) {
    this.width = Math.min(620, screen.width - 40);
    this.container.setPosition(
      (screen.width - this.width) / 2,
      screen.top + (screen.height - screen.top - 430) / 2,
    );
    if (this.visible) this.draw();
  }

  private draw() {
    const w = this.width;
    this.ink.clear().fillStyle(0xfff8e5).fillRoundedRect(0, 0, w, 430, 16);
    this.ink.lineStyle(3, 0xd2a14c).strokeRoundedRect(0, 0, w, 430, 16);
    this.icon.setPosition(w / 2 - 164, 44);
    this.title.setText('Xác nhận đấu giá').setPosition(w / 2 + 24, 44);
    this.name.setPosition(w / 2, 104);
    this.detail.setPosition(w / 2, 149);
    this.raise.setPosition(w / 2, 198);
    this.terms.setWordWrapWidth(w - 48).setPosition(w / 2, 278);
    for (const [hit, label, x, width, color] of [
      [this.cancel, this.cancelLabel, w * 0.24, w * 0.38, 0xf1e5cc],
      [this.confirm, this.confirmLabel, w * 0.72, w * 0.46, 0xffdf89],
    ] as const) {
      this.ink.fillStyle(color).fillRoundedRect(x - width / 2, 350, width, 60, 9);
      this.ink.lineStyle(2, 0xc39648).strokeRoundedRect(x - width / 2, 350, width, 60, 9);
      hit.setPosition(x, 380).setSize(width, 60);
      hit.input?.hitArea.setTo(0, 0, width, 60);
      label.setPosition(x, 380);
    }
  }

  hide() {
    this.visible = false;
    this.square = null;
    this.container.setVisible(false);
  }
}
