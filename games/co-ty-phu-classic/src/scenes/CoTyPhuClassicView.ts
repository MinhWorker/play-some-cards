import { GameView, type ViewContext } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { BOARD, GROUP_COLORS, isDeed, type View } from '../game/model.js';

type Ctx = ViewContext<View>;
type TapButton = {
  box: Phaser.GameObjects.NineSlice;
  hit: Phaser.GameObjects.Zone;
  text: Phaser.GameObjects.Text;
  action: () => void;
};

const PLAYER_COLORS = [0xdf6554, 0x5793d3, 0x60af72, 0xe6be52];
const shortName = (name: string) =>
  name
    .replace('Cộng đồng', 'Quỹ')
    .replace('Cơ hội', 'May')
    .replace('Nhà tù / Thăm', 'Nhà tù')
    .replace('Bãi đỗ miễn phí', 'Đỗ xe')
    .replace('Thuế thu nhập', 'Thuế')
    .replace('Thuế xa xỉ', 'Thuế')
    .replace('Xuất phát', 'START');

/** Square 0 is the bottom right corner; numbering runs clockwise. */
function gridPoint(i: number): [number, number] {
  if (i <= 10) return [10 - i, 10];
  if (i <= 20) return [0, 20 - i];
  if (i <= 30) return [i - 20, 0];
  return [10, i - 30];
}

function cellRect(left: number, top: number, size: number, i: number) {
  const [col, row] = gridPoint(i);
  const margin = size * 0.044;
  const corner = size * 0.106;
  const middle = (size - 2 * margin - 2 * corner) / 9;
  const axis = (n: number) =>
    n === 0
      ? { at: margin, width: corner }
      : n === 10
        ? { at: size - margin - corner, width: corner }
        : { at: margin + corner + (n - 1) * middle, width: middle };
  const x = axis(col);
  const y = axis(row);
  return { x: left + x.at, y: top + y.at, w: x.width, h: y.width };
}

export class CoTyPhuClassicView extends GameView<View> {
  private board!: Phaser.GameObjects.Graphics;
  private boardImage!: Phaser.GameObjects.Image;
  private squares: Phaser.GameObjects.Zone[] = [];
  private squareNames: Phaser.GameObjects.Text[] = [];
  private tokens: Phaser.GameObjects.Image[] = [];
  private tokenNames: Phaser.GameObjects.Text[] = [];
  private people: Phaser.GameObjects.Text[] = [];
  private heading!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private card!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private main: TapButton[] = [];
  private tools: TapButton[] = [];
  private selected: number | null = null;
  private tradeOpen = false;
  private tradeTo = 1;
  private tradeGive = -1;
  private tradeTake = -1;
  private giveCash = 0;
  private takeCash = 0;
  private geometry = { left: 0, top: 0, size: 500, tile: 45, sideW: 150 };

  protected onCreate() {
    this.selected = null;
    this.tradeOpen = false;
    this.tradeTo = 1;
    this.tradeGive = -1;
    this.tradeTake = -1;
    this.giveCash = 0;
    this.takeCash = 0;
    this.board = this.add.graphics();
    this.boardImage = this.sprite('board').setDepth(-1);
    this.squares = BOARD.map((_, i) =>
      this.add
        .zone(0, 0, 10, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.selected = i;
          this.onState(this.ctx);
        }),
    );
    this.squareNames = BOARD.map(() => this.label('', { size: 12 }).setDepth(2));
    this.tokens = PLAYER_COLORS.map((color) => this.sprite('pawn').setTint(color).setDepth(5));
    this.tokenNames = PLAYER_COLORS.map((_, i) =>
      this.label(String(i + 1), { size: 15 }).setDepth(6),
    );
    this.people = PLAYER_COLORS.map(() => this.label('', { size: 24 }).setOrigin(0, 0));
    this.heading = this.label('', { size: 30 }).setOrigin(0.5, 0);
    this.notice = this.label('', { size: 20 }).setOrigin(0.5, 0);
    this.card = this.label('', { size: 19 }).setOrigin(0.5, 0);
    this.detail = this.label('', { size: 23 }).setOrigin(0, 0);
    this.main = Array.from({ length: 8 }, () => this.makeButton());
    this.tools = Array.from({ length: 4 }, () => this.makeButton());
  }

  private makeButton(): TapButton {
    const box = this.add
      .nineslice(0, 0, this.texture('button'), undefined, 512, 133, 80, 80, 50, 50)
      .setDepth(10);
    const hit = this.add.zone(0, 0, 100, 45).setDepth(12).setInteractive({ useHandCursor: true });
    const label = this.label('', { size: 19, color: '#3d2b20' })
      .setStroke('#3d2b20', 0)
      .setDepth(11);
    const button = { box, hit, text: label, action: () => {} };
    hit.on('pointerup', () => button.action());
    hit.on('pointerover', () => box.setTint(0xffedc0));
    hit.on('pointerout', () => box.clearTint());
    return button;
  }

  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const size = Math.min(height - top - 12, width - 2 * 140 * hud);
    const left = (width - size) / 2;
    const boardTop = top + (height - top - size) / 2;
    const tile = size / 11;
    this.geometry = { left, top: boardTop, size, tile, sideW: left - 24 };
    this.boardImage.setPosition(width / 2, boardTop + size / 2).setDisplaySize(size, size);
    BOARD.forEach((_, i) => {
      const { x, y, w, h } = cellRect(left, boardTop, size, i);
      this.squares[i]!.setPosition(x + w / 2, y + h / 2).setSize(w, h);
      this.squares[i]!.input?.hitArea.setTo(0, 0, w, h);
      this.squareNames[i]!.setPosition(x + w / 2, y + h / 2)
        .setFontSize(Math.max(10, w * 0.23))
        .setWordWrapWidth(w - 5);
    });
    this.heading.setPosition(width / 2, boardTop + tile + 36).setFontSize(27 * hud);
    this.notice.setPosition(width / 2, boardTop + tile + 78).setFontSize(18 * hud);
    this.card.setPosition(width / 2, boardTop + tile + 116).setFontSize(18 * hud);
    this.detail
      .setPosition(left + size + 14, boardTop + 180)
      .setWordWrapWidth(Math.max(100, left - 30))
      .setFontSize(20 * hud);
    this.people.forEach((label, i) => {
      label.setPosition(16, boardTop + 16 + i * (82 * hud)).setFontSize(17 * hud);
      label.setWordWrapWidth(Math.max(100, left - 28));
    });
    this.drawBoard(ctx);
  }

  private drawBoard(ctx: Ctx) {
    const { left, top, size, tile } = this.geometry;
    this.board.clear();
    BOARD.forEach((cell, i) => {
      const { x, y, w, h } = cellRect(left, top, size, i);
      if (i === this.selected) {
        this.board.lineStyle(4, 0xffd256);
        this.board.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
      }
      if (cell.group) {
        this.board.fillStyle(GROUP_COLORS[cell.group]);
        this.board.fillRect(x + 4, y + 4, w - 8, Math.max(5, h * 0.19));
      } else if (cell.kind === 'station') {
        this.board.fillStyle(0x6f817d).fillRect(x + 4, y + 4, w - 8, Math.max(5, h * 0.19));
      }
      const deed = ctx.state.properties[i]!;
      if (deed.owner !== null) {
        this.board.fillStyle(PLAYER_COLORS[deed.owner]!);
        this.board.fillCircle(x + w - 8, y + h - 8, Math.max(4, w * 0.1));
      }
      if (deed.houses) {
        this.board.fillStyle(0x347146);
        this.board.fillRect(x + 4, y + h - 8, Math.min(w - 18, deed.houses * 6), 5);
      }
      if (deed.mortgaged) {
        this.board.lineStyle(3, 0xa24a45);
        this.board.lineBetween(x + 5, y + h - 5, x + w - 5, y + 5);
      }
      this.squareNames[i]!.setText(shortName(cell.name));
      this.fitText(this.squareNames[i]!, shortName(cell.name), w - 6, 9);
    });
    ctx.state.players.forEach((p, i) => {
      const rect = cellRect(left, top, size, p.position);
      const x = rect.x + (0.35 + (i % 2) * 0.3) * rect.w;
      const y = rect.y + (0.35 + Math.floor(i / 2) * 0.3) * rect.h;
      this.tokens[i]!.setPosition(x, y)
        .setDisplaySize(tile * 0.45, tile * 0.48)
        .setVisible(!p.bankrupt);
      this.tokenNames[i]!.setPosition(x, y + tile * 0.08).setVisible(!p.bankrupt);
    });
    for (let i = ctx.state.players.length; i < this.tokens.length; i++) {
      this.tokens[i]!.setVisible(false);
      this.tokenNames[i]!.setVisible(false);
    }
  }

  private put(
    button: TapButton,
    text: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
  ) {
    const scale = 45 / 133;
    button.box
      .setVisible(true)
      .setPosition(x, y)
      .setSize(width / scale, 133)
      .setScale(scale);
    button.hit.setVisible(true).setPosition(x, y).setSize(width, 45);
    button.hit.input?.hitArea.setTo(0, 0, width, 45);
    button.text.setVisible(true).setPosition(x, y).setFontSize(20);
    this.fitText(button.text, text, width - 12, 15);
    button.action = action;
  }

  private hide(buttons: TapButton[]) {
    for (const button of buttons) {
      button.box.setVisible(false);
      button.hit.setVisible(false);
      button.text.setVisible(false);
      button.action = () => {};
    }
  }

  private cycle(list: number[], current: number) {
    const at = list.indexOf(current);
    return list[(at + 1) % list.length] ?? -1;
  }

  private tradeButtons(ctx: Ctx): [string, () => void][] {
    const me = ctx.me!.seat;
    const seats = ctx.state.players.flatMap((p, i) => (i === me || p.bankrupt ? [] : [i]));
    if (!seats.includes(this.tradeTo)) this.tradeTo = seats[0] ?? me;
    const own = [-1, ...ctx.state.properties.flatMap((p, i) => (p.owner === me ? [i] : []))];
    const theirs = [
      -1,
      ...ctx.state.properties.flatMap((p, i) => (p.owner === this.tradeTo ? [i] : [])),
    ];
    const name = (square: number) => (square < 0 ? 'Không' : BOARD[square]!.name);
    const refresh = () => this.onState(this.ctx);
    return [
      [
        `Với: ${ctx.players[this.tradeTo]?.name ?? ''}`,
        () => {
          this.tradeTo = this.cycle(seats, this.tradeTo);
          this.tradeTake = -1;
          refresh();
        },
      ],
      [
        `Đưa: ${name(this.tradeGive)}`,
        () => {
          this.tradeGive = this.cycle(own, this.tradeGive);
          refresh();
        },
      ],
      [
        `Nhận: ${name(this.tradeTake)}`,
        () => {
          this.tradeTake = this.cycle(theirs, this.tradeTake);
          refresh();
        },
      ],
      [
        `Trả tiền: ${this.giveCash}`,
        () => {
          this.giveCash = (this.giveCash + 50) % 550;
          refresh();
        },
      ],
      [
        `Lấy tiền: ${this.takeCash}`,
        () => {
          this.takeCash = (this.takeCash + 50) % 550;
          refresh();
        },
      ],
      [
        'Gửi đề nghị',
        () => {
          this.send('offer-trade', {
            to: this.tradeTo,
            give: this.tradeGive,
            take: this.tradeTake,
            giveCash: this.giveCash,
            takeCash: this.takeCash,
          });
          this.tradeOpen = false;
        },
      ],
      [
        'Đóng',
        () => {
          this.tradeOpen = false;
          refresh();
        },
      ],
    ];
  }

  private actions(ctx: Ctx): [string, () => void][] {
    const { state, me } = ctx;
    if (!me || ctx.result) return [];
    if (state.phase === 'trade' && state.trade) {
      if (me.seat === state.trade.to)
        return [
          ['Chấp nhận', () => this.send('accept-trade')],
          ['Từ chối', () => this.send('decline-trade')],
        ];
      if (me.seat === state.trade.from) return [['Huỷ đề nghị', () => this.send('decline-trade')]];
      return [];
    }
    if (this.tradeOpen && state.turn === me.seat) return this.tradeButtons(ctx);
    if (state.phase === 'auction' && state.auction?.bidder === me.seat) {
      const bid = (plus: number) => this.send('bid', { amount: state.auction!.highest + plus });
      return [
        [`+1 (${state.auction.highest + 1})`, () => bid(1)],
        [`+10 (${state.auction.highest + 10})`, () => bid(10)],
        [`+50 (${state.auction.highest + 50})`, () => bid(50)],
        ['Bỏ giá', () => this.send('pass')],
      ];
    }
    if (state.turn !== me.seat) return [];
    if (state.phase === 'roll') {
      const actions: [string, () => void][] = [['Gieo xúc xắc', () => this.send('roll')]];
      if (state.players[me.seat]!.jailed) {
        actions.push(['Trả 50 ra tù', () => this.send('pay-bail')]);
        if (state.players[me.seat]!.freeCards.length)
          actions.push(['Dùng thẻ ra tù', () => this.send('use-card')]);
      }
      actions.push([
        'Trao đổi',
        () => {
          this.tradeOpen = true;
          this.onState(this.ctx);
        },
      ]);
      return actions;
    }
    if (state.phase === 'buy')
      return [
        [`Mua ${BOARD[state.pending!]!.price}`, () => this.send('buy')],
        ['Đấu giá', () => this.send('auction')],
      ];
    if (state.phase === 'debt')
      return [
        [`Trả ${state.debt!.amount}`, () => this.send('pay-debt')],
        ['Phá sản', () => this.send('bankrupt')],
      ];
    if (state.phase === 'end')
      return [
        ['Hết lượt', () => this.send('end-turn')],
        [
          'Trao đổi',
          () => {
            this.tradeOpen = true;
            this.onState(this.ctx);
          },
        ],
      ];
    return [];
  }

  protected onState(ctx: Ctx) {
    const { state, players, me, result } = ctx;
    const { left, top, size, tile, sideW } = this.geometry;
    const selected = this.selected ?? state.pending ?? state.players[state.turn]!.position;
    this.drawBoard(ctx);
    const turn = players[state.turn]?.name ?? '';
    this.heading.setText(result ? 'KẾT THÚC' : `Lượt ${turn}`);
    this.fitText(this.heading, this.heading.text, size - 2 * tile - 16, 19);
    const dice = state.dice ? `  🎲 ${state.dice[0]} + ${state.dice[1]}` : '';
    const notice =
      state.phase === 'auction' && state.auction
        ? `Đấu giá ${BOARD[state.auction.square]!.name}: ${state.auction.highest}`
        : state.notice;
    this.fitText(this.notice, notice + dice, size - 2 * tile - 20, 15);
    const trade = state.trade;
    const cardText = trade
      ? `${players[trade.from]?.name} ↔ ${players[trade.to]?.name}: ${trade.give === null ? 'tiền' : BOARD[trade.give]!.name} / ${trade.take === null ? 'tiền' : BOARD[trade.take]!.name}`
      : (state.lastCard ?? '');
    this.fitText(this.card, cardText, size - 2 * tile - 20, 14);
    this.people.forEach((text, i) => {
      const p = state.players[i];
      text.setVisible(Boolean(p));
      if (!p) return;
      text.setColor(i === state.turn ? '#fff0a8' : '#ffffff');
      text.setText(
        `${i + 1}. ${players[i]?.name ?? ''}\n${p.bankrupt ? 'Phá sản' : `${p.cash} ₫ • ${p.jailed ? 'Trong tù' : BOARD[p.position]!.name}`}`,
      );
      this.fitText(text, text.text, sideW, 15);
    });
    const cell = BOARD[selected]!;
    const deed = state.properties[selected]!;
    const owner = deed.owner === null ? 'Chưa có chủ' : (players[deed.owner]?.name ?? '');
    const info = [
      cell.name,
      isDeed(cell) ? `Giá ${cell.price} • ${owner}` : '',
      deed.houses ? (deed.houses === 5 ? 'Khách sạn' : `${deed.houses} nhà`) : '',
      deed.mortgaged ? 'Đang thế chấp' : '',
      cell.kind === 'street' ? `Thuê ${cell.rent?.join(' / ')}` : '',
      cell.kind === 'station' ? 'Thuê 25 / 50 / 100 / 200' : '',
      cell.kind === 'utility' ? 'Thuê 4× hoặc 10× xúc xắc' : '',
    ]
      .filter(Boolean)
      .join('\n');
    this.detail.setText(info);
    this.fitText(this.detail, info, sideW, 15);
    this.hide(this.main);
    this.hide(this.tools);
    const actions = this.actions(ctx);
    const innerW = size - 2 * tile - 24;
    const buttonW = Math.min(200, (innerW - 12) / 2);
    const startY = top + size - tile - 154;
    actions.forEach(([label, action], i) => {
      const x = left + size / 2 + ((i % 2 ? 1 : -1) * (buttonW + 10)) / 2;
      const y = startY + Math.floor(i / 2) * 52;
      this.put(this.main[i]!, label, x, y, buttonW, action);
    });
    if (
      !result &&
      me &&
      deed.owner === me.seat &&
      state.phase !== 'trade' &&
      state.phase !== 'auction'
    ) {
      const controls: [string, string][] = [
        ['Xây nhà', 'build'],
        ['Bán nhà', 'sell-house'],
        [deed.mortgaged ? 'Chuộc đất' : 'Thế chấp', deed.mortgaged ? 'redeem' : 'mortgage'],
      ];
      controls.forEach(([label, event], i) => {
        this.put(
          this.tools[i]!,
          label,
          left + size + 14 + sideW / 2,
          top + size - 150 + i * 50,
          sideW,
          () => this.send(event, { square: selected }),
        );
      });
    }
  }
}
