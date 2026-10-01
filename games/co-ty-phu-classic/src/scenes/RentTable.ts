import type Phaser from 'phaser';
import type { Property, Square } from '../game/model.js';

/** Full rent schedule on demand, leaving the persistent tile card compact. */
export class RentTable {
  private panel: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[];
  visible = false;

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(32);
    const style = {
      fontFamily: '"Baloo 2"',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#493a28',
    };
    this.title = scene.add.text(0, 0, '', style).setOrigin(0.5).setDepth(33);
    this.rows = Array.from({ length: 21 }, () =>
      scene.add.text(0, 0, '', { ...style, fontSize: '20px' }).setDepth(33),
    );
    this.hide();
  }

  show(
    cell: Square,
    deed: Property,
    doubleRent: boolean,
    x: number,
    y: number,
    width: number,
    ownerJailed = false,
  ) {
    this.hide();
    this.visible = true;
    const schedule =
      cell.kind === 'street'
        ? (cell.rent ?? []).map((amount, i) => [
            i === 0 ? 'Đất trống' : i === 5 ? 'Khách sạn' : `${i} nhà`,
            `${(i === 0 && doubleRent ? amount * 2 : amount).toLocaleString('vi-VN')} ₫`,
            i === 0 ? '—' : `${cell.houseCost} ₫`,
          ])
        : cell.kind === 'station'
          ? [1, 2, 3, 4].map((i) => [`${i} ga`, `${25 * 2 ** (i - 1)} ₫`, '—'])
          : [
              ['1 đơn vị', '4× xúc xắc', '—'],
              ['2 đơn vị', '10× xúc xắc', '—'],
            ];
    const height = 140 + schedule.length * 34;
    this.panel.setVisible(true).fillStyle(0xfff8e5).fillRoundedRect(x, y, width, height, 16);
    this.panel.lineStyle(3, 0xd2a14c).strokeRoundedRect(x, y, width, height, 16);
    this.title
      .setVisible(true)
      .setText(cell.name)
      .setWordWrapWidth(width - 36, true)
      .setPosition(x + width / 2, y + 27);
    const columns = [x + 18, x + width * 0.43, x + width * 0.76];
    [['Cấp', 'Thuê', 'Xây'], ...schedule].forEach((row, i) => {
      row.forEach((text, column) => {
        this.rows[i * 3 + column]!.setVisible(true)
          .setText(text)
          .setPosition(columns[column]!, y + 58 + i * 34)
          .setColor(i === 0 ? '#906233' : '#493a28');
      });
    });
    if (deed.mortgaged) this.title.setText(`${cell.name} · Thế chấp`);
    else if (ownerJailed) this.title.setText(`${cell.name} · Chủ ở tù, thuê 0 ₫`);
    return { height };
  }

  hide() {
    this.visible = false;
    this.panel.clear().setVisible(false);
    this.title.setVisible(false);
    this.rows.forEach((row) => {
      row.setVisible(false);
    });
  }
}
