import { GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { BOARD, GROUP_COLORS, isDeed, type Property, type View } from '../game/model.js';
import { BOARD_CELLS, BOARD_IMAGE_RATIO } from './boardGeometry.js';
import { Dice3D } from './Dice3D.js';

type Ctx = ViewContext<View>;
type TapButton = {
  box: Phaser.GameObjects.NineSlice;
  hit: Phaser.GameObjects.Zone;
  text: Phaser.GameObjects.Text;
  action: () => void;
};

const PLAYER_COLORS = [0xdf6554, 0x5793d3, 0x60af72, 0xe6be52];
const PLAYER_PAWNS = ['pawn-red', 'pawn-blue', 'pawn-green', 'pawn-yellow'];

/** Square 0 is the bottom right corner; numbering runs clockwise. */
type BoardPoint = { x: number; y: number };
type RollBeat = {
  seat: number;
  from: number;
  to: number;
  jailed: boolean;
  dice: [number, number];
  cash: number[];
  notice: string;
  card: string | null;
};

function cellQuad(left: number, top: number, size: number, i: number): BoardPoint[] {
  return BOARD_CELLS[i]!.map(([u, v]) => ({
    x: left + u * size,
    y: top + (v * size) / BOARD_IMAGE_RATIO,
  }));
}

function cellPoint(left: number, top: number, size: number, i: number, u: number, v: number) {
  const [tl, tr, br, bl] = cellQuad(left, top, size, i) as [
    BoardPoint,
    BoardPoint,
    BoardPoint,
    BoardPoint,
  ];
  return {
    x: tl.x * (1 - u) * (1 - v) + tr.x * u * (1 - v) + br.x * u * v + bl.x * (1 - u) * v,
    y: tl.y * (1 - u) * (1 - v) + tr.y * u * (1 - v) + br.y * u * v + bl.y * (1 - u) * v,
  };
}

function cellRect(left: number, top: number, size: number, i: number) {
  const corners = cellQuad(left, top, size, i);
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function fillQuad(
  graphics: Phaser.GameObjects.Graphics,
  points: BoardPoint[],
  color: number,
  alpha = 1,
) {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
  graphics.fillPath();
}

export class CoTyPhuClassicView extends GameView<View> {
  private board!: Phaser.GameObjects.Graphics;
  private hudPanels!: Phaser.GameObjects.Graphics;
  private boardImage!: Phaser.GameObjects.Image;
  private squares: Phaser.GameObjects.Zone[] = [];
  private tokens: Phaser.GameObjects.Image[] = [];
  private pawnShadows: Phaser.GameObjects.Ellipse[] = [];
  private tokenNames: Phaser.GameObjects.Text[] = [];
  private dice!: Dice3D;
  private readyPanel!: Phaser.GameObjects.Graphics;
  private readyTitle!: Phaser.GameObjects.Text;
  private readySubtitle!: Phaser.GameObjects.Text;
  private readyNames: Phaser.GameObjects.Text[] = [];
  private readyCash: Phaser.GameObjects.Text[] = [];
  private readyStart!: TapButton;
  private rollQueue: RollBeat[] = [];
  private activeRoll: RollBeat | null = null;
  private resultUntil = 0;
  private landingUntil = 0;
  private landingBeat: RollBeat | null = null;
  private lastLandedSquare: number | null = null;
  private visualPhase: 'ready' | 'rolling' | 'result' | 'moving' | 'landing' | 'decision' =
    'decision';
  private shownPositions: number[] = [];
  private shownCash: number[] = [];
  private shownOwners: (number | null)[] = [];
  private shownProperties: Property[] = [];
  private shownCard: string | null = null;
  private shownNotice = '';
  private moving: boolean[] = [];
  private moveTweens: (Phaser.Tweens.Tween | null)[] = [];
  private lastPending: number | null = null;
  private people: Phaser.GameObjects.Text[] = [];
  private playerBadges: Phaser.GameObjects.Text[] = [];
  private playerCash: Phaser.GameObjects.Text[] = [];
  private playerPlace: Phaser.GameObjects.Text[] = [];
  private heading!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private card!: Phaser.GameObjects.Text;
  private deedLabel!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private deedPrice!: Phaser.GameObjects.Text;
  private deedOwner!: Phaser.GameObjects.Text;
  private deedRent!: Phaser.GameObjects.Text;
  private main: TapButton[] = [];
  private tools: TapButton[] = [];
  private selected: number | null = null;
  private tradeOpen = false;
  private tradeTo = 1;
  private tradeGive = -1;
  private tradeTake = -1;
  private giveCash = 0;
  private takeCash = 0;
  private geometry = { left: 0, top: 0, size: 500, imageH: 430, tile: 45, sideW: 150 };

  protected onCreate(ctx: Ctx) {
    this.selected = null;
    this.tradeOpen = false;
    this.tradeTo = 1;
    this.tradeGive = -1;
    this.tradeTake = -1;
    this.giveCash = 0;
    this.takeCash = 0;
    this.shownPositions = ctx.state.players.map((p) => p.position);
    this.shownCash = ctx.state.players.map((p) => p.cash);
    this.shownOwners = ctx.state.properties.map((p) => p.owner);
    this.shownProperties = ctx.state.properties.map((property) => ({ ...property }));
    this.shownCard = ctx.state.lastCard;
    this.shownNotice = ctx.state.notice;
    this.moving = ctx.state.players.map(() => false);
    this.moveTweens = ctx.state.players.map(() => null);
    this.lastPending = ctx.state.pending;
    this.rollQueue = [];
    this.activeRoll = null;
    this.resultUntil = 0;
    this.landingUntil = 0;
    this.landingBeat = null;
    this.lastLandedSquare = null;
    this.visualPhase = 'decision';
    this.board = this.add.graphics();
    this.hudPanels = this.add.graphics().setDepth(7);
    this.readyPanel = this.add.graphics().setDepth(25);
    this.boardImage = this.sprite('board-25d').setDepth(-1);
    this.squares = BOARD.map((_, i) =>
      this.add
        .zone(0, 0, 10, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.selected = i;
          this.onState(this.ctx);
        }),
    );
    this.pawnShadows = PLAYER_COLORS.map(() =>
      this.add.ellipse(0, 0, 10, 5, 0x302014, 0.25).setDepth(4),
    );
    this.tokens = PLAYER_PAWNS.map((pawn) => this.sprite(pawn).setOrigin(0.5, 0.93).setDepth(5));
    this.tokenNames = PLAYER_COLORS.map((_, i) =>
      this.label(String(i + 1), { size: 16, color: '#fff4da' })
        .setStroke('#3d2b20', 2)
        .setDepth(6),
    );
    this.dice = new Dice3D(this);
    const ink = (size: number, color = '#3d2b20') =>
      this.label('', { size, color }).setStroke('#3d2b20', 0).setDepth(8);
    this.playerBadges = PLAYER_COLORS.map((_, i) => ink(21).setText(String(i + 1)));
    this.people = PLAYER_COLORS.map(() => ink(24).setOrigin(0, 0));
    this.playerCash = PLAYER_COLORS.map(() => ink(22, '#79501e').setOrigin(0, 0));
    this.playerPlace = PLAYER_COLORS.map(() => ink(19, '#66594a').setOrigin(0, 0));
    this.heading = ink(30).setOrigin(0.5, 0);
    this.notice = ink(20, '#674b32').setOrigin(0.5, 0);
    this.card = ink(19, '#68471c').setOrigin(0.5, 0);
    this.deedLabel = ink(18, '#906233').setOrigin(0, 0).setText('THÔNG TIN Ô');
    this.detail = ink(23).setOrigin(0, 0);
    this.deedPrice = ink(24, '#875020').setOrigin(0, 0);
    this.deedOwner = ink(20, '#67513e').setOrigin(0, 0);
    this.deedRent = ink(19, '#47382d').setOrigin(0, 0);
    this.readyTitle = ink(32).setDepth(26).setOrigin(0.5);
    this.readySubtitle = ink(19, '#79501e').setDepth(26).setOrigin(0.5);
    this.readyNames = PLAYER_COLORS.map(() => ink(22).setDepth(26).setOrigin(0, 0.5));
    this.readyCash = PLAYER_COLORS.map(() => ink(22, '#79501e').setDepth(26).setOrigin(1, 0.5));
    this.main = Array.from({ length: 8 }, () => this.makeButton());
    this.tools = Array.from({ length: 4 }, () => this.makeButton());
    this.readyStart = this.makeButton();
    this.readyStart.box.setDepth(27);
    this.readyStart.text.setDepth(28);
    this.readyStart.hit.setDepth(29);
  }

  private makeButton(): TapButton {
    const box = this.add
      .nineslice(0, 0, this.texture('button'), undefined, 512, 133, 80, 80, 50, 50)
      .setDepth(10);
    const hit = this.add.zone(0, 0, 100, 62).setDepth(12).setInteractive({ useHandCursor: true });
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
    const interruptedMove = this.visualPhase === 'moving' ? this.activeRoll : null;
    this.moveTweens.forEach((tween) => {
      tween?.stop();
    });
    this.moving.fill(false);
    if (interruptedMove) {
      this.shownPositions[interruptedMove.seat] = interruptedMove.to;
      this.activeRoll = null;
      this.resultUntil = 0;
      this.visualPhase = 'decision';
      this.dice.hide();
    }
    const { width, height, top, hud } = ctx.screen;
    const size = Math.min((height - top - 8) * BOARD_IMAGE_RATIO, width - 2 * 140 * hud);
    const imageH = size / BOARD_IMAGE_RATIO;
    const left = (width - size) / 2;
    const boardTop = top + (height - top - imageH) / 2;
    const tile = size * 0.063;
    const sideW = left - 24;
    this.geometry = { left, top: boardTop, size, imageH, tile, sideW };
    this.boardImage.setPosition(width / 2, boardTop + imageH / 2).setDisplaySize(size, imageH);
    BOARD.forEach((_, i) => {
      const { x, y, w, h } = cellRect(left, boardTop, size, i);
      this.squares[i]!.setPosition(x + w / 2, y + h / 2).setSize(w, h);
      this.squares[i]!.input?.hitArea.setTo(0, 0, w, h);
    });
    this.heading.setPosition(width / 2, boardTop + imageH * 0.32).setFontSize(25 * hud);
    this.notice.setPosition(width / 2, boardTop + imageH * 0.39).setFontSize(17 * hud);
    this.card.setPosition(width / 2, boardTop + imageH * 0.46).setFontSize(16 * hud);
    this.dice.setPosition(width / 2, boardTop + imageH * 0.57, tile);
    this.layoutReady(ctx);
    const rightX = left + size + 12;
    this.deedLabel.setPosition(rightX + 14, boardTop + 27).setFontSize(16 * hud);
    this.detail
      .setPosition(rightX + 14, boardTop + 70)
      .setWordWrapWidth(Math.max(95, left - 52))
      .setFontSize(sideW < 200 ? 23 : 28);
    this.deedPrice.setPosition(rightX + 14, boardTop + 119);
    this.deedOwner.setPosition(rightX + 14, boardTop + 161);
    this.deedRent
      .setPosition(rightX + 14, boardTop + 205)
      .setWordWrapWidth(Math.max(95, sideW - 28));
    const rowH = Math.min(91, (imageH - 32) / Math.max(4, ctx.state.players.length));
    this.people.forEach((label, i) => {
      const x = 61;
      const y = boardTop + 17 + i * (rowH + 7);
      this.playerBadges[i]!.setPosition(36, boardTop + 10 + i * (rowH + 7) + rowH / 2);
      label.setPosition(x, y).setFontSize(sideW < 200 ? 21 : 25);
      this.playerCash[i]!.setPosition(x, y + 28).setFontSize(sideW < 200 ? 20 : 24);
      this.playerPlace[i]!.setPosition(x, y + 56).setFontSize(sideW < 200 ? 17 : 19);
    });
    this.drawHudFrames(
      ctx,
      this.selected ?? ctx.state.pending ?? ctx.state.players[ctx.state.turn]!.position,
    );
    this.drawBoard(ctx);
    if (interruptedMove) {
      this.activeRoll = interruptedMove;
      this.finishRoll();
    }
  }

  private layoutReady(ctx: Ctx) {
    const { left, top, size, imageH } = this.geometry;
    const w = Math.min(size * 0.68, 460);
    const h = Math.min(imageH - 18, 166 + ctx.state.players.length * 52);
    const rowH = (h - 166) / ctx.state.players.length;
    const x = left + (size - w) / 2;
    const y = top + (imageH - h) / 2;
    this.readyPanel.clear();
    this.readyPanel.fillStyle(0x342417, 0.58).fillRoundedRect(left, top, size, imageH, 16);
    this.readyPanel.fillStyle(0x442817, 0.28).fillRoundedRect(x + 6, y + 8, w, h, 18);
    this.readyPanel.fillStyle(0xfff3d7).fillRoundedRect(x, y, w, h, 18);
    this.readyPanel.lineStyle(4, 0xc38b40).strokeRoundedRect(x, y, w, h, 18);
    this.readyPanel.fillStyle(0xe5af45).fillRoundedRect(x + 12, y + 11, w - 24, 6, 3);
    this.readyTitle.setPosition(x + w / 2, y + 43).setText('SẴN SÀNG VÀO VÁN');
    this.fitText(this.readyTitle, this.readyTitle.text, w - 30, 24);
    this.readySubtitle.setPosition(x + w / 2, y + 82).setText('Mỗi người bắt đầu với 1.500 ₫');
    this.fitText(this.readySubtitle, this.readySubtitle.text, w - 30, 16);
    ctx.state.players.forEach((_, seat) => {
      const rowY = y + 114 + seat * rowH;
      this.readyPanel
        .fillStyle(seat % 2 ? 0xffe8c0 : 0xfff9ea)
        .fillRoundedRect(x + 16, rowY - rowH * 0.42, w - 32, rowH * 0.84, 8);
      this.readyPanel.fillStyle(PLAYER_COLORS[seat]!).fillCircle(x + 40, rowY + 1, 13);
      this.readyNames[seat]!.setPosition(x + 62, rowY).setText(
        ctx.players[seat]?.name ?? `Người ${seat + 1}`,
      );
      this.fitText(this.readyNames[seat]!, this.readyNames[seat]!.text, w * 0.53, 17);
      this.readyCash[seat]!.setPosition(x + w - 29, rowY).setText('1500 ₫');
    });
    this.put(this.readyStart, 'Vào ván', x + w / 2, y + h - 35, 166, () => this.finishReady());
    for (let seat = ctx.state.players.length; seat < PLAYER_COLORS.length; seat++) {
      this.readyNames[seat]!.setVisible(false);
      this.readyCash[seat]!.setVisible(false);
    }
    this.showReady(this.visualPhase === 'ready');
  }

  private showReady(show: boolean) {
    this.readyPanel.setVisible(show);
    this.readyTitle.setVisible(show);
    this.readySubtitle.setVisible(show);
    this.readyNames.forEach((name, seat) => {
      name.setVisible(show && seat < this.ctx.state.players.length);
    });
    this.readyCash.forEach((cash, seat) => {
      cash.setVisible(show && seat < this.ctx.state.players.length);
    });
    this.readyStart.box.setVisible(show);
    this.readyStart.text.setVisible(show);
    this.readyStart.hit.setVisible(show);
  }

  private finishReady() {
    if (this.visualPhase !== 'ready') return;
    this.visualPhase = 'decision';
    this.showReady(false);
    this.startNextRoll();
    this.onState(this.ctx);
  }

  private drawHudFrames(ctx: Ctx, selected: number) {
    const { left, top, size, imageH, sideW } = this.geometry;
    const graphics = this.hudPanels;
    graphics.clear();
    const panel = (x: number, y: number, w: number, h: number, active = false) => {
      graphics.fillStyle(0x3d2818, 0.24);
      graphics.fillRoundedRect(x + 3, y + 5, w, h, 14);
      graphics.fillStyle(active ? 0xfff1c9 : 0xfff9e9, 0.96);
      graphics.fillRoundedRect(x, y, w, h, 14);
      graphics.lineStyle(active ? 3 : 2, active ? 0xe8aa31 : 0xb98046, 0.95);
      graphics.strokeRoundedRect(x, y, w, h, 14);
    };
    const rowH = Math.min(91, (imageH - 32) / Math.max(4, ctx.state.players.length));
    const leftW = sideW;
    for (let i = 0; i < ctx.state.players.length; i++) {
      const y = top + 10 + i * (rowH + 7);
      panel(12, y, leftW, rowH, i === ctx.state.turn);
      graphics.fillStyle(PLAYER_COLORS[i]!, 1);
      graphics.fillRoundedRect(12, y + 2, 7, rowH - 4, 3);
      graphics.fillCircle(36, y + rowH / 2, 17);
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(36, y + rowH / 2, 12);
    }
    const rightX = left + size + 12;
    const panelH = this.deedPanelHeight(selected);
    panel(rightX, top + 10, sideW, panelH);
    graphics.fillStyle(BOARD[selected]?.group ? GROUP_COLORS[BOARD[selected]!.group!] : 0xdbaa60);
    graphics.fillRoundedRect(rightX + 9, top + 18, sideW - 18, 5, 2);
    graphics.lineStyle(1, 0xd4b995);
    graphics.lineBetween(rightX + 14, top + 55, rightX + sideW - 14, top + 55);
    if (isDeed(BOARD[selected]!)) {
      graphics.fillStyle(0xffe8bc, 0.82);
      graphics.fillRoundedRect(rightX + 10, top + 109, sideW - 20, 39, 8);
      graphics.lineStyle(1, 0xd4b995);
      graphics.lineBetween(rightX + 14, top + 193, rightX + sideW - 14, top + 193);
    }

    const statusW = this.tradeOpen ? Math.min(size * 0.42, 320) : Math.min(size * 0.56, 430);
    const statusX = left + (size - statusW) / 2;
    const statusY = top + imageH * (this.tradeOpen ? 0.11 : 0.29);
    panel(statusX, statusY, statusW, this.tradeOpen ? 66 : imageH * 0.16);
    if (this.card.visible && this.card.text) {
      const cardW = Math.min(size * 0.6, 450);
      panel(left + (size - cardW) / 2, top + imageH * 0.445, cardW, 38);
    }
  }

  private deedPanelHeight(selected: number) {
    const { imageH } = this.geometry;
    return isDeed(BOARD[selected]!) ? Math.min(330, imageH * 0.52) : Math.min(178, imageH * 0.35);
  }

  private drawBoard(ctx: Ctx) {
    const { left, top, size, tile } = this.geometry;
    this.board.clear();
    BOARD.forEach((cell, i) => {
      const corners = cellQuad(left, top, size, i);
      if (i === this.selected) {
        fillQuad(this.board, corners, 0xffd260, 0.18);
        this.board.lineStyle(3, 0xf6bd47, 0.95);
        this.board.beginPath();
        this.board.moveTo(corners[0]!.x, corners[0]!.y);
        for (const point of corners.slice(1)) this.board.lineTo(point.x, point.y);
        this.board.closePath();
        this.board.strokePath();
      }
      const deed =
        this.visualPhase === 'decision'
          ? ctx.state.properties[i]!
          : (this.shownProperties[i] ?? ctx.state.properties[i]!);
      if (isDeed(cell)) this.drawDeedState(i, deed);
    });
    ctx.state.players.forEach((p, i) => {
      const visiblePosition =
        this.visualPhase === 'decision' ? p.position : (this.shownPositions[i] ?? p.position);
      const { x, y } = this.pawnSpot(visiblePosition, i);
      const perspective = this.pawnScale(y);
      if (!this.moving[i]) {
        this.tokens[i]!.setPosition(x, y);
        this.pawnShadows[i]!.setPosition(x, y + 2);
        this.tokenNames[i]!.setPosition(x, y - tile * 1.22 * perspective);
      }
      this.tokens[i]!.setDisplaySize(tile * 0.76 * perspective, tile * 1.05 * perspective)
        .setDepth(5 + y / 1000)
        .setVisible(!p.bankrupt);
      this.pawnShadows[i]!.setSize(tile * 0.43 * perspective, tile * 0.16 * perspective)
        .setDepth(4 + y / 1000)
        .setVisible(!p.bankrupt);
      this.tokenNames[i]!.setVisible(!p.bankrupt);
    });
    for (let i = ctx.state.players.length; i < this.tokens.length; i++) {
      this.tokens[i]!.setVisible(false);
      this.pawnShadows[i]!.setVisible(false);
      this.tokenNames[i]!.setVisible(false);
    }
  }

  private surfacePoint(square: number, along: number, depth: number) {
    // Map a tile-edge coordinate onto the Blender-projected quad for live state decals.
    let u: number;
    let v: number;
    if (square >= 1 && square <= 9) {
      u = along;
      v = 1 - depth;
    } else if (square >= 11 && square <= 19) {
      u = depth;
      v = along;
    } else if (square >= 21 && square <= 29) {
      u = along;
      v = depth;
    } else if (square >= 31 && square <= 39) {
      u = 1 - depth;
      v = along;
    } else {
      u = along;
      v = depth;
    }
    const { left, top, size } = this.geometry;
    return cellPoint(left, top, size, square, u, v);
  }

  private fillSurfacePolygon(square: number, coords: [number, number][], color: number) {
    const points = coords.map(([along, depth]) => this.surfacePoint(square, along, depth));
    this.board.fillStyle(color, 1);
    this.board.beginPath();
    this.board.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) this.board.lineTo(point.x, point.y);
    this.board.closePath();
    this.board.fillPath();
  }

  private drawDeedState(square: number, deed: Property) {
    if (deed.owner !== null) {
      const marker = Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return [0.86 + Math.cos(angle) * 0.075, 0.19 + Math.sin(angle) * 0.075] as [number, number];
      });
      this.fillSurfacePolygon(square, marker, 0xf3e5c5);
      const inner: [number, number][] = marker.map(
        ([along, depth]) =>
          [
            0.86 + (along - 0.86) * 0.74,
            0.19 + (depth - 0.19) * 0.74,
          ] as [number, number],
      );
      this.fillSurfacePolygon(square, inner, PLAYER_COLORS[deed.owner]!);
    }

    if (BOARD[square]!.kind === 'street' && deed.houses === 5) {
      this.fillSurfacePolygon(
        square,
        [
          [0.18, 0.23],
          [0.25, 0.06],
          [0.32, 0.17],
          [0.32, 0.23],
          [0.18, 0.23],
        ],
        0xa9473d,
      );
    } else if (BOARD[square]!.kind === 'street') {
      for (let house = 0; house < deed.houses; house++) {
        const center = 0.15 + house * 0.17;
        this.fillSurfacePolygon(
          square,
          [
            [center - 0.07, 0.18],
            [center, 0.08],
            [center + 0.07, 0.18],
            [center + 0.07, 0.24],
            [center - 0.07, 0.24],
          ],
          0x3e794c,
        );
      }
    }

    if (deed.mortgaged) {
      const from = this.surfacePoint(square, 0.08, 0.16);
      const to = this.surfacePoint(square, 0.24, 0.32);
      this.board.lineStyle(Math.max(2, this.geometry.tile * 0.055), 0xa24a45, 0.95);
      this.board.lineBetween(from.x, from.y, to.x, to.y);
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
    const scale = 62 / 133;
    button.box
      .setVisible(true)
      .setPosition(x, y)
      .setSize(width / scale, 133)
      .setScale(scale);
    button.hit.setVisible(true).setPosition(x, y).setSize(width, 62);
    button.hit.input?.hitArea.setTo(0, 0, width, 62);
    button.text.setVisible(true).setPosition(x, y).setFontSize(22);
    this.fitText(button.text, text, width - 14, 16);
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

  private pawnSpot(square: number, seat: number) {
    const { left, top, size, tile } = this.geometry;
    const point = cellPoint(
      left,
      top,
      size,
      square,
      0.27 + (seat % 2) * 0.46,
      0.27 + Math.floor(seat / 2) * 0.46,
    );
    return {
      x: point.x,
      y: point.y,
      nameY: -tile * 1.22 * this.pawnScale(point.y),
    };
  }

  private pawnScale(y: number) {
    const { top, imageH } = this.geometry;
    return 0.78 + 0.35 * Math.max(0, Math.min(1, (y - top) / imageH));
  }

  private travelPawn(seat: number, from: number, to: number, jailed: boolean, done?: () => void) {
    this.moveTweens[seat]?.stop();
    const token = this.tokens[seat]!;
    const shadow = this.pawnShadows[seat]!;
    const name = this.tokenNames[seat]!;
    const start = { x: token.x, y: token.y };
    const steps = (to - from + BOARD.length) % BOARD.length;
    const direct = jailed && to === 10;
    const points = direct
      ? [this.pawnSpot(to, seat)]
      : Array.from({ length: steps }, (_, i) => this.pawnSpot((from + i + 1) % BOARD.length, seat));
    if (!points.length) {
      done?.();
      return;
    }
    const cursor = { value: 0 };
    let sounded = -1;
    this.moving[seat] = true;
    this.moveTweens[seat] = this.tweens.add({
      targets: cursor,
      value: points.length,
      duration: direct ? 500 : points.length * 360,
      ease: 'Linear',
      onUpdate: () => {
        const step = Math.min(points.length - 1, Math.floor(cursor.value));
        const before = step === 0 ? start : points[step - 1]!;
        const after = points[step]!;
        // Each square has its own jump and a short planted beat before the next one.
        const fraction = Math.min(1, (cursor.value - step) / 0.76);
        const hop = Math.sin(fraction * Math.PI) * Math.min(16, this.geometry.tile * 0.28);
        const x = before.x + (after.x - before.x) * fraction;
        const groundY = before.y + (after.y - before.y) * fraction;
        const perspective = this.pawnScale(groundY);
        token.setPosition(x, groundY - hop).setDepth(5 + groundY / 1000);
        token.setDisplaySize(
          this.geometry.tile * 0.76 * perspective * (1 + hop * 0.003),
          this.geometry.tile * 1.05 * perspective * (1 + hop * 0.003),
        );
        shadow
          .setPosition(x, groundY + 2)
          .setDepth(4 + groundY / 1000)
          .setSize(
            this.geometry.tile * 0.43 * perspective * (1 - hop * 0.013),
            this.geometry.tile * 0.16 * perspective * (1 - hop * 0.013),
          )
          .setAlpha(1 - hop * 0.035);
        name.setPosition(x, groundY - hop - this.geometry.tile * 1.22 * perspective);
        if (step !== sounded) {
          sounded = step;
          this.sfx('tycoon-step');
        }
      },
      onComplete: () => {
        const target = this.pawnSpot(to, seat);
        token.setPosition(target.x, target.y);
        shadow.setPosition(target.x, target.y + 2).setAlpha(1);
        name.setPosition(target.x, target.y + target.nameY);
        this.moving[seat] = false;
        this.moveTweens[seat] = null;
        this.tweens.add({ targets: token, scale: 1.17, duration: 90, yoyo: true });
        done?.();
      },
    });
  }

  private startNextRoll() {
    if (
      this.visualPhase === 'ready' ||
      this.visualPhase === 'landing' ||
      this.activeRoll ||
      !this.rollQueue.length
    )
      return;
    this.activeRoll = this.rollQueue.shift()!;
    this.lastLandedSquare = null;
    this.visualPhase = 'rolling';
    this.dice.roll(...this.activeRoll.dice);
    this.sfx('tycoon-dice');
    this.onState(this.ctx);
  }

  private finishRoll() {
    const beat = this.activeRoll;
    if (!beat) return;
    this.shownPositions[beat.seat] = beat.to;
    this.selected = null;
    beat.cash.forEach((cash, seat) => {
      const before = this.shownCash[seat];
      if (before !== undefined && before !== cash) this.moneyFloat(seat, cash - before);
      this.shownCash[seat] = cash;
    });
    this.activeRoll = null;
    this.dice.hide();
    this.landingBeat = beat;
    this.lastLandedSquare = beat.from === beat.to ? null : beat.to;
    this.visualPhase = 'landing';
    this.landingUntil = this.time.now + 1300;
    this.onState(this.ctx);
  }

  private flashSquare(square: number, color: number) {
    const { left, top, size } = this.geometry;
    const flash = this.add.graphics().setDepth(8);
    fillQuad(flash, cellQuad(left, top, size, square), color, 0.7);
    this.tweens.add({ targets: flash, alpha: 0, duration: 520, onComplete: () => flash.destroy() });
  }

  private moneyFloat(seat: number, amount: number) {
    const { left, top, imageH, sideW } = this.geometry;
    const text = this.label(`${amount > 0 ? '+' : '−'}${Math.abs(amount)} ₫`, {
      size: 22,
      color: amount > 0 ? '#8bf2a8' : '#ffd17f',
    }).setDepth(15);
    const rowH = Math.min(91, (imageH - 32) / Math.max(4, this.ctx.state.players.length));
    text.setPosition(left / 2, top + 62 + seat * (rowH + 7));
    this.fitText(text, text.text, sideW, 17);
    this.tweens.add({
      targets: text,
      y: text.y - 38,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  protected onStart(ctx: Ctx) {
    this.moveTweens.forEach((tween) => {
      tween?.stop();
    });
    this.moving.fill(false);
    this.shownPositions = ctx.state.players.map((player) => player.position);
    this.shownCash = ctx.state.players.map((player) => player.cash);
    this.shownOwners = ctx.state.properties.map((property) => property.owner);
    this.shownProperties = ctx.state.properties.map((property) => ({ ...property }));
    this.shownCard = ctx.state.lastCard;
    this.shownNotice = ctx.state.notice;
    this.selected = null;
    this.dice.hide();
    this.rollQueue = [];
    this.activeRoll = null;
    this.resultUntil = 0;
    this.landingBeat = null;
    this.landingUntil = 0;
    this.lastLandedSquare = null;
    this.visualPhase = 'ready';
    this.layoutReady(ctx);
    this.sfx('tycoon-turn');
  }

  protected onRoll(ctx: Ctx, event: ViewEvent) {
    if (!ctx.state.dice) return;
    const seat = event.player?.seat ?? ctx.state.turn;
    const from =
      [...this.rollQueue].reverse().find((beat) => beat.seat === seat)?.to ??
      (this.activeRoll?.seat === seat ? this.activeRoll.to : (this.shownPositions[seat] ?? 0));
    this.rollQueue.push({
      seat,
      from,
      to: ctx.state.players[seat]!.position,
      jailed: ctx.state.players[seat]!.jailed,
      dice: [...ctx.state.dice],
      cash: ctx.state.players.map((player) => player.cash),
      notice: ctx.state.notice,
      card: ctx.state.lastCard,
    });
    this.startNextRoll();
  }

  protected onUpdate(_ctx: Ctx, delta: number) {
    this.dice.update(delta);
    if (this.visualPhase === 'rolling' && this.dice.settled && this.activeRoll) {
      this.visualPhase = 'result';
      this.resultUntil = this.time.now + 1500;
      this.onState(this.ctx);
    }
    if (this.visualPhase === 'result' && this.time.now >= this.resultUntil && this.activeRoll) {
      const beat = this.activeRoll;
      this.visualPhase = 'moving';
      this.travelPawn(beat.seat, beat.from, beat.to, beat.jailed, () => this.finishRoll());
      this.onState(this.ctx);
    }
    if (this.visualPhase === 'landing' && this.time.now >= this.landingUntil) {
      this.visualPhase = 'decision';
      this.landingBeat = null;
      if (this.rollQueue.length) this.startNextRoll();
      else this.onState(this.ctx);
    }
  }

  protected onBuy() {
    if (this.lastPending !== null) this.flashSquare(this.lastPending, 0xffd568);
    this.sfx('tycoon-buy');
  }

  protected onBid() {
    this.sfx('tycoon-coin');
  }

  protected onBuild(_ctx: Ctx, event: ViewEvent<{ square: number }>) {
    this.flashSquare(event.payload.square, 0x6ad991);
    this.sfx('tycoon-build');
  }

  protected onSellHouse(_ctx: Ctx, event: ViewEvent<{ square: number }>) {
    this.flashSquare(event.payload.square, 0xf3a66e);
    this.sfx('tycoon-coin');
  }

  protected onMortgage(_ctx: Ctx, event: ViewEvent<{ square: number }>) {
    this.flashSquare(event.payload.square, 0xdb8d85);
    this.sfx('tycoon-rent');
  }

  protected onRedeem(_ctx: Ctx, event: ViewEvent<{ square: number }>) {
    this.flashSquare(event.payload.square, 0x90d9a6);
    this.sfx('tycoon-buy');
  }

  protected onEndTurn(ctx: Ctx) {
    if (ctx.state.turn === ctx.me?.seat) this.sfx('tycoon-turn');
    this.tweens.add({ targets: this.heading, scale: 1.12, duration: 120, yoyo: true });
  }

  protected onPayDebt() {
    this.sfx('tycoon-rent');
  }

  protected onBankrupt() {
    this.sfx('tycoon-jail');
  }

  protected onEnd() {
    this.jingle('tycoon-win');
  }

  protected onState(ctx: Ctx) {
    const { state, players, me, result } = ctx;
    const { left, top, size, imageH, tile, sideW } = this.geometry;
    const presenting = this.visualPhase !== 'decision' || this.rollQueue.length > 0;
    state.players.forEach((player, seat) => {
      const previous = this.shownPositions[seat];
      if (!presenting && previous !== undefined && previous !== player.position && !player.bankrupt)
        this.travelPawn(seat, previous, player.position, player.jailed);
      if (previous !== 10 && player.position === 10 && player.jailed) this.sfx('tycoon-jail');
      const cash = this.shownCash[seat];
      if (!presenting && cash !== undefined && cash !== player.cash)
        this.moneyFloat(seat, player.cash - cash);
      if (!presenting) this.shownPositions[seat] = player.position;
      if (!presenting) this.shownCash[seat] = player.cash;
    });
    let transferred = false;
    state.properties.forEach((property, square) => {
      if (
        !presenting &&
        property.owner !== null &&
        property.owner !== this.shownOwners[square] &&
        !state.notice.startsWith('Đã mua') &&
        !state.notice.includes('phá sản')
      ) {
        this.flashSquare(square, 0xffd568);
        transferred = true;
      }
      if (!presenting) {
        this.shownOwners[square] = property.owner;
        this.shownProperties[square] = { ...property };
      }
    });
    if (transferred) this.sfx('tycoon-buy');
    if (!presenting && state.lastCard && state.lastCard !== this.shownCard) {
      this.sfx('tycoon-card');
      this.card.setScale(0.75).setAlpha(0.2);
      this.tweens.add({
        targets: this.card,
        scale: 1,
        alpha: 1,
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    if (!presenting && state.notice.startsWith('Tiền thuê') && state.notice !== this.shownNotice)
      this.sfx('tycoon-rent');
    if (!presenting) {
      this.shownCard = state.lastCard;
      this.shownNotice = state.notice;
    }
    this.lastPending = state.pending;
    const selected =
      this.selected ??
      (this.visualPhase === 'landing' && this.landingBeat
        ? this.landingBeat.to
        : presenting
          ? (this.shownPositions[this.activeRoll?.seat ?? state.turn] ?? 0)
          : (state.pending ?? state.players[state.turn]!.position));
    this.drawBoard(ctx);
    const turn = players[state.turn]?.name ?? '';
    this.heading.setPosition(left + size / 2, top + imageH * (this.tradeOpen ? 0.13 : 0.32));
    const rollingName = players[this.activeRoll?.seat ?? state.turn]?.name ?? turn;
    this.heading.setText(
      this.tradeOpen
        ? 'TRAO ĐỔI'
        : result
          ? 'KẾT THÚC'
          : this.visualPhase === 'landing' && this.lastLandedSquare !== null
            ? `Đến ${BOARD[this.lastLandedSquare]!.name}`
            : this.visualPhase === 'rolling'
              ? `${rollingName} gieo xúc xắc`
              : this.visualPhase === 'result'
                ? `${this.activeRoll?.dice[0]} + ${this.activeRoll?.dice[1]} = ${(this.activeRoll?.dice[0] ?? 0) + (this.activeRoll?.dice[1] ?? 0)}`
                : this.visualPhase === 'moving'
                  ? `${rollingName} đang đi`
                  : this.lastLandedSquare !== null
                    ? `Đến ${BOARD[this.lastLandedSquare]!.name}`
                    : `Lượt ${turn}`,
    );
    const statusW = this.tradeOpen ? Math.min(size * 0.42, 320) : Math.min(size * 0.56, 430);
    this.fitText(this.heading, this.heading.text, statusW - 24, 20);
    this.heading.setVisible(this.visualPhase !== 'ready');
    this.notice.setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    const dice = state.dice ? `  🎲 ${state.dice[0]} + ${state.dice[1]}` : '';
    const notice =
      state.phase === 'auction' && state.auction
        ? `Đấu giá ${BOARD[state.auction.square]!.name}: ${state.auction.highest}`
        : state.notice;
    const landedNotice = this.landingBeat?.card
      ? ''
      : this.landingBeat?.notice === `Đến ${BOARD[this.landingBeat?.to ?? 0]!.name}.`
        ? ''
        : (this.landingBeat?.notice ?? '');
    this.fitText(
      this.notice,
      presenting
        ? this.visualPhase === 'rolling'
          ? 'Xúc xắc đang lăn…'
          : this.visualPhase === 'result'
            ? `${rollingName} gieo được`
            : this.visualPhase === 'moving'
              ? `Đi ${(this.activeRoll?.dice[0] ?? 0) + (this.activeRoll?.dice[1] ?? 0)} ô`
              : this.visualPhase === 'landing'
                ? landedNotice
                : ''
        : notice + dice,
      statusW - 24,
      16,
    );
    const trade = state.trade;
    const cardText =
      this.visualPhase === 'landing'
        ? (this.landingBeat?.card ?? '')
        : trade
          ? `${players[trade.from]?.name} ↔ ${players[trade.to]?.name}: ${trade.give === null ? 'tiền' : BOARD[trade.give]!.name} / ${trade.take === null ? 'tiền' : BOARD[trade.take]!.name}`
          : (state.lastCard ?? '');
    this.card.setVisible(
      Boolean(cardText) && !this.tradeOpen && (!presenting || this.visualPhase === 'landing'),
    );
    this.fitText(this.card, cardText, Math.min(size * 0.6, 450) - 24, 15);
    this.people.forEach((text, i) => {
      const p = state.players[i];
      text.setVisible(Boolean(p));
      this.playerBadges[i]!.setVisible(Boolean(p));
      this.playerCash[i]!.setVisible(Boolean(p));
      this.playerPlace[i]!.setVisible(Boolean(p));
      if (!p) return;
      this.fitText(text, players[i]?.name ?? '', sideW - 58, 18);
      this.fitText(
        this.playerCash[i]!,
        p.bankrupt ? 'Phá sản' : `${presenting ? (this.shownCash[i] ?? p.cash) : p.cash} ₫`,
        sideW - 58,
        17,
      );
      this.fitText(
        this.playerPlace[i]!,
        !presenting && p.jailed
          ? 'Trong tù'
          : BOARD[presenting ? (this.shownPositions[i] ?? p.position) : p.position]!.name,
        sideW - 58,
        15,
      );
    });
    const cell = BOARD[selected]!;
    const deed = presenting
      ? (this.shownProperties[selected] ?? state.properties[selected]!)
      : state.properties[selected]!;
    const owner = deed.owner === null ? 'Chưa có chủ' : (players[deed.owner]?.name ?? '');
    const hasDeed = isDeed(cell);
    this.detail.setFontSize(sideW < 200 ? 23 : 28);
    this.fitText(this.detail, cell.name, sideW - 28, sideW < 200 ? 18 : 21);
    this.deedPrice.setVisible(hasDeed);
    this.deedOwner.setVisible(hasDeed);
    this.deedRent.setVisible(hasDeed);
    if (hasDeed) {
      this.deedPrice.setFontSize(sideW < 200 ? 21 : 25);
      this.fitText(this.deedPrice, `Giá ${cell.price} ₫`, sideW - 28, 18);
      const ownerLine = [
        owner,
        deed.houses ? (deed.houses === 5 ? 'Khách sạn' : `${deed.houses} nhà`) : '',
        deed.mortgaged ? 'Đang thế chấp' : '',
      ]
        .filter(Boolean)
        .join(' • ');
      this.deedOwner.setFontSize(sideW < 200 ? 18 : 21);
      this.fitText(this.deedOwner, ownerLine, sideW - 28, 16);
      const rent =
        cell.kind === 'street'
          ? `Thuê: ${cell.rent?.slice(0, 3).join(' / ')}\n${cell.rent?.slice(3).join(' / ')}`
          : cell.kind === 'station'
            ? 'Thuê: 25 / 50\n100 / 200'
            : 'Thuê: 4× hoặc 10×\nxúc xắc';
      this.deedRent.setFontSize(sideW < 200 ? 17 : 20);
      this.fitText(this.deedRent, rent, sideW - 28, 16);
    }
    this.drawHudFrames(ctx, selected);
    this.showReady(this.visualPhase === 'ready');
    this.hide(this.main);
    this.hide(this.tools);
    if (presenting) return;
    const actions = this.actions(ctx);
    const columns = this.tradeOpen ? 3 : 2;
    const buttonW = this.tradeOpen
      ? Math.min(180, (size - 2 * tile - 32) / 3)
      : Math.min(190, size * 0.32);
    const startY = this.tradeOpen
      ? top + Math.max(imageH * 0.38, imageH * 0.11 + 110)
      : top + imageH * 0.68 - (Math.ceil(actions.length / 2) - 1) * 70;
    actions.forEach(([label, action], i) => {
      const column =
        i === actions.length - 1 && actions.length % columns === 1
          ? (columns - 1) / 2
          : i % columns;
      const x = left + size / 2 + (column - (columns - 1) / 2) * (buttonW + 10);
      const y = startY + Math.floor(i / columns) * 66;
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
          top + this.deedPanelHeight(selected) + 52 + i * 70,
          sideW,
          () => this.send(event, { square: selected }),
        );
      });
    }
  }
}
