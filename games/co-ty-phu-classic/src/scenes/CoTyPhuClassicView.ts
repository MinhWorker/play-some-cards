import {
  clientHost,
  type FlowContext,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { Deck } from '../game/cards.js';
import {
  BOARD,
  GROUP_COLORS,
  isDeed,
  type MoneyTransfer,
  type Property,
  type View,
} from '../game/model.js';
import { ownsGroup, rent, utilityTax } from '../game/rules.js';
import { decisionSeat } from '../game/turnClock.js';
import { BoardPrices } from './BoardPrices.js';
import { BoardTileEffect } from './BoardTileEffect.js';
import { BOARD_CELLS, BOARD_IMAGE_RATIO } from './boardGeometry.js';
import { Dice3D } from './Dice3D.js';
import { EventDeck } from './EventDeck.js';
import { eventNotice, landingHeading } from './eventNotice.js';
import { MoneyTransferEffect } from './MoneyTransferEffect.js';
import { moneySound } from './moneySound.js';
import { PawnCashEffect } from './PawnCashEffect.js';
import { type PlayerInventory, PlayerItems } from './PlayerItems.js';
import { PropertyPresentation } from './PropertyPresentation.js';
import { RentTable } from './RentTable.js';
import { TileOwnerSymbols } from './TileOwnerSymbols.js';
import { TileTooltip } from './TileTooltip.js';
import { tileActions } from './tileActions.js';

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
type MoneyBeat = {
  sequence: number;
  transfer: MoneyTransfer;
  afterRoll: number;
  trigger: 'pass-start' | 'after-roll';
};
type ActiveMoney = {
  beat: MoneyBeat;
  before: number[];
  resume: 'landing' | 'decision' | 'moving';
};
type RollBeat = {
  id: number;
  seat: number;
  from: number;
  to: number;
  jailed: boolean;
  jailing: boolean;
  dice: [number, number];
  notice: string;
  card: string | null;
  deck: Deck | null;
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

export class CoTyPhuClassicView extends GameView<View> {
  private rentTable!: RentTable;
  private rentTableButton!: TapButton;
  private rentCloseButton!: TapButton;
  private nextBuilding!: Phaser.GameObjects.Text;
  private propertyPresentation = new PropertyPresentation();
  private playbackSpeed: 1 | 2 = 1;
  private speedButton!: TapButton;
  private previewTile: number | null = null;
  private tileTooltip!: TileTooltip;
  private board!: Phaser.GameObjects.Graphics;
  private hudPanels!: Phaser.GameObjects.Graphics;
  private boardImage!: Phaser.GameObjects.Image;
  private ownerSymbols!: TileOwnerSymbols;
  private boardPrices!: BoardPrices;
  private eventDeck!: EventDeck;
  private squares: Phaser.GameObjects.Zone[] = [];
  private tileEffects: BoardTileEffect[] = [];
  private tokens: Phaser.GameObjects.Image[] = [];
  private pawnShadows: Phaser.GameObjects.Ellipse[] = [];
  private tokenNames: Phaser.GameObjects.Text[] = [];
  private dice!: Dice3D;
  private diceHit!: Phaser.GameObjects.Zone;
  private rollHint!: Phaser.GameObjects.Text;
  private diceGlow!: Phaser.GameObjects.Graphics;
  private turnAvatar!: Phaser.GameObjects.Image;
  private turnName!: Phaser.GameObjects.Text;
  private turnCash!: Phaser.GameObjects.Text;
  private readyPanel!: Phaser.GameObjects.Graphics;
  private readyTitle!: Phaser.GameObjects.Text;
  private readySubtitle!: Phaser.GameObjects.Text;
  private readyNames: Phaser.GameObjects.Text[] = [];
  private readyCash: Phaser.GameObjects.Text[] = [];
  private readyElapsed = 0;
  private readyAmounts: number[] = [];
  private moneyIcons: Phaser.GameObjects.Image[] = [];
  private locationIcons: Phaser.GameObjects.Image[] = [];
  private readyMoneyIcons: Phaser.GameObjects.Image[] = [];
  private moneyEffect!: MoneyTransferEffect;
  private pawnCashEffect!: PawnCashEffect;
  private moneySequence = 0;
  private rollSequence = 0;
  private completedRoll = 0;
  private payments: MoneyBeat[] = [];
  private activeMoney: ActiveMoney | null = null;
  private projectedPositions: number[] = [];
  private projectedJailed: boolean[] = [];
  private passedStart = 0;
  private activeRoll: RollBeat | null = null;
  private landingBeat: RollBeat | null = null;
  private lastLandedSquare: number | null = null;
  private visualPhase:
    | 'ready'
    | 'rolling'
    | 'result'
    | 'moving'
    | 'landing'
    | 'drawing'
    | 'reveal'
    | 'payment'
    | 'thinking'
    | 'decision' = 'decision';
  private shownPositions: number[] = [];
  private shownCash: number[] = [];
  private shownOwners: (number | null)[] = [];
  private shownProperties: Property[] = [];
  private shownCard: string | null = null;
  private shownNotice = '';
  private movingTiles: (number | null)[] = [];
  private moving: boolean[] = [];
  private lastPending: number | null = null;
  private people: Phaser.GameObjects.Text[] = [];
  private playerBadges: Phaser.GameObjects.Text[] = [];
  private playerCash: Phaser.GameObjects.Text[] = [];
  private playerPlace: Phaser.GameObjects.Text[] = [];
  private tradeLabels: Phaser.GameObjects.Text[] = [];
  private heading!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private eventReadySent = -1;
  private eventCountdown!: Phaser.GameObjects.Graphics;
  private countdownLabel!: Phaser.GameObjects.Text;
  private auctionAttention!: Phaser.GameObjects.Graphics;
  private auctionPulse = 0;
  private autoActionSeen = 0;
  private playerItems!: PlayerItems;
  private inventory: PlayerInventory[] = [];
  private observedInventory: PlayerInventory[] = [];
  private card!: Phaser.GameObjects.Text;
  private deedLabel!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private deedTitleExtra = 0;
  private deedPrice!: Phaser.GameObjects.Text;
  private deedOwner!: Phaser.GameObjects.Text;
  private deedRent!: Phaser.GameObjects.Text;
  private main: TapButton[] = [];
  private tools: TapButton[] = [];
  private selected: number | null = null;
  private tileActionCount = 0;
  private tradeOpen = false;
  private tradeTo = 1;
  private tradeGive = -1;
  private tradeTake = -1;
  private giveCash = 0;
  private takeCash = 0;
  private geometry = { left: 0, top: 0, size: 500, imageH: 430, tile: 45, sideW: 150 };

  protected onCreate(ctx: Ctx) {
    this.runtime.setSpeed(this.playbackSpeed);
    this.selected = null;
    this.tileActionCount = 0;
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
    this.movingTiles = ctx.state.players.map(() => null);
    this.moving = ctx.state.players.map(() => false);
    this.lastPending = ctx.state.pending;
    this.projectedPositions = ctx.state.players.map((player) => player.position);
    this.projectedJailed = ctx.state.players.map((player) => player.jailed);
    this.passedStart = 0;
    this.activeRoll = null;
    this.landingBeat = null;
    this.lastLandedSquare = null;
    this.visualPhase = 'decision';
    this.board = this.add.graphics();
    this.hudPanels = this.add.graphics().setDepth(7);
    this.readyPanel = this.add.graphics().setDepth(25);
    this.boardImage = this.sprite('board-25d').setDepth(-1);
    this.eventReadySent = -1;
    this.autoActionSeen = ctx.state.lastAutoAction?.id ?? 0;
    this.auctionPulse = 0;
    this.eventCountdown = this.add.graphics().setDepth(6);
    this.ownerSymbols = new TileOwnerSymbols(this, this.boardImage.texture.key);
    this.boardPrices = new BoardPrices(this, this.boardImage.texture.key);
    this.eventDeck = new EventDeck(this);
    this.tileEffects = BOARD.map(() => new BoardTileEffect(this));
    this.tileTooltip = new TileTooltip(this);
    this.rentTable = new RentTable(this);
    this.squares = BOARD.map((_, i) =>
      this.add
        .zone(0, 0, 10, 10)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.selected = i;
          this.onState(this.ctx);
          this.showTileTooltip(i);
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
    this.diceGlow = this.add.graphics().setDepth(19);
    this.rollHint = this.label('Chạm để gieo', { size: 24, color: '#79501e' })
      .setStroke('#79501e', 0)
      .setDepth(21)
      .setVisible(false);
    this.diceHit = this.add
      .zone(0, 0, 180, 100)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });
    this.diceHit.on('pointerup', () => {
      if (this.rollHint.visible) this.send('roll');
    });
    this.turnAvatar = this.add.image(0, 0, this.avatar(ctx.players[ctx.state.turn]!)).setDepth(8);
    this.turnName = this.label('', { size: 24, color: '#3d2b20' })
      .setStroke('#3d2b20', 0)
      .setOrigin(0, 0)
      .setDepth(8);
    this.turnCash = this.label('', { size: 24, color: '#79501e' })
      .setStroke('#79501e', 0)
      .setOrigin(0, 0)
      .setDepth(8);
    this.moneyEffect = new MoneyTransferEffect(this, this.texture('hud-money'));
    this.pawnCashEffect = new PawnCashEffect(this);
    this.resetMoney(ctx);
    const ink = (size: number, color = '#3d2b20') =>
      this.label('', { size, color }).setStroke('#3d2b20', 0).setDepth(8);
    this.playerBadges = PLAYER_COLORS.map((_, i) => ink(21).setText(String(i + 1)));
    this.people = PLAYER_COLORS.map(() => ink(24).setOrigin(0, 0));
    this.playerCash = PLAYER_COLORS.map(() => ink(22, '#79501e').setOrigin(0, 0));
    this.playerPlace = PLAYER_COLORS.map(() => ink(19, '#66594a').setOrigin(0, 0));
    // Quiet, flattened ink follows the board surface rather than a floating HUD panel.
    this.heading = ink(30, '#57533f').setOrigin(0.5, 0).setScale(1, 0.86);
    this.notice = ink(22, '#625e49').setOrigin(0.5, 0).setScale(1, 0.86);
    this.card = ink(22, '#625e49').setOrigin(0.5, 0).setScale(1, 0.86);
    this.deedLabel = ink(18, '#906233').setOrigin(0, 0).setText('THÔNG TIN Ô');
    this.detail = ink(23).setOrigin(0, 0);
    this.deedPrice = ink(24, '#875020').setOrigin(0, 0);
    this.deedOwner = ink(20, '#67513e').setOrigin(0, 0);
    this.deedRent = ink(19, '#47382d').setOrigin(0, 0);
    this.nextBuilding = ink(19, '#79501e').setOrigin(0, 0);
    this.readyTitle = ink(32).setDepth(26).setOrigin(0.5);
    this.readySubtitle = ink(19, '#79501e').setDepth(26).setOrigin(0.5);
    this.readyNames = PLAYER_COLORS.map(() => ink(22).setDepth(26).setOrigin(0, 0.5));
    this.readyCash = PLAYER_COLORS.map(() => ink(22, '#79501e').setDepth(26).setOrigin(1, 0.5));
    this.tradeLabels = Array.from({ length: 4 }, () => ink(22).setOrigin(0.5).setVisible(false));
    this.rentTableButton = this.makeButton();
    this.rentCloseButton = this.makeButton();
    this.rentCloseButton.box.setDepth(34);
    this.rentCloseButton.text.setDepth(35);
    this.rentCloseButton.hit.setDepth(36);
    this.speedButton = this.makeButton();
    this.main = Array.from({ length: 10 }, () => this.makeButton());
    this.tools = Array.from({ length: 4 }, () => this.makeButton());
    this.moneyIcons = PLAYER_COLORS.map(() => this.sprite('hud-money').setDepth(8));
    this.locationIcons = PLAYER_COLORS.map(() => this.sprite('hud-location').setDepth(8));
    this.readyMoneyIcons = PLAYER_COLORS.map(() => this.sprite('hud-money').setDepth(26));
    this.readyElapsed = 0;
    this.readyAmounts = [];
    this.countdownLabel = this.label('', { size: 19, color: '#415c59' })
      .setStroke('#415c59', 0)
      .setDepth(12)
      .setVisible(false);
    this.auctionAttention = this.add.graphics().setDepth(9);
    this.playerItems = new PlayerItems(this);
    this.resetInventory(ctx);
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
    hit.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) {
        box.setTint(0xffedc0);
        clientHost().playUiSound('hover');
      }
    });
    hit.on('pointerout', () => box.clearTint());
    return button;
  }

  protected onLayout(ctx: Ctx) {
    this.tileTooltip.hide();
    this.previewTile = null;
    this.rentTable.hide();
    this.hide([this.rentCloseButton]);
    if (this.runtime.busy('turn') || this.runtime.busy('money')) this.onResync(ctx);
    const { width, height, top, hud } = ctx.screen;
    const size = Math.min((height - top - 8) * BOARD_IMAGE_RATIO, width - 2 * 110 * hud);
    const imageH = size / BOARD_IMAGE_RATIO;
    const left = (width - size) / 2;
    const boardTop = top + (height - top - imageH) / 2;
    const tile = size * 0.063;
    const sideW = Math.max(110, (left - 24) * 0.7);
    this.geometry = { left, top: boardTop, size, imageH, tile, sideW };
    this.boardImage.setPosition(width / 2, boardTop + imageH / 2).setDisplaySize(size, imageH);
    this.ownerSymbols.layout(width / 2, boardTop + imageH / 2, size, imageH);
    this.boardPrices.layout(width / 2, boardTop + imageH / 2, size, imageH);
    this.eventDeck.layout(left, boardTop, size, imageH);
    BOARD.forEach((_, i) => {
      const { x, y, w, h } = cellRect(left, boardTop, size, i);
      this.squares[i]!.setPosition(x + w / 2, y + h / 2).setSize(w, h);
      this.squares[i]!.input?.hitArea.setTo(0, 0, w, h);
      this.tileEffects[i]?.layout(cellQuad(left, boardTop, size, i));
    });
    this.heading.setPosition(width / 2, boardTop + imageH * 0.32).setFontSize(25 * hud);
    this.notice
      .setPosition(width / 2, boardTop + imageH * 0.405)
      .setFontSize(22 * hud)
      .setAlign('center')
      .setWordWrapWidth(Math.min(size * 0.52, 410), true);
    this.card
      .setPosition(width / 2, boardTop + imageH * 0.49)
      .setFontSize(22 * hud)
      .setAlign('center')
      .setWordWrapWidth(Math.min(size * 0.52, 410), true);
    this.dice.setPosition(width / 2, boardTop + imageH * 0.57, tile);
    this.layoutReady(ctx);
    const rightX = left + size + 12;
    this.deedLabel.setPosition(rightX + 14, boardTop + 51).setFontSize(16 * hud);
    this.detail
      .setPosition(rightX + 14, boardTop + 80)
      .setWordWrapWidth(Math.max(95, left - 52))
      .setFontSize(sideW < 200 ? 23 : 28);
    this.nextBuilding.setPosition(rightX + 14, boardTop + 198).setWordWrapWidth(0);
    this.deedPrice.setPosition(rightX + 14, boardTop + 112);
    this.deedOwner.setPosition(rightX + 14, boardTop + 142);
    this.deedRent
      .setPosition(rightX + 14, boardTop + 172)
      .setWordWrapWidth(Math.max(95, sideW - 28));
    const playerX = left + size * 0.53;
    this.people.forEach((label, i) => {
      const y = boardTop + imageH * 0.19 + i * 44;
      this.playerBadges[i]!.setPosition(playerX, y + 13)
        .setColor('#ffffff')
        .setFontSize(18);
      label.setPosition(playerX + 24, y).setFontSize(21);
      this.playerCash[i]!.setPosition(playerX + size * 0.145, y).setFontSize(21);
      this.moneyIcons[i]!.setVisible(false);
      this.locationIcons[i]!.setVisible(false);
      this.playerPlace[i]!.setVisible(false);
    });
    this.turnAvatar
      .setPosition(left + size * 0.235, boardTop + imageH * 0.245)
      .setDisplaySize(48, 48);
    this.turnName.setPosition(left + size * 0.275, boardTop + imageH * 0.19);
    this.turnCash.setPosition(left + size * 0.275, boardTop + imageH * 0.255);
    this.diceHit.setPosition(width / 2, boardTop + imageH * 0.57).setSize(180, 100);
    this.diceHit.input?.hitArea.setTo(0, 0, 180, 100);
    this.rollHint.setPosition(width / 2, boardTop + imageH * 0.69);
    this.drawHudFrames(
      ctx,
      this.selected ?? ctx.state.pending ?? ctx.state.players[ctx.state.turn]!.position,
    );
    this.drawBoard(ctx);
  }

  private layoutReady(ctx: Ctx) {
    const { left, top, size, imageH } = this.geometry;
    const w = Math.min(size * 0.68, 460);
    const h = Math.min(imageH - 18, 130 + ctx.state.players.length * 54);
    const rowH = (h - 130) / ctx.state.players.length;
    const x = left + (size - w) / 2;
    const y = top + (imageH - h) / 2;
    this.readyPanel.clear();
    this.readyPanel.fillStyle(0x442817, 0.28).fillRoundedRect(x + 6, y + 8, w, h, 18);
    this.readyPanel.fillStyle(0xfff3d7).fillRoundedRect(x, y, w, h, 18);
    this.readyPanel.lineStyle(4, 0xc38b40).strokeRoundedRect(x, y, w, h, 18);
    this.readyPanel.lineStyle(2, 0xffe5a0).strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 15);
    this.readyPanel.fillStyle(0x147cc4).fillRoundedRect(x + 12, y + 14, w - 24, 60, 12);
    this.readyPanel.lineStyle(3, 0xf6c95a).strokeRoundedRect(x + 12, y + 14, w - 24, 60, 12);
    this.readyTitle
      .setPosition(x + w / 2, y + 43)
      .setColor('#fff8df')
      .setStroke('#164769', 3)
      .setText('Sẵn sàng vào ván');
    this.fitText(this.readyTitle, this.readyTitle.text, w - 30, 24);
    this.readySubtitle.setPosition(x + w / 2, y + 92).setText('Mỗi người bắt đầu với 1.500 ₫');
    this.fitText(this.readySubtitle, this.readySubtitle.text, w - 30, 16);
    ctx.state.players.forEach((_, seat) => {
      const rowY = y + 134 + seat * rowH;
      this.readyPanel
        .fillStyle(seat % 2 ? 0xffe8c0 : 0xfff9ea)
        .fillRoundedRect(x + 16, rowY - rowH * 0.42, w - 32, rowH * 0.84, 8);
      this.readyPanel.fillStyle(PLAYER_COLORS[seat]!).fillCircle(x + 40, rowY + 1, 13);
      this.readyNames[seat]!.setPosition(x + 62, rowY).setText(
        ctx.players[seat]?.name ?? `Người ${seat + 1}`,
      );
      this.fitText(this.readyNames[seat]!, this.readyNames[seat]!.text, w * 0.53, 17);
      this.readyCash[seat]!.setPosition(x + w - 29, rowY);
      this.readyMoneyIcons[seat]!.setPosition(x + w - 132, rowY).setDisplaySize(26, 21);
    });
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
    this.readyMoneyIcons.forEach((icon, seat) => {
      icon.setVisible(show && seat < this.ctx.state.players.length);
    });
  }

  private updateReadyMoney(ctx: Ctx) {
    // Use the shared round clock so every seat follows the same opening sequence.
    const progress = Math.min(1, Math.max(0, this.readyElapsed / 1800));
    ctx.state.players.forEach((_, seat) => {
      const amount = Math.floor(progress * 50) * 30;
      if (this.readyAmounts[seat] === amount) return;
      this.readyAmounts[seat] = amount;
      const text = `${amount.toLocaleString('vi-VN')} ₫`;
      this.readyCash[seat]!.setText(text);
      this.playerCash[seat]!.setText(text);
    });
  }

  private finishReady() {
    if (this.visualPhase !== 'ready') return;
    this.visualPhase = 'decision';
    this.showReady(false);
    this.onState(this.ctx);
  }

  private drawHudFrames(ctx: Ctx, selected: number) {
    const { left, top, size, imageH, sideW } = this.geometry;
    const graphics = this.hudPanels;
    graphics.clear();
    const panel = (
      x: number,
      y: number,
      w: number,
      h: number,
      active = false,
      monochrome = false,
    ) => {
      graphics.fillStyle(monochrome ? 0x333333 : 0x3d2818, 0.24);
      graphics.fillRoundedRect(x + 3, y + 5, w, h, 14);
      graphics.fillStyle(monochrome ? 0xf2f2f2 : active ? 0xfff1c9 : 0xfff9e9);
      graphics.fillRoundedRect(x, y, w, h, 14);
      graphics.lineStyle(
        active ? 3 : 2,
        monochrome ? 0x949494 : active ? 0xe8aa31 : 0xb98046,
        0.95,
      );
      graphics.strokeRoundedRect(x, y, w, h, 14);
      graphics.lineStyle(2, monochrome ? 0xdddddd : 0xffe7ac);
      graphics.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 11);
      graphics.lineStyle(1, 0xffffff);
      graphics.lineBetween(x + 18, y + 8, x + w - 18, y + 8);
    };
    for (let i = 0; i < ctx.state.players.length; i++) {
      const x = left + size * 0.53;
      const y = top + imageH * 0.19 + i * 44;
      graphics.fillStyle(ctx.state.players[i]!.bankrupt ? 0x888888 : PLAYER_COLORS[i]!, 1);
      graphics.fillCircle(x, y + 13, 13);
      if (i === decisionSeat(ctx.state))
        graphics.lineStyle(2, 0x79501e).strokeRoundedRect(x - 17, y - 3, size * 0.25, 38, 5);
    }
    const rightX = left + size + 12;
    const panelH = this.deedPanelHeight(selected);
    panel(rightX, top + 34, sideW, panelH);
    this.playerItems.draw(
      this.inventory.map((items, seat) =>
        ctx.state.players[seat]?.bankrupt ? { ...items, freeCards: [], jailed: false } : items,
      ),
      left + size * 0.79,
      top + imageH * 0.19,
      36,
    );
    graphics.fillStyle(BOARD[selected]?.group ? GROUP_COLORS[BOARD[selected]!.group!] : 0xdbaa60);
    graphics.fillRoundedRect(rightX + 9, top + 42, sideW - 18, 5, 2);
    graphics.lineStyle(1, 0xd4b995);
    graphics.lineBetween(rightX + 14, top + 75, rightX + sideW - 14, top + 75);
    if (isDeed(BOARD[selected]!)) {
      graphics.fillStyle(0xffe8bc, 0.82);
      graphics.fillRoundedRect(rightX + 10, top + 108 + this.deedTitleExtra, sideW - 20, 32, 8);
      graphics.lineStyle(1, 0xd4b995);
      graphics.lineBetween(
        rightX + 14,
        top + 169 + this.deedTitleExtra,
        rightX + sideW - 14,
        top + 169 + this.deedTitleExtra,
      );
    }

    if (this.tradeOpen && this.visualPhase !== 'ready') {
      graphics
        .fillStyle(0xf5edd5, 0.96)
        .fillRoundedRect(left + size * 0.2, top + imageH * 0.18, size * 0.6, imageH * 0.57, 8);
      graphics
        .lineStyle(1, 0x625e49)
        .strokeRoundedRect(left + size * 0.2, top + imageH * 0.18, size * 0.6, imageH * 0.57, 8);
    }
  }

  private deedPanelHeight(selected: number) {
    const base = this.deedContentHeight(selected);
    return (
      base + (this.tileActionCount ? this.tileActionCount * this.deedActionStep(selected) + 12 : 0)
    );
  }

  private deedActionStep(selected: number) {
    const available = this.ctx.screen.height - 24 - (this.geometry.top + 34);
    return Math.min(
      62,
      (available - this.deedContentHeight(selected) - 12) / Math.max(1, this.tileActionCount),
    );
  }

  private deedContentHeight(selected: number) {
    const base = (isDeed(BOARD[selected]!) ? 264 : 180) + this.deedTitleExtra;
    return selected === 10
      ? Math.max(base, this.deedOwner.y + this.deedOwner.height - this.geometry.top - 34 + 16)
      : base;
  }

  private drawBoard(ctx: Ctx) {
    const { tile } = this.geometry;
    this.board.clear();
    this.ownerSymbols.setOwners(
      this.shownProperties.map((property) => property.owner),
      PLAYER_COLORS,
    );
    this.boardPrices.setState({ ...ctx.state, properties: this.shownProperties });
    BOARD.forEach((cell, i) => {
      const effect = this.tileEffects[i];
      effect?.setSelected(i === this.previewTile);
      effect?.setGroupAccent(null, 0);
      effect?.setActionable(
        this.visualPhase === 'decision' &&
          !this.activeMoney &&
          !this.payments.length &&
          !this.runtime.pending('turn') &&
          !this.tradeOpen &&
          tileActions(ctx.state, ctx.me?.seat ?? null, i).length > 0,
      );
      effect?.setOccupants(
        ctx.state.players.flatMap((player, seat) => {
          const position = this.shownPositions[seat] ?? player.position;
          return !player.bankrupt && !this.moving[seat] && position === i
            ? [PLAYER_COLORS[seat]!]
            : [];
        }),
      );
      const deed = this.shownProperties[i] ?? ctx.state.properties[i]!;
      if (isDeed(cell)) this.drawDeedState(i, deed);
      if (ctx.state.auction?.square === i && cell.kind === 'station') {
        ctx.state.auction.bids.forEach((amount, seat) => {
          if (!amount) return;
          const point = this.surfacePoint(i, 0.22 + seat * 0.18, 0.85);
          this.board.fillStyle(PLAYER_COLORS[seat]!).fillCircle(point.x, point.y, tile * 0.09);
        });
      }
    });
    ctx.state.players.forEach((p, i) => {
      const visiblePosition = this.shownPositions[i] ?? p.position;
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

  private fillSurfacePolygon(
    square: number,
    coords: [number, number][],
    color: number,
    graphics = this.board,
  ) {
    const points = coords.map(([along, depth]) => this.surfacePoint(square, along, depth));
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.closePath();
    graphics.fillPath();
  }

  private drawDeedState(square: number, deed: Property) {
    const layers = this.tileEffects[square]!;
    layers.buildings.clear();
    layers.mortgage.clear();
    const color = PLAYER_COLORS[deed.owner ?? 0]!;

    if (BOARD[square]!.kind === 'street' && deed.houses === 5) {
      this.fillSurfacePolygon(
        square,
        [
          [0.16, 0.851],
          [0.84, 0.851],
          [0.84, 0.922],
          [0.16, 0.922],
        ],
        0xfff4db,
        layers.buildings,
      );
      this.fillSurfacePolygon(
        square,
        [
          [0.185, 0.864],
          [0.815, 0.864],
          [0.815, 0.909],
          [0.185, 0.909],
        ],
        0x64676b,
        layers.buildings,
      );
    } else if (BOARD[square]!.kind === 'street') {
      for (let house = 0; house < deed.houses; house++) {
        const center = 0.5 + (house - (deed.houses - 1) / 2) * 0.185;
        // Project circles onto the board plane, with a light rim separating owner/group hues.
        for (const [radius, fill] of [
          [0.081, 0xfff4db],
          [0.06, color],
        ]) {
          const coords: [number, number][] = Array.from({ length: 24 }, (_, step) => {
            const angle = (step * Math.PI * 2) / 24;
            return [center + Math.cos(angle) * radius!, 0.886 + Math.sin(angle) * radius! * 0.55];
          });
          this.fillSurfacePolygon(square, coords, fill!, layers.buildings);
        }
      }
    }

    if (deed.mortgaged) {
      const from = this.surfacePoint(square, 0.08, 0.16);
      const to = this.surfacePoint(square, 0.24, 0.32);
      layers.mortgage.lineStyle(Math.max(2, this.geometry.tile * 0.055), 0xa24a45, 0.95);
      layers.mortgage.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  private put(
    button: TapButton,
    text: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
    height = 62,
    cardStyle: 'primary' | 'secondary' | 'roll' | null = null,
  ) {
    const roll = cardStyle === 'roll';
    const nativeHeight = roll ? 192 : cardStyle ? 112 : 133;
    const scale = height / nativeHeight;
    button.box.setTexture(
      this.texture(
        roll
          ? 'roll-button'
          : cardStyle === 'primary'
            ? 'tile-button-primary'
            : cardStyle
              ? 'tile-button'
              : 'button',
      ),
    );
    button.box.setSlices(
      width / scale,
      nativeHeight,
      roll ? 190 : cardStyle ? 24 : 80,
      roll ? 48 : cardStyle ? 24 : 80,
      roll ? 48 : cardStyle ? 24 : 50,
      roll ? 48 : cardStyle ? 24 : 50,
    );
    button.box
      .setVisible(true)
      .setPosition(x, y)
      .setSize(width / scale, nativeHeight)
      .setScale(scale);
    button.hit.setVisible(true).setPosition(x, y).setSize(width, height);
    button.hit.input?.hitArea.setTo(0, 0, width, height);
    button.text
      .setVisible(true)
      .setPosition(x + (roll ? height * 0.32 : 0), y - (roll ? 2 : 0))
      .setFontSize(roll ? 30 : height < 62 ? 20 : 22);
    this.fitText(button.text, text, width - (roll ? height * 1.2 : 14), roll ? 24 : 16);
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
        `Người nhận: ${ctx.players[this.tradeTo]?.name ?? ''} ›`,
        () => {
          this.tradeTo = this.cycle(seats, this.tradeTo);
          this.tradeTake = -1;
          this.takeCash = 0;
          refresh();
        },
      ],
      [
        `Đất: ${name(this.tradeGive)} ›`,
        () => {
          this.tradeGive = this.cycle(own, this.tradeGive);
          refresh();
        },
      ],
      [
        `Đất: ${name(this.tradeTake)} ›`,
        () => {
          this.tradeTake = this.cycle(theirs, this.tradeTake);
          refresh();
        },
      ],
      [
        '−50',
        () => {
          this.giveCash = Math.max(0, this.giveCash - 50);
          refresh();
        },
      ],
      [
        '+50',
        () => {
          this.giveCash = Math.min(ctx.state.players[me]!.cash, this.giveCash + 50);
          refresh();
        },
      ],
      [
        '−50',
        () => {
          this.takeCash = Math.max(0, this.takeCash - 50);
          refresh();
        },
      ],
      [
        '+50',
        () => {
          this.takeCash = Math.min(ctx.state.players[this.tradeTo]!.cash, this.takeCash + 50);
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
    if (state.phase === 'event') return [['Xác nhận', () => this.send('confirm-event')]];
    if (state.phase === 'roll') {
      const actions: [string, () => void][] = [];
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

  private showTileTooltip(square: number) {
    if (this.visualPhase === 'ready' || this.tradeOpen || this.rentTable.visible) return;
    const { state, players } = this.ctx;
    const cell = BOARD[square]!;
    const deed = state.properties[square]!;
    const lines: string[] = [];
    if (isDeed(cell)) {
      lines.push(`Giá: ${cell.price!.toLocaleString('vi-VN')} ₫`);
      lines.push(deed.owner === null ? 'Chưa có chủ' : `Chủ: ${players[deed.owner]?.name ?? ''}`);
      if (deed.mortgaged) lines.push('Đang thế chấp');
      else if (deed.owner !== null && state.players[deed.owner]!.jailed) {
        lines.push('Chủ đang ở tù · Tiền thuê: 0 ₫');
      } else if (cell.kind === 'utility') {
        const both =
          deed.owner !== null &&
          state.properties[12]!.owner === deed.owner &&
          state.properties[28]!.owner === deed.owner;
        lines.push(`Tiền thuê: ${both ? 10 : 4}× tổng xúc xắc`);
      } else {
        const amount =
          deed.owner === null
            ? cell.kind === 'station'
              ? 25
              : (cell.rent?.[0] ?? 0)
            : rent(state, square, 0);
        lines.push(`Tiền thuê: ${amount.toLocaleString('vi-VN')} ₫`);
      }
      if (cell.kind === 'street')
        lines.push(
          deed.houses === 5 ? 'Khách sạn' : `${deed.houses} nhà · Xây: ${cell.houseCost} ₫`,
        );
    } else {
      const descriptions: Partial<Record<typeof cell.kind, string>> = {
        start: 'Qua hoặc dừng: +200 ₫',
        tax: 'Thuế: 10% tiền mặt · tối thiểu 200 ₫',
        utility: `Thuế: ${utilityTax(state, square)} ₫`,
        chance: 'Rút thẻ Cơ hội',
        chest: 'Rút thẻ Khí vận',
        jail: 'Dừng ở đây: ghé thăm.\nBị đưa vào đây: ở tù.',
        'go-jail': 'Bị đưa vào tù, không nhận thưởng Xuất phát.',
        airport: 'Bay đến một ô ngẫu nhiên; xử lý ô đến như bình thường.',
      };
      lines.push(descriptions[cell.kind] ?? '');
    }
    const available = tileActions(state, this.ctx.me?.seat ?? null, square);
    if (available.length) lines.push(available.map((action) => action.label).join(' · '));
    this.previewTile = square;
    this.drawBoard(this.ctx);
    this.tileTooltip.show(
      square === 10 ? 'Nhà tù / Ghé thăm' : cell.name,
      lines.join('\n'),
      cellRect(this.geometry.left, this.geometry.top, this.geometry.size, square),
      this.ctx.screen,
    );
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

  private setMovingTile(seat: number, square: number | null) {
    const previous = this.movingTiles[seat];
    this.movingTiles[seat] = square;
    for (const index of [previous, square]) {
      if (index === null || index === undefined) continue;
      this.tileEffects[index]?.setMovingColors(
        this.movingTiles.flatMap((tile, player) =>
          tile === index ? [PLAYER_COLORS[player]!] : [],
        ),
      );
    }
  }

  private async travelPawn(
    fx: FlowContext,
    seat: number,
    from: number,
    to: number,
    jailing: boolean,
    onStartReached?: () => void,
    flying = false,
  ) {
    const token = this.tokens[seat]!;
    const shadow = this.pawnShadows[seat]!;
    const name = this.tokenNames[seat]!;
    const start = { x: token.x, y: token.y };
    const steps = (to - from + BOARD.length) % BOARD.length;
    const direct = (jailing && to === 10) || flying;
    const points = direct
      ? [this.pawnSpot(to, seat)]
      : Array.from({ length: steps }, (_, i) => this.pawnSpot((from + i + 1) % BOARD.length, seat));
    if (!points.length) {
      return;
    }
    const cursor = { value: 0 };
    let sounded = -1;
    let startReached = false;
    const reachStart = () => {
      if (startReached) return;
      startReached = true;
      onStartReached?.();
    };
    this.moving[seat] = true;
    if (jailing && to === 10) await fx.sound('tycoon-jail');
    fx.checkpoint();
    await fx.tween({
      targets: cursor,
      value: points.length,
      duration: flying ? 800 : direct ? 500 : Math.min(2000, points.length * 260),
      ease: 'Linear',
      onUpdate: () => {
        const step = Math.min(points.length - 1, Math.floor(cursor.value));
        const before = step === 0 ? start : points[step - 1]!;
        const after = points[step]!;
        // Each square has its own jump and a short planted beat before the next one.
        const fraction = Math.min(1, (cursor.value - step) / 0.76);
        const hop =
          Math.sin(fraction * Math.PI) *
          Math.min(flying ? 64 : 16, this.geometry.tile * (flying ? 1.1 : 0.28));
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
          // A slow frame or faster playback can skip several squares at once.
          for (let crossed = Math.max(1, sounded + 1); !direct && crossed <= step; crossed++) {
            if ((from + crossed) % BOARD.length === 0) reachStart();
          }
          sounded = step;
          this.setMovingTile(seat, direct ? to : (from + step + 1) % BOARD.length);
          this.sfx('tycoon-step');
        }
      },
      onComplete: () => {
        if (!direct && to === 0) reachStart();
        const target = this.pawnSpot(to, seat);
        token.setPosition(target.x, target.y);
        shadow.setPosition(target.x, target.y + 2).setAlpha(1);
        name.setPosition(target.x, target.y + target.nameY);
        this.setMovingTile(seat, null);
        this.moving[seat] = false;
      },
    });
  }

  private enqueueRoll(beat: RollBeat, dice = true) {
    this.runtime.run(
      async (fx) => {
        this.activeRoll = beat;
        await fx.frame(
          () => this.visualPhase !== 'ready' && !this.payments.some((p) => p.afterRoll < beat.id),
        );
        fx.checkpoint();
        this.activeRoll = beat;
        this.lastLandedSquare = null;
        if (dice) {
          this.visualPhase = 'rolling';
          this.dice.roll(...beat.dice);
          this.sfx('tycoon-dice');
          this.onState(this.ctx);
          await fx.frame((delta) => {
            this.dice.update(delta);
            return this.dice.settled;
          });
          fx.checkpoint();
          this.visualPhase = 'result';
          this.onState(this.ctx);
          await fx.wait(700);
        }
        fx.checkpoint();
        this.visualPhase = 'moving';
        this.onState(this.ctx);
        await this.travelPawn(
          fx,
          beat.seat,
          beat.from,
          beat.to,
          beat.jailing,
          () => {
            this.passedStart = Math.max(this.passedStart, beat.id);
          },
          !dice && BOARD[beat.from]!.kind === 'airport',
        );
        fx.checkpoint();
        this.shownPositions[beat.seat] = beat.to;
        this.selected = null;
        this.activeRoll = null;
        this.dice.hide();
        this.landingBeat = beat;
        this.lastLandedSquare = beat.from === beat.to ? null : beat.to;
        this.visualPhase = 'landing';
        this.tileEffects[beat.to]?.pulse(PLAYER_COLORS[beat.seat]!, 900);
        this.onState(this.ctx);
        await fx.wait(850);
        if (beat.deck && beat.card) {
          await fx.frame(
            () => !this.payments.some((p) => p.afterRoll <= beat.id && p.trigger === 'pass-start'),
          );
          fx.checkpoint();
          this.visualPhase = 'drawing';
          this.onState(this.ctx);
          await this.eventDeck.draw(fx, beat.deck);
          fx.checkpoint();
          this.visualPhase = 'reveal';
          this.onState(this.ctx);
          this.notice.setAlpha(0);
          fx.defer(() => this.notice.setAlpha(1));
          await fx.tween({ targets: this.notice, alpha: 1, duration: 250 });
          await fx.wait(450);
        }
        fx.checkpoint();
        this.completedRoll = Math.max(this.completedRoll, beat.id);
        await fx.frame(() => !this.payments.some((p) => p.afterRoll <= beat.id));
        fx.checkpoint();
        this.visualPhase = 'decision';
        this.landingBeat = null;
        this.onState(this.ctx);
      },
      { lane: 'turn', onFailure: () => this.onResync(this.ctx) },
    );
  }

  private flashSquare(square: number, color: number) {
    this.tileEffects[square]?.pulse(color, 520);
  }

  private resetMoney(ctx: Ctx) {
    this.moneySequence = ctx.state.moneySequence ?? 0;
    this.rollSequence = 0;
    this.completedRoll = 0;
    this.payments = [];
    this.propertyPresentation.reset();
    this.activeMoney = null;
    this.moneyEffect.hide();
    this.pawnCashEffect.hide();
  }

  private enqueueMoney(beat: MoneyBeat) {
    this.payments.push(beat);
    this.runtime.run(
      async (fx) => {
        await fx.frame(
          () =>
            this.visualPhase !== 'ready' &&
            (this.completedRoll >= beat.afterRoll ||
              (beat.trigger === 'pass-start' && this.passedStart >= beat.afterRoll)),
        );
        fx.checkpoint();
        const resume =
          this.visualPhase === 'moving'
            ? 'moving'
            : this.visualPhase === 'landing'
              ? 'landing'
              : 'decision';
        const active: ActiveMoney = { beat, before: [...this.shownCash], resume };
        this.activeMoney = active;
        const moneyEffect = this.moneyEffect;
        const cashEffect = this.pawnCashEffect;
        fx.defer(() => {
          moneyEffect.hide();
          cashEffect.hide();
          if (this.activeMoney === active) this.activeMoney = null;
          this.payments = this.payments.filter((payment) => payment !== beat);
        });
        const botThinking =
          resume !== 'moving' &&
          beat.transfer.from !== null &&
          this.ctx.players[beat.transfer.from]?.bot &&
          /^(Mua |Đấu giá |Xây ở )/.test(beat.transfer.reason);
        if (botThinking) {
          this.visualPhase = 'thinking';
          this.onState(this.ctx);
          await fx.wait(500);
        }
        await fx.sound(moneySound(beat.transfer, this.ctx.me?.seat));
        fx.checkpoint();
        if (resume !== 'moving') this.visualPhase = 'payment';
        cashEffect.begin(beat.transfer);
        this.onState(this.ctx);
        let elapsed = 0;
        await fx.frame((delta) => {
          elapsed += delta;
          this.drawMoney(active, elapsed);
          return elapsed >= 1250;
        });
        fx.checkpoint();
        if (this.visualPhase === 'payment') this.visualPhase = active.resume;
        this.activeMoney = null;
        this.payments = this.payments.filter((payment) => payment !== beat);
        moneyEffect.hide();
        cashEffect.hide();
        this.onState(this.ctx);
      },
      { lane: 'money', onFailure: () => this.onResync(this.ctx) },
    );
  }

  private observeMoney(ctx: Ctx) {
    if ((ctx.state.moneySequence ?? 0) === this.moneySequence) return;
    this.moneySequence = ctx.state.moneySequence ?? 0;
    this.propertyPresentation.enqueue({
      sequence: this.moneySequence,
      afterRoll: this.rollSequence,
      properties: ctx.state.properties,
      notice: ctx.state.notice,
    });
    for (const transfer of ctx.state.transfers ?? [])
      this.enqueueMoney({
        sequence: this.moneySequence,
        transfer: { ...transfer },
        afterRoll: this.rollSequence,
        trigger: transfer.reason === 'Qua Xuất phát' ? 'pass-start' : 'after-roll',
      });
  }

  private syncPropertyPresentation() {
    const blockedSequence =
      this.activeMoney?.beat.sequence ?? this.payments[0]?.sequence ?? Infinity;
    for (const snapshot of this.propertyPresentation.drain(this.completedRoll, blockedSequence)) {
      snapshot.properties.forEach((property, square) => {
        const before = this.shownProperties[square];
        if (
          before &&
          (before.owner !== property.owner ||
            before.houses !== property.houses ||
            before.mortgaged !== property.mortgaged)
        ) {
          this.flashSquare(
            square,
            property.mortgaged ? 0xdb8d85 : property.houses > before.houses ? 0x6ad991 : 0xffd568,
          );
        }
      });
      this.shownProperties = snapshot.properties;
      this.shownOwners = snapshot.properties.map((property) => property.owner);
      this.shownNotice = snapshot.notice;
    }
  }

  private drawMoney(active: ActiveMoney, elapsed: number) {
    this.pawnCashEffect.draw(
      elapsed / 1250,
      this.tokens.map((token) => ({ x: token.x, y: token.y - token.displayHeight - 18 })),
      this.ctx.screen,
    );
    const progress = Math.min(1, elapsed / 750);
    const eased = progress * progress * (3 - 2 * progress);
    const { transfer } = active.beat;
    for (const [seat, sign] of [
      [transfer.from, -1],
      [transfer.to, 1],
    ] as const) {
      if (seat === null) continue;
      this.shownCash[seat] = active.before[seat]! + Math.round(sign * transfer.amount * eased);
      this.playerCash[seat]!.setText(`${this.shownCash[seat]!.toLocaleString('vi-VN')} ₫`);
    }
    const { left, top, size, imageH } = this.geometry;
    const center = { x: left + size / 2, y: top + imageH * 0.6 };
    const endpoint = (seat: number | null) =>
      seat === null
        ? center
        : {
            x: this.playerCash[seat]!.x,
            y: this.playerCash[seat]!.y + 15,
          };
    this.moneyEffect.draw(
      transfer,
      endpoint(transfer.from),
      endpoint(transfer.to),
      eased,
      center,
      this.ctx.players.map((player) => player.name),
      size * 0.5,
    );
  }

  protected onStart(ctx: Ctx) {
    this.autoActionSeen = ctx.state.lastAutoAction?.id ?? 0;
    this.runtime.cancelLane('inventory');
    this.resetInventory(ctx);
    this.resetMoney(ctx);
    this.tileTooltip.hide();
    this.previewTile = null;
    this.rentTable.hide();
    this.hide([this.rentCloseButton]);
    this.runtime.cancelLane('turn');
    this.runtime.cancelLane('money');
    this.moving.fill(false);
    this.movingTiles.fill(null);
    this.tileEffects.forEach((effect) => {
      effect.setMovingColors([]);
    });
    this.shownPositions = ctx.state.players.map((player) => player.position);
    this.shownCash = ctx.state.players.map((player) => player.cash);
    this.shownOwners = ctx.state.properties.map((property) => property.owner);
    this.shownProperties = ctx.state.properties.map((property) => ({ ...property }));
    this.shownCard = ctx.state.lastCard;
    this.shownNotice = ctx.state.notice;
    this.selected = null;
    this.dice.hide();
    this.projectedPositions = ctx.state.players.map((player) => player.position);
    this.projectedJailed = ctx.state.players.map((player) => player.jailed);
    this.passedStart = 0;
    this.activeRoll = null;
    this.landingBeat = null;
    this.lastLandedSquare = null;
    this.tileEffects.forEach((effect) => {
      effect.reset();
    });
    this.eventReadySent = -1;
    this.readyElapsed = ctx.clock ? Date.now() - ctx.clock.startedAt : 0;
    this.readyAmounts = ctx.state.players.map(() => 0);
    this.visualPhase = this.readyElapsed < 2800 ? 'ready' : 'decision';
    this.readyCash.forEach((cash) => {
      cash.setText('0 ₫');
    });
    this.layoutReady(ctx);
    if (this.visualPhase === 'ready')
      this.runtime.run(
        async (fx) => {
          await fx.frame((delta) => {
            this.readyElapsed += delta;
            this.updateReadyMoney(this.ctx);
            return this.readyElapsed >= 2800;
          });
          fx.checkpoint();
          this.finishReady();
        },
        { lane: 'ready', policy: 'replace' },
      );
    this.sfx('tycoon-turn');
  }

  protected onResync(ctx: Ctx) {
    this.autoActionSeen = ctx.state.lastAutoAction?.id ?? 0;
    this.runtime.cancelLane('inventory');
    this.resetInventory(ctx);
    this.runtime.cancelLane('turn');
    this.runtime.cancelLane('money');
    this.runtime.cancelLane('ready');
    this.resetMoney(ctx);
    this.projectedPositions = ctx.state.players.map((player) => player.position);
    this.projectedJailed = ctx.state.players.map((player) => player.jailed);
    this.shownPositions = [...this.projectedPositions];
    this.shownCash = ctx.state.players.map((player) => player.cash);
    this.shownProperties = ctx.state.properties.map((property) => ({ ...property }));
    this.shownOwners = ctx.state.properties.map((property) => property.owner);
    this.shownNotice = ctx.state.notice;
    this.shownCard = ctx.state.lastCard;
    this.activeRoll = null;
    this.landingBeat = null;
    this.moving.fill(false);
    this.movingTiles.fill(null);
    this.visualPhase = 'decision';
    this.dice.hide();
    this.eventReadySent = -1;
  }

  protected onRoll(ctx: Ctx, event: ViewEvent) {
    if (!ctx.state.dice) return;
    const seat = event.player?.seat ?? ctx.state.turn;
    const from = this.projectedPositions[seat] ?? this.shownPositions[seat] ?? 0;
    const jailing = ctx.state.players[seat]!.jailed && !this.projectedJailed[seat];
    this.projectedPositions[seat] = ctx.state.players[seat]!.position;
    this.projectedJailed[seat] = ctx.state.players[seat]!.jailed;
    this.rollSequence++;
    this.observeMoney(ctx);
    this.enqueueRoll({
      id: this.rollSequence,
      seat,
      from,
      to: ctx.state.players[seat]!.position,
      jailed: ctx.state.players[seat]!.jailed,
      jailing,
      dice: [...ctx.state.dice],
      notice: ctx.state.notice,
      card: ctx.state.lastCard,
      deck: ctx.state.specialEvent?.kind === 'card' ? ctx.state.specialEvent.deck : null,
    });
  }

  protected onConfirmEvent(ctx: Ctx) {
    this.observeMovement(ctx);
  }

  private observeMovement(ctx: Ctx) {
    ctx.state.players.forEach((player, seat) => {
      if (!player.bankrupt) this.enqueueMovement(ctx, seat);
    });
  }

  private enqueueMovement(ctx: Ctx, seat: number) {
    const from =
      this.projectedPositions[seat] ??
      this.shownPositions[seat] ??
      ctx.state.players[seat]!.position;
    const to = ctx.state.players[seat]!.position;
    const jailing = ctx.state.players[seat]!.jailed && !this.projectedJailed[seat];
    if (from === to && !jailing) return;
    // Queue confirmations even while this viewer still presents the preceding roll.
    this.projectedPositions[seat] = to;
    this.projectedJailed[seat] = ctx.state.players[seat]!.jailed;
    this.rollSequence++;
    this.observeMoney(ctx);
    this.enqueueRoll(
      {
        id: this.rollSequence,
        seat,
        from,
        to,
        jailed: ctx.state.players[seat]!.jailed,
        jailing,
        dice: ctx.state.dice ?? [1, 1],
        notice: ctx.state.notice,
        card: ctx.state.lastCard,
        deck: ctx.state.specialEvent?.kind === 'card' ? ctx.state.specialEvent.deck : null,
      },
      false,
    );
  }

  protected onAutoConfirmEvent(ctx: Ctx) {
    this.onConfirmEvent(ctx);
  }

  private eventButtonY() {
    const { top, imageH } = this.geometry;
    return Math.max(top + imageH * 0.57, this.notice.y + this.notice.displayHeight + 44);
  }

  private drawEventCountdown(ctx: Ctx) {
    this.eventCountdown.clear();
    this.countdownLabel.setVisible(false);
    const timedTurn = ctx.timer?.event === 'turn-timeout';
    const seat = timedTurn ? decisionSeat(ctx.state) : ctx.state.turn;
    if (
      ctx.players[seat]?.bot ||
      this.visualPhase !== 'decision' ||
      this.activeMoney ||
      this.runtime.busy('turn') ||
      !ctx.timer ||
      (!timedTurn && ctx.timer.event !== 'auto-confirm-event') ||
      this.rentTable.visible
    )
      return;
    const { left, top, size, imageH } = this.geometry;
    const width = timedTurn ? Math.min(size * 0.22, 150) : Math.min(size * 0.4, 240);
    const x =
      timedTurn && ctx.state.phase !== 'trade' ? left + size * 0.28 : left + (size - width) / 2;
    const y = timedTurn
      ? top + imageH * (ctx.state.phase === 'trade' ? 0.24 : 0.335)
      : this.eventButtonY() + 40;
    const remaining = Math.max(0, Math.min(1, (ctx.timer.endsAt - Date.now()) / ctx.timer.ms));
    this.eventCountdown.fillStyle(0xddd4ac).fillRoundedRect(x, y, width, 10, 5);
    if (remaining > 0)
      this.eventCountdown
        .fillStyle(PLAYER_COLORS[seat]!)
        .fillRoundedRect(x, y, width * remaining, 10, 5);
    if (timedTurn)
      this.countdownLabel
        .setVisible(true)
        .setPosition(x + width / 2, y - 15)
        .setText(`${Math.max(0, Math.ceil((ctx.timer.endsAt - Date.now()) / 1000))} giây`);
  }

  private drawAuctionAttention(delta: number) {
    this.auctionAttention.clear();
    if (
      this.ctx.state.phase !== 'auction' ||
      this.visualPhase !== 'decision' ||
      this.rentTable.visible ||
      this.activeMoney
    )
      return;
    this.auctionPulse += delta;
    const pulse = (Math.sin(this.auctionPulse / 180) + 1) / 2;
    const { left, top, size, sideW } = this.geometry;
    const selected = this.ctx.state.auction!.square;
    const height = this.deedPanelHeight(selected);
    this.auctionAttention
      .lineStyle(7, 0xffc64b, 0.15 + pulse * 0.5)
      .strokeRoundedRect(left + size + 9, top + 31, sideW + 6, height + 6, 16);
    this.auctionAttention
      .lineStyle(3, 0xffe8a3, 0.4 + pulse * 0.6)
      .strokeRoundedRect(left + size + 12, top + 34, sideW, height, 14);
  }

  protected onUpdate(_ctx: Ctx, delta: number) {
    this.runtime.setSpeed(
      this.runtime.pending('turn') > 2 ? Math.max(3, this.playbackSpeed) : this.playbackSpeed,
    );
    if (this.tileTooltip.update()) {
      this.previewTile = null;
      this.drawBoard(this.ctx);
    }
    this.drawEventCountdown(this.ctx);
    if (this.rollHint.visible) {
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 260);
      this.rollHint.setAlpha(pulse);
      this.diceGlow
        .clear()
        .lineStyle(3, 0xd6a137, pulse)
        .strokeRoundedRect(this.diceHit.x - 85, this.diceHit.y - 48, 170, 96, 18);
    }
    this.drawAuctionAttention(delta);
    const event = this.ctx.state.specialEvent;
    if (
      event &&
      !event.ready &&
      this.ctx.me &&
      this.visualPhase === 'decision' &&
      !this.activeMoney &&
      !this.runtime.busy('turn') &&
      this.eventReadySent !== event.id &&
      this.ctx.me.seat === this.ctx.state.turn &&
      !this.ctx.players[this.ctx.state.turn]?.bot
    ) {
      this.eventReadySent = event.id;
      this.send('event-ready', { id: event.id });
    }
  }

  protected onEndTurn(ctx: Ctx) {
    if (ctx.state.turn === ctx.me?.seat) this.sfx('tycoon-turn');
  }

  protected onOfferTrade(ctx: Ctx) {
    if (ctx.state.trade?.to === ctx.me?.seat) this.sfx('tycoon-trade-request');
  }

  private resetInventory(ctx: Ctx) {
    this.observedInventory = ctx.state.players.map((player) => ({
      freeCards: [...player.freeCards],
      jailed: player.jailed,
      jailRolls: player.jailRolls,
    }));
    this.inventory = this.observedInventory.map((items) => ({
      ...items,
      freeCards: [...items.freeCards],
    }));
  }

  private observeInventory(ctx: Ctx) {
    ctx.state.players.forEach((player, seat) => {
      const before = this.observedInventory[seat];
      const items = {
        freeCards: [...player.freeCards],
        jailed: player.jailed,
        jailRolls: player.jailRolls,
      };
      if (JSON.stringify(items) === JSON.stringify(before)) return;
      this.observedInventory[seat] = items;
      const afterRoll = this.rollSequence;
      const received = items.freeCards.length > (before?.freeCards.length ?? 0);
      this.runtime.run(
        async (fx) => {
          await fx.frame(() => this.completedRoll >= afterRoll);
          fx.checkpoint();
          if (received) await fx.sound('tycoon-item-receive');
          fx.checkpoint();
          this.inventory[seat] = items;
          this.onState(this.ctx);
        },
        { lane: 'inventory', onFailure: () => this.onResync(this.ctx) },
      );
    });
  }

  protected onBankrupt() {
    this.sfx('tycoon-bankrupt');
  }

  protected onEnd() {
    this.jingle('tycoon-win');
  }

  protected onState(ctx: Ctx) {
    const { state, players, me, result } = ctx;
    const { left, top, size, imageH, tile, sideW } = this.geometry;
    const auto = state.lastAutoAction;
    if (auto && auto.id > this.autoActionSeen) {
      this.autoActionSeen = auto.id;
      if (auto.event === 'roll')
        this.onRoll(ctx, {
          name: 'roll',
          player: players[auto.seat] ?? null,
          isMe: auto.seat === me?.seat,
          payload: {},
        });
      else if (auto.event === 'end-turn') this.onEndTurn(ctx);
    }
    this.observeMovement(ctx);
    this.observeMoney(ctx);
    this.observeInventory(ctx);
    this.syncPropertyPresentation();
    const presenting =
      Boolean(this.activeMoney) ||
      Boolean(this.activeRoll) ||
      this.payments.some((beat) => beat.afterRoll <= this.completedRoll) ||
      this.visualPhase !== 'decision' ||
      this.runtime.pending('turn') > 0;
    if (!presenting && state.moneySequence === undefined) {
      this.shownProperties = state.properties.map((property) => ({ ...property }));
    }
    state.players.forEach((player, seat) => {
      const previous = this.shownPositions[seat];
      if (!presenting && previous !== undefined && previous !== player.position && !player.bankrupt)
        this.projectedPositions[seat] = player.position;
      if (!presenting) {
        this.shownPositions[seat] = player.position;
        this.projectedJailed[seat] = player.jailed;
        this.shownCash[seat] = player.cash;
      }
    });
    if (!presenting) {
      this.shownCard = state.lastCard;
      this.shownNotice = state.notice;
    }
    this.lastPending = state.pending;
    const selected =
      state.auction?.square ??
      this.selected ??
      (this.visualPhase === 'landing' && this.landingBeat
        ? this.landingBeat.to
        : presenting
          ? (this.shownPositions[this.activeRoll?.seat ?? state.turn] ?? 0)
          : (state.pending ?? state.players[state.turn]!.position));
    this.drawBoard(ctx);
    const turn = players[state.turn]?.name ?? '';
    const centeredControl =
      !presenting && !this.tradeOpen && (state.phase === 'roll' || state.phase === 'end');
    this.heading.setPosition(
      left + size / 2,
      top + imageH * (this.tradeOpen ? 0.2 : centeredControl ? 0.44 : 0.44),
    );
    this.notice.setY(top + imageH * 0.52);
    const rollingName = players[this.activeRoll?.seat ?? state.turn]?.name ?? turn;
    this.heading.setText(
      this.tradeOpen
        ? 'TRAO ĐỔI'
        : this.visualPhase === 'drawing' || this.visualPhase === 'reveal'
          ? this.landingBeat?.deck === 'chance'
            ? 'Cơ hội'
            : 'Khí vận'
          : this.visualPhase === 'thinking'
            ? `${players[this.activeMoney?.beat.transfer.from ?? state.turn]?.name ?? ''} đang cân nhắc`
            : result
              ? 'KẾT THÚC'
              : this.visualPhase === 'landing' && this.lastLandedSquare !== null
                ? landingHeading(
                    this.lastLandedSquare,
                    BOARD[this.lastLandedSquare]!.name,
                    this.landingBeat?.jailed ?? false,
                  )
                : this.visualPhase === 'rolling'
                  ? `${rollingName} gieo xúc xắc`
                  : this.visualPhase === 'result'
                    ? `${this.activeRoll?.dice[0]} + ${this.activeRoll?.dice[1]} = ${(this.activeRoll?.dice[0] ?? 0) + (this.activeRoll?.dice[1] ?? 0)}`
                    : this.visualPhase === 'moving'
                      ? this.activeRoll?.jailed
                        ? `Đưa ${rollingName} vào tù`
                        : `${rollingName} đang đi`
                      : `Lượt ${turn}`,
    );
    if (!presenting && state.specialEvent) {
      const event = state.specialEvent;
      this.heading.setText(
        event.kind === 'card'
          ? event.deck === 'chance'
            ? 'Cơ hội'
            : 'Khí vận'
          : event.kind === 'tax' || event.kind === 'airport'
            ? BOARD[state.players[state.turn]!.position]!.name
            : 'Bị đưa vào tù!',
      );
    }
    const statusW = this.tradeOpen ? Math.min(size * 0.42, 320) : Math.min(size * 0.56, 430);
    this.fitText(this.heading, this.heading.text, statusW - 24, 20);
    this.heading.setVisible(this.visualPhase !== 'ready');
    this.notice.setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    const notice =
      state.phase === 'auction' && state.auction
        ? `Đấu giá ${BOARD[state.auction.square]!.name}: giá cao nhất ${state.auction.highest.toLocaleString('vi-VN')} ₫.`
        : state.notice;
    const landedNotice =
      this.landingBeat && !this.landingBeat.deck
        ? eventNotice(
            this.landingBeat.notice,
            this.landingBeat.card,
            BOARD[this.landingBeat.to]!.name,
          )
        : '';
    this.notice.setText(
      this.visualPhase === 'thinking'
        ? 'Tính một chút, lời một chút…'
        : this.activeMoney
          ? eventNotice(this.activeMoney.beat.transfer.reason, null, '')
          : presenting
            ? this.visualPhase === 'rolling'
              ? 'Lắc nhẹ tay, mong vận may…'
              : this.visualPhase === 'result'
                ? `${rollingName} gieo được`
                : this.visualPhase === 'moving'
                  ? this.activeRoll?.jailed
                    ? 'Không nhận thưởng Xuất phát.'
                    : `Đang đến ${BOARD[this.activeRoll?.to ?? 0]!.name}.`
                  : this.visualPhase === 'landing'
                    ? this.landingBeat?.to === 10 && this.landingBeat.jailed
                      ? this.landingBeat.notice === 'Ba lần xúc xắc đôi: vào tù!'
                        ? 'Tung đôi 3 lần liên tiếp.'
                        : ''
                      : landedNotice
                    : this.visualPhase === 'reveal' && this.landingBeat
                      ? eventNotice(
                          this.landingBeat.notice,
                          this.landingBeat.card,
                          BOARD[this.landingBeat.to]!.name,
                        )
                      : ''
            : eventNotice(notice, state.lastCard, BOARD[state.players[state.turn]!.position]!.name),
    );
    if (this.runtime.pending('turn') > 2 && this.visualPhase === 'rolling')
      this.notice.setText(`${this.notice.text} · Theo kịp ván…`);
    const trade = state.trade;
    // Event cards share the notice line; the third text slot is only for trade details.
    const cardText = trade
      ? `${players[trade.from]?.name} đưa ${trade.give === null ? 'không có đất' : BOARD[trade.give]!.name} + ${trade.giveCash.toLocaleString('vi-VN')} ₫\n${players[trade.to]?.name} đưa ${trade.take === null ? 'không có đất' : BOARD[trade.take]!.name} + ${trade.takeCash.toLocaleString('vi-VN')} ₫`
      : '';
    this.notice.setVisible(
      !this.tradeOpen && this.visualPhase !== 'ready' && Boolean(this.notice.text),
    );
    this.eventDeck.show(this.visualPhase !== 'ready' && !this.tradeOpen && !this.rentTable.visible);
    this.card.setVisible(!this.activeMoney && Boolean(cardText) && !this.tradeOpen && !presenting);
    this.card.setText(cardText);
    this.card.setY(Math.max(top + imageH * 0.49, this.notice.y + this.notice.displayHeight + 12));
    this.people.forEach((text, i) => {
      const p = state.players[i];
      text.setVisible(Boolean(p) && !this.tradeOpen);
      this.playerBadges[i]!.setVisible(Boolean(p) && !this.tradeOpen);
      this.playerCash[i]!.setVisible(Boolean(p) && !this.tradeOpen);
      this.playerPlace[i]!.setVisible(false);
      this.moneyIcons[i]!.setVisible(false);
      this.locationIcons[i]!.setVisible(false);
      if (!p) return;
      text.setColor(p.bankrupt ? '#555555' : '#3d2b20');
      this.playerCash[i]!.setColor(p.bankrupt ? '#555555' : '#79501e');
      this.playerPlace[i]!.setColor(p.bankrupt ? '#666666' : '#66594a');
      for (const icon of [this.moneyIcons[i]!, this.locationIcons[i]!]) {
        if (p.bankrupt && !icon.filters)
          icon.enableFilters().filters?.internal.addColorMatrix().colorMatrix.grayscale();
        icon.renderFilters = p.bankrupt;
      }
      this.fitText(text, players[i]?.name ?? '', size * 0.135, 18);
      this.fitText(
        this.playerCash[i]!,
        p.bankrupt
          ? 'Phá sản'
          : `${(this.visualPhase === 'ready' ? Math.max(0, this.readyAmounts[i] ?? 0) : (this.shownCash[i] ?? p.cash)).toLocaleString('vi-VN')} ₫`,
        size * 0.1,
        17,
      );
      this.fitText(
        this.playerPlace[i]!,
        (presenting ? (this.shownPositions[i] ?? p.position) : p.position) === 10 &&
          (presenting && this.landingBeat?.seat === i ? this.landingBeat.jailed : p.jailed)
          ? 'Trong tù'
          : (presenting ? (this.shownPositions[i] ?? p.position) : p.position) === 10
            ? 'Ghé thăm nhà tù'
            : BOARD[presenting ? (this.shownPositions[i] ?? p.position) : p.position]!.name,
        size * 0.1,
        15,
      );
    });
    const cell = BOARD[selected]!;
    const deed = this.shownProperties[selected] ?? state.properties[selected]!;
    const owner = deed.owner === null ? 'Chưa có chủ' : (players[deed.owner]?.name ?? '');
    const hasDeed = isDeed(cell);
    this.detail
      .setFontSize(sideW < 200 ? 23 : 28)
      .setAlign('left')
      .setWordWrapWidth(sideW - 28, false)
      .setText(selected === 10 ? 'Nhà tù / Ghé thăm' : cell.name);
    // Measure the wrapped title before placing the rest of the deed card.
    let titleSize = sideW < 200 ? 23 : 28;
    while (this.detail.height > 68 && titleSize > 18) this.detail.setFontSize(--titleSize);
    this.deedTitleExtra = Math.max(0, this.detail.height - 24);
    const titleExtra = this.deedTitleExtra;
    this.deedPrice.setY(top + 112 + titleExtra);
    this.deedOwner
      .setY(top + 142 + titleExtra)
      .setAlign('left')
      .setWordWrapWidth(0);
    this.deedRent.setY(top + 172 + titleExtra);
    this.nextBuilding.setY(top + 198 + titleExtra);
    this.deedPrice.setVisible(hasDeed);
    this.deedOwner.setVisible(hasDeed || selected === 10);
    if (selected === 10) {
      this.deedOwner
        .setY(top + 112 + titleExtra)
        .setFontSize(18)
        .setWordWrapWidth(sideW - 28)
        .setText('Dừng ở đây: ghé thăm.\nBị đưa vào đây: ở tù.');
    }
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
      const ownerJailed = deed.owner !== null && state.players[deed.owner]!.jailed;
      const currentRent =
        deed.mortgaged || ownerJailed
          ? '0 ₫'
          : cell.kind === 'utility'
            ? `${deed.owner !== null && this.shownProperties[12]?.owner === deed.owner && this.shownProperties[28]?.owner === deed.owner ? 10 : 4}× xúc xắc`
            : `${(deed.owner === null ? (cell.kind === 'station' ? 25 : (cell.rent?.[0] ?? 0)) : rent({ properties: this.shownProperties, players: state.players }, selected, 0)).toLocaleString('vi-VN')} ₫`;
      this.deedRent.setFontSize(sideW < 200 ? 18 : 21);
      this.fitText(
        this.deedRent,
        ownerJailed ? 'Thuê: 0 ₫ · Chủ ở tù' : `Thuê: ${currentRent}`,
        sideW - 28,
        16,
      );
      this.nextBuilding.setVisible(cell.kind === 'street').setFontSize(sideW < 200 ? 17 : 20);
      this.fitText(
        this.nextBuilding,
        deed.houses === 5
          ? 'Đã có khách sạn'
          : `${deed.houses === 4 ? 'Khách sạn' : `Nhà ${deed.houses + 1}`}: ${cell.houseCost} ₫`,
        sideW - 28,
        15,
      );
    }
    if (!hasDeed) this.nextBuilding.setVisible(false);
    if (cell.kind === 'utility' || cell.kind === 'tax') {
      this.deedOwner
        .setVisible(true)
        .setFontSize(20)
        .setWordWrapWidth(sideW - 28)
        .setY(top + 112 + titleExtra)
        .setText(
          cell.kind === 'tax'
            ? '10% tiền mặt\nTối thiểu 200 ₫'
            : `Thuế ${utilityTax(state, selected)} ₫`,
        );
    }
    this.hide([this.rentTableButton]);
    if (hasDeed && this.visualPhase !== 'ready' && !this.tradeOpen) {
      this.put(
        this.rentTableButton,
        'Bảng thuê',
        left + size + 12 + sideW / 2,
        top + 248 + titleExtra,
        sideW - 24,
        () => {
          const w = Math.min(size * 0.65, 430);
          const x = left + (size - w) / 2;
          const y = top + imageH * 0.2;
          const table = this.rentTable.show(
            cell,
            deed,
            deed.owner !== null &&
              ownsGroup({ properties: this.shownProperties }, deed.owner, selected),
            x,
            y,
            w,
            deed.owner !== null && state.players[deed.owner]!.jailed,
          );
          this.tileTooltip.hide();
          this.previewTile = null;
          this.drawBoard(ctx);
          this.put(
            this.rentCloseButton,
            'Đóng',
            x + w / 2,
            y + table.height - 26,
            120,
            () => {
              this.rentTable.hide();
              this.hide([this.rentCloseButton]);
            },
            40,
            'secondary',
          );
        },
        40,
        'secondary',
      );
    }
    this.tileActionCount = 0;
    this.drawHudFrames(ctx, selected);
    this.showReady(this.visualPhase === 'ready');
    this.put(
      this.speedButton,
      `${this.playbackSpeed}×`,
      left + size * 0.765,
      top + imageH * 0.68,
      54,
      () => {
        this.playbackSpeed = this.playbackSpeed === 1 ? 2 : 1;
        this.runtime.setSpeed(this.playbackSpeed);
        this.onState(this.ctx);
      },
      34,
      'secondary',
    );
    if (this.visualPhase === 'ready') this.hide([this.speedButton]);
    this.tradeLabels.forEach((label) => {
      label.setVisible(false);
    });
    this.hide(this.main);
    this.hide(this.tools);
    this.drawEventCountdown(ctx);
    const idle = !presenting && !this.tradeOpen && !result && state.phase === 'roll';
    const canRoll = idle && me?.seat === state.turn;
    this.rollHint.setVisible(canRoll);
    this.diceHit.setVisible(canRoll);
    this.diceGlow.clear();
    if (idle) {
      this.dice.showIdle();
      this.notice.setVisible(false);
    } else if (!presenting) this.dice.hide();
    this.turnAvatar
      .setTexture(this.avatar(players[state.turn]!))
      .setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    this.turnName.setText(turn).setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    this.fitText(this.turnName, turn, size * 0.2, 18);
    this.turnCash
      .setText(
        `${(this.shownCash[state.turn] ?? state.players[state.turn]!.cash).toLocaleString('vi-VN')} ₫`,
      )
      .setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    if (presenting) return;
    if (state.phase === 'event') {
      if (me?.seat === state.turn && !result)
        this.put(
          this.main[0]!,
          'Xác nhận',
          left + size / 2,
          this.eventButtonY(),
          Math.min(size * 0.4, 240),
          () => this.send('confirm-event'),
          56,
          'primary',
        );
      return;
    }
    const actions = this.actions(ctx);
    const controls: [string, () => void][] = [];
    if (!result && !this.tradeOpen) {
      controls.push(
        ...tileActions(state, me?.seat ?? null, selected)
          .filter((action) => ['build', 'sell-house', 'mortgage', 'redeem'].includes(action.event))
          .map((action): [string, () => void] => [
            action.label,
            () => this.send(action.event, action.payload),
          ]),
      );
    }
    if (this.tradeOpen) {
      const innerW = size * 0.54;
      const columnW = (innerW - 16) / 2;
      const cx = left + size / 2;
      const columnX = [cx - (columnW + 16) / 2, cx + (columnW + 16) / 2];
      const labels = [
        'Bạn đưa',
        'Bạn nhận',
        `Tiền: ${this.giveCash.toLocaleString('vi-VN')} ₫`,
        `Tiền: ${this.takeCash.toLocaleString('vi-VN')} ₫`,
      ];
      this.tradeLabels.forEach((label, i) => {
        label
          .setVisible(true)
          .setPosition(columnX[i % 2]!, top + imageH * (i < 2 ? 0.33 : 0.475))
          .setFontSize(i < 2 ? 24 : 20);
        this.fitText(label, labels[i]!, columnW, 16);
      });
      actions.forEach(([label, action], i) => {
        const recipient = i === 0;
        const property = i === 1 || i === 2;
        const money = i >= 3 && i <= 6;
        let x = cx;
        let y = top + imageH * 0.24;
        let w = innerW;
        if (property) {
          x = columnX[i - 1]!;
          y = top + imageH * 0.395;
          w = columnW;
        }
        if (money) {
          const column = i < 5 ? 0 : 1;
          const sign = i % 2 === 1 ? -1 : 1;
          w = (columnW - 8) / 2;
          x = columnX[column]! + (sign * (w + 8)) / 2;
          y = top + imageH * 0.545;
        }
        if (i >= 7) {
          x = columnX[i - 7]!;
          y = top + imageH * 0.66;
          w = columnW;
        }
        this.put(this.main[i]!, label, x, y, w, action, 54, i === 7 ? 'primary' : 'secondary');
        if (recipient) this.main[i]!.text.setFontSize(19);
      });
      return;
    }
    const contextualActions =
      (state.phase === 'buy' && state.pending === selected) ||
      (state.phase === 'auction' && state.auction?.square === selected);
    const tileChoices =
      state.phase === 'buy' || state.phase === 'auction'
        ? tileActions(state, me?.seat ?? null, selected).map((action): [string, () => void] => [
            action.label,
            () => this.send(action.event, action.payload),
          ])
        : actions;
    const tileButtons = [
      ...controls.map(([label, action], i) => ({ button: this.tools[i]!, label, action })),
      ...(contextualActions
        ? tileChoices.map(([label, action], i) => ({ button: this.main[i]!, label, action }))
        : []),
    ];
    this.tileActionCount = tileButtons.length;
    this.drawHudFrames(ctx, selected);
    const cardButtonW = sideW - 24;
    const cardStep = this.deedActionStep(selected);
    tileButtons.forEach(({ button, label, action }, i) => {
      const x = left + size + 24 + cardButtonW / 2;
      const y = top + 34 + this.deedContentHeight(selected) + (cardStep - 6) / 2 + i * cardStep;
      this.put(
        button,
        label,
        x,
        y,
        cardButtonW,
        action,
        cardStep - 6,
        i === 0 ? 'primary' : 'secondary',
      );
    });
    const buttons =
      state.phase === 'buy' || state.phase === 'auction'
        ? []
        : actions.map(([label, action], i) => ({ button: this.main[i]!, label, action }));
    const bottom = ctx.screen.height - 24;
    const buttonW = Math.min(190, sideW);
    const rows = buttons.filter(
      ({ label }) => label !== 'Gieo xúc xắc' && label !== 'Hết lượt',
    ).length;
    const startY = bottom - 31 - (rows - 1) * 70;
    const cardBottom = top + 34 + this.deedPanelHeight(selected);
    const turnRight =
      tileButtons.length && startY - 31 < cardBottom + 12
        ? left + size * 0.76
        : ctx.screen.width - 12;
    let row = 0;
    buttons.forEach(({ button, label, action }) => {
      if (state.phase === 'roll' && label === 'Gieo xúc xắc') {
        this.put(
          button,
          label,
          left + size / 2,
          top + imageH * 0.5,
          Math.min(size * 0.49, 340),
          action,
          88,
          'roll',
        );
        return;
      }
      if (state.phase === 'end' && label === 'Hết lượt') {
        this.put(
          button,
          label,
          left + size / 2,
          top + imageH * 0.69,
          Math.min(size * 0.4, 280),
          action,
          68,
        );
        return;
      }
      const x = turnRight - buttonW / 2;
      this.put(button, label, x, startY + row++ * 70, buttonW, action);
    });
  }
}
