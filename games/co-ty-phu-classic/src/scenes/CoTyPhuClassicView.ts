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
  STARTING_CASH,
  STATION_BASE_FEE,
  type View,
} from '../game/model.js';
import { ownsGroup, rent, utilityTax } from '../game/rules.js';
import { decisionSeat } from '../game/turnClock.js';
import { BoardPrices, ownerInk } from './board/BoardPrices.js';
import { BoardTileEffect } from './board/BoardTileEffect.js';
import { BOARD_CELLS, BOARD_IMAGE_RATIO, PLAYER_PANEL } from './board/boardGeometry.js';
import { planePoint } from './board/boardPlane.js';
import { SpecialSymbols } from './board/SpecialSymbols.js';
import { TileOwnerSymbols } from './board/TileOwnerSymbols.js';
import { Backdrop } from './effects/Backdrop.js';
import { addGlow } from './effects/glow.js';
import { MoneyTransferEffect } from './effects/MoneyTransferEffect.js';
import { moneySound } from './effects/moneySound.js';
import { PawnCashEffect } from './effects/PawnCashEffect.js';
import { PlayerPanel } from './hud/PlayerPanel.js';
import { RentTable } from './hud/RentTable.js';
import { TileTooltip } from './hud/TileTooltip.js';
import { tileActions } from './hud/tileActions.js';
import { Dice3D } from './presentation/Dice3D.js';
import { EventDeck } from './presentation/EventDeck.js';
import { eventNotice, landingHeading } from './presentation/eventNotice.js';
import { PropertyPresentation } from './presentation/PropertyPresentation.js';

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

/** A seat's jail tickets and jail status, as last shown (only drives the item sound). */
type Inventory = { freeCards: Deck[]; jailed: boolean; jailRolls: number };

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
  /** Power, water, airport and Start symbols, animated. */
  private specialSymbols!: SpecialSymbols;
  private boardPrices!: BoardPrices;
  private eventDeck!: EventDeck;
  private squares: Phaser.GameObjects.Zone[] = [];
  private tileEffects: BoardTileEffect[] = [];
  private tokens: Phaser.GameObjects.Image[] = [];
  private pawnShadows: Phaser.GameObjects.Ellipse[] = [];
  /** The airport's plane, its shadow on the board and the beam that lifts a pawn. */
  private plane!: Phaser.GameObjects.Image;
  private planeShadow!: Phaser.GameObjects.Image;
  private planeBeam!: Phaser.GameObjects.Graphics;
  private tokenNames: Phaser.GameObjects.Text[] = [];
  private dice!: Dice3D;
  private diceHit!: Phaser.GameObjects.Zone;
  private rollHint!: Phaser.GameObjects.Text;
  private diceGlow!: Phaser.GameObjects.Image;
  private turnAvatar!: Phaser.GameObjects.Image;
  private turnName!: Phaser.GameObjects.Text;
  private turnCash!: Phaser.GameObjects.Text;
  private playerPanel!: PlayerPanel;
  private panelClock = false;
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
  /** Blurs and darkens the board behind the rent table and the trade offer. */
  private backdrop!: Backdrop;
  /** The trade offer's paper, above the backdrop. */
  private tradePanel!: Phaser.GameObjects.Graphics;
  private heading!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private eventReadySent = -1;
  private eventCountdown!: Phaser.GameObjects.Graphics;
  /** The host's crown, over the turn player's picture (above it). */
  private hostCrown!: Phaser.GameObjects.Graphics;
  private countdownLabel!: Phaser.GameObjects.Text;
  private auctionAttention!: Phaser.GameObjects.Graphics;
  private auctionPulse = 0;
  private autoActionSeen = 0;
  private inventory: Inventory[] = [];
  private observedInventory: Inventory[] = [];
  private card!: Phaser.GameObjects.Text;
  private deedLabel!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private deedTitleExtra = 0;
  private deedPrice!: Phaser.GameObjects.Text;
  private deedOwner!: Phaser.GameObjects.Text;
  private deedRent!: Phaser.GameObjects.Text;
  /** The numbers of the card's price, rent and next-building rows, right-aligned. */
  private deedValues: Phaser.GameObjects.Text[] = [];
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
  /**
   * The board's place (`top` is the board image's top edge) and the column on its right: `sideW`
   * wide, its card `panelTop + 34` from the top (below the room bar's corner).
   */
  /** Inner board content's scale: it follows the board's size, so a small board stays tidy. */
  private k = 1;
  private geometry = {
    left: 0,
    top: 0,
    size: 500,
    imageH: 430,
    tile: 45,
    sideW: 150,
    sideX: 512,
    panelTop: 0,
  };

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
    this.hostCrown = this.add.graphics().setDepth(9);
    this.ownerSymbols = new TileOwnerSymbols(this, this.boardImage.texture.key);
    this.specialSymbols = new SpecialSymbols(this, this.boardImage.texture.key);
    this.boardPrices = new BoardPrices(this, this.boardImage.texture.key, PLAYER_COLORS);
    this.eventDeck = new EventDeck(this);
    this.tileEffects = BOARD.map(() => new BoardTileEffect(this));
    this.tileTooltip = new TileTooltip(this);
    this.rentTable = new RentTable(this);
    // A tap around a floating panel closes it.
    this.backdrop = new Backdrop(this, 30, () => {
      if (this.rentTable.visible) this.closeRentTable();
      else if (this.tradeOpen) {
        this.tradeOpen = false;
        this.onState(this.ctx);
      }
    });
    this.tradePanel = this.add.graphics().setDepth(31);
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
    this.planeShadow = this.sprite('plane')
      .setTint(0x2b1d10)
      .setTintMode(1 /* Phaser.TintModes.FILL */)
      .setAlpha(0.22)
      .setDepth(19)
      .setVisible(false);
    this.planeBeam = this.add.graphics().setDepth(19.5);
    this.plane = this.sprite('plane').setDepth(21).setVisible(false);
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
    const glowKey = 'co-ty-phu-classic.dice-glow';
    if (!this.textures.exists(glowKey)) {
      const outline = this.add.graphics();
      outline.lineStyle(3, 0xffcf65).strokeRoundedRect(8, 8, 170, 96, 18);
      outline.generateTexture(glowKey, 186, 112);
      outline.destroy();
    }
    this.diceGlow = this.add.image(0, 0, glowKey).setDepth(19).setVisible(false);
    addGlow(this.diceGlow, 0xffcf65, 2.5, 10);
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
    // The tile card: its name (big) and owner centered, then label-left / number-right rows.
    this.deedLabel = ink(18, '#906233').setOrigin(0.5, 0).setText('THÔNG TIN Ô');
    this.detail = ink(23).setOrigin(0.5, 0);
    this.deedOwner = ink(20, '#67513e').setOrigin(0.5, 0);
    this.deedPrice = ink(20, '#875020').setOrigin(0, 0);
    this.deedRent = ink(20, '#47382d').setOrigin(0, 0);
    this.nextBuilding = ink(20, '#79501e').setOrigin(0, 0);
    this.deedValues = ['#875020', '#47382d', '#79501e'].map((color) =>
      ink(20, color).setOrigin(1, 0),
    );
    this.readyTitle = ink(32).setDepth(26).setOrigin(0.5);
    this.readySubtitle = ink(19, '#79501e').setDepth(26).setOrigin(0.5);
    this.readyNames = PLAYER_COLORS.map(() => ink(22).setDepth(26).setOrigin(0, 0.5));
    this.readyCash = PLAYER_COLORS.map(() => ink(22, '#79501e').setDepth(26).setOrigin(1, 0.5));
    this.tradeLabels = Array.from({ length: 4 }, () =>
      ink(22).setOrigin(0.5).setDepth(33).setVisible(false),
    );
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
    this.playerPanel = new PlayerPanel(this);
    this.playerPanel.add(this.turnAvatar, () => PLAYER_PANEL.avatar);
    this.playerPanel.add(this.turnName, () => PLAYER_PANEL.name);
    this.playerPanel.add(this.turnCash, () => PLAYER_PANEL.cash);
    this.playerBadges.forEach((badge, seat) => {
      this.playerPanel.add(badge, () => PLAYER_PANEL.seats[seat]!);
      this.playerPanel.add(this.playerCash[seat]!, () => ({
        u: PLAYER_PANEL.seatCash.u,
        v: PLAYER_PANEL.seats[seat]!.v,
      }));
    });
    this.playerPanel.add(this.countdownLabel, () =>
      this.panelClock
        ? {
            u: PLAYER_PANEL.bar.u1 - PLAYER_PANEL.bar.h * 0.4,
            v: PLAYER_PANEL.bar.v,
          }
        : null,
    );
    this.auctionAttention = this.add.graphics().setDepth(9);
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
    const glow = addGlow(box, 0xffdf84);
    glow?.setActive(false);
    const button = { box, hit, text: label, action: () => {} };
    hit.on('pointerup', () => button.action());
    hit.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) {
        box.setTint(0xffedc0);
        glow?.setActive(true);
        clientHost().playUiSound('hover');
      }
    });
    hit.on('pointerout', () => {
      box.clearTint();
      glow?.setActive(false);
    });
    return button;
  }

  protected onLayout(ctx: Ctx) {
    this.tileTooltip.hide();
    this.previewTile = null;
    this.closeRentTable();
    if (this.runtime.busy('turn') || this.runtime.busy('money')) this.onResync(ctx);
    const { width, height, top, hud } = ctx.screen;
    const { left, boardTop, size, sideW, sideLeft: sideX } = boardPlace(ctx.screen);
    const imageH = size / BOARD_IMAGE_RATIO;
    const tile = size * 0.063;
    this.k = Math.max(0.7, Math.min(1.15, size / 860));
    // The column's card starts under the room bar's corner and the settings button above it.
    const panelTop = top - 8;
    this.geometry = { left, top: boardTop, size, imageH, tile, sideW, sideX, panelTop };
    // The board's middle (the board is not always in the middle of the screen).
    const cx = left + size / 2;
    this.boardImage.setPosition(cx, boardTop + imageH / 2).setDisplaySize(size, imageH);
    this.ownerSymbols.layout(cx, boardTop + imageH / 2, size, imageH);
    this.specialSymbols.layout(cx, boardTop + imageH / 2, size, imageH);
    this.boardPrices.layout(cx, boardTop + imageH / 2, size, imageH);
    this.eventDeck.layout(left, boardTop, size, imageH);
    BOARD.forEach((_, i) => {
      const { x, y, w, h } = cellRect(left, boardTop, size, i);
      this.squares[i]!.setPosition(x + w / 2, y + h / 2).setSize(w, h);
      this.squares[i]!.input?.hitArea.setTo(0, 0, w, h);
      this.tileEffects[i]?.layout(cellQuad(left, boardTop, size, i));
    });
    this.heading.setPosition(cx, this.fieldY(0.06)).setFontSize(26 * this.k);
    this.notice
      .setPosition(cx, this.fieldY(0.16))
      .setFontSize(22 * this.k)
      .setAlign('center')
      .setWordWrapWidth(Math.min(size * 0.52, 410), true);
    this.card
      .setPosition(cx, this.fieldY(0.36))
      .setFontSize(20 * this.k)
      .setAlign('center')
      .setWordWrapWidth(Math.min(size * 0.52, 410), true);
    this.dice.setPosition(cx, this.fieldY(0.58), tile);
    this.layoutReady(ctx);
    const rightX = sideX;
    const middle = rightX + sideW / 2;
    this.deedLabel.setPosition(middle, this.geometry.panelTop + 51);
    this.detail.setPosition(middle, this.geometry.panelTop + 80).setFontSize(sideW < 200 ? 23 : 28);
    this.deedOwner.setPosition(middle, this.geometry.panelTop + 112);
    for (const row of [this.deedPrice, this.deedRent, this.nextBuilding]) row.setX(rightX + 14);
    for (const value of this.deedValues) value.setX(rightX + sideW - 14);
    // The players' panel (printed into the board): each seat's ball and cash in the list on the
    // right; the turn player's picture, name and cash on the left.
    this.people.forEach((label, i) => {
      const { x, y, r, cashX } = this.seatCell(i);
      this.playerBadges[i]!.setPosition(x, y)
        .setColor('#ffffff')
        .setFontSize(r * 1.25);
      label.setVisible(false);
      this.playerCash[i]!.setOrigin(0, 0.5)
        .setPosition(cashX, y)
        .setFontSize(r * 1.35);
      this.moneyIcons[i]!.setVisible(false);
      this.locationIcons[i]!.setVisible(false);
      this.playerPlace[i]!.setVisible(false);
    });
    const { avatar, name, cash } = PLAYER_PANEL;
    const picture = this.onBoard(avatar.u, avatar.v);
    const pictureR = this.onBoard(avatar.u + avatar.r, avatar.v).x - picture.x;
    this.turnAvatar
      .setPosition(picture.x, picture.y)
      .setDisplaySize(pictureR * 1.9, pictureR * 1.9);
    const nameAt = this.onBoard(name.u, name.v);
    this.turnName
      .setOrigin(0, 0.5)
      .setPosition(nameAt.x, nameAt.y)
      .setFontSize(pictureR * 0.62);
    const cashAt = this.onBoard(cash.u, cash.v);
    this.turnCash
      .setOrigin(0, 0.5)
      .setPosition(cashAt.x, cashAt.y)
      .setFontSize(pictureR * 0.5);
    this.diceHit.setPosition(cx, this.fieldY(0.58)).setSize(180, 100);
    this.diceHit.input?.hitArea.setTo(0, 0, 180, 100);
    // Between the two card decks, never over them.
    // Right under the dice, clear of the pawns standing on the bottom row.
    this.rollHint.setPosition(cx, this.fieldY(0.81)).setFontSize(20 * this.k);
    this.fitText(this.rollHint, 'Chạm để gieo', size * 0.26, 16);
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
    this.readySubtitle
      .setPosition(x + w / 2, y + 92)
      .setText(`Mỗi người bắt đầu với ${STARTING_CASH.toLocaleString('vi-VN')} ₫`);
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
      const amount = Math.round((Math.floor(progress * 50) / 50) * STARTING_CASH);
      if (this.readyAmounts[seat] === amount) return;
      this.readyAmounts[seat] = amount;
      const text = `${amount.toLocaleString('vi-VN')} ₫`;
      this.readyCash[seat]!.setText(text);
      // The bill sits just left of the amount, however wide it gets.
      this.readyMoneyIcons[seat]!.setX(
        this.readyCash[seat]!.x - this.readyCash[seat]!.displayWidth - 20,
      );
      this.setSeatCash(seat, text);
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
    // Colored seat markers and their highlights lie in the printed wells.
    // This marks the turn owner, like the panel's avatar/name. Auction bidders and
    // off-turn debt payers have their own controls/countdowns, without taking the turn.
    const turnSeat = ctx.state.turn;
    for (let i = 0; i < ctx.state.players.length; i++) {
      const well = PLAYER_PANEL.seats[i]!;
      const circle = (radius: number, dx = 0, dy = 0, ry = radius) =>
        Array.from({ length: 32 }, (_, step) => {
          const angle = (step / 32) * Math.PI * 2;
          return this.onBoard(
            well.u + well.r * (dx + Math.cos(angle) * radius),
            well.v + well.r * (dy + Math.sin(angle) * ry),
          );
        }) as Phaser.Math.Vector2[];
      const out = ctx.state.players[i]!.bankrupt;
      const lit = i === turnSeat && !out;
      const base = PLAYER_COLORS[i]!;
      const dark =
        ((((base >> 16) & 0xff) * 0.3) << 16) |
        ((((base >> 8) & 0xff) * 0.3) << 8) |
        ((base & 0xff) * 0.3);
      const color = out ? 0x44413b : lit ? base : dark;
      this.playerBadges[i]!.setColor(lit ? '#ffffff' : '#a49b87').setAlpha(lit ? 1 : 0.65);
      if (lit) {
        graphics.fillStyle(color, 0.22).fillPoints(circle(1.75), true);
        graphics.fillStyle(color, 0.35).fillPoints(circle(1.35), true);
      }
      graphics.fillStyle(color, 1).fillPoints(circle(0.92), true);
      graphics.fillStyle(0x000000, 0.14).fillPoints(circle(0.72, 0.12, 0.16), true);
      graphics.fillStyle(color, 1).fillPoints(circle(0.7, -0.04, -0.05), true);
      graphics
        .fillStyle(0xffffff, lit ? 0.85 : 0.08)
        .fillPoints(circle(0.25, -0.35, -0.42, 0.15), true);
      if (ctx.state.phase === 'auction' && ctx.state.auction?.leader === i && !lit)
        graphics.lineStyle(2, 0x6b5a3a).strokePoints(circle(1.12), true);
    }
    // The host's crown sits on the turn player's picture, when the turn is the host's.
    this.hostCrown.clear();
    const turnIsHost = ctx.players[ctx.state.turn]?.id === ctx.hostId;
    if (turnIsHost && !this.tradeOpen && this.visualPhase !== 'ready') {
      const { avatar } = PLAYER_PANEL;
      const k = avatar.r / 16;
      const crown = [
        [-9, 1],
        [-9, -7],
        [-4.5, -2],
        [0, -9],
        [4.5, -2],
        [9, -7],
        [9, 1],
      ].map(([px, py]) =>
        this.onBoard(avatar.u + px! * k, avatar.v - avatar.r * 1.02 + py! * k),
      ) as Phaser.Math.Vector2[];
      this.hostCrown.fillStyle(0xe8b230, 1).fillPoints(crown, true);
      this.hostCrown
        .lineStyle(Math.max(1, this.geometry.size * k * 1.2), 0x7a4f12, 1)
        .strokePoints(crown, true);
    }
    const rightX = this.geometry.sideX;
    const panelH = this.deedPanelHeight(selected);
    panel(rightX, this.geometry.panelTop + 34, sideW, panelH);
    graphics.fillStyle(BOARD[selected]?.group ? GROUP_COLORS[BOARD[selected]!.group!] : 0xdbaa60);
    graphics.fillRoundedRect(rightX + 9, this.geometry.panelTop + 42, sideW - 18, 5, 2);
    graphics.lineStyle(1, 0xd4b995);
    graphics.lineBetween(
      rightX + 14,
      this.geometry.panelTop + 75,
      rightX + sideW - 14,
      this.geometry.panelTop + 75,
    );
    if (isDeed(BOARD[selected]!)) {
      graphics.fillStyle(0xffe8bc, 0.82);
      // The price row's band, under the owner.
      graphics.fillRoundedRect(
        rightX + 10,
        this.geometry.panelTop + 143 + this.deedTitleExtra,
        sideW - 20,
        30,
        8,
      );
    }

    this.tradePanel.clear();
    if (this.tradeOpen && this.visualPhase !== 'ready') {
      const [x, y, w, h] = [left + size * 0.12, top + imageH * 0.14, size * 0.76, imageH * 0.62];
      this.tradePanel.fillStyle(0xf5edd5).fillRoundedRect(x, y, w, h, 14);
      this.tradePanel.lineStyle(3, 0xd2a14c).strokeRoundedRect(x, y, w, h, 14);
    }
    this.syncBackdrop();
  }

  private closeRentTable() {
    this.rentTable.hide();
    this.hide([this.rentCloseButton]);
    this.syncBackdrop();
  }

  /** The board is blurred and darkened while a panel floats over it. */
  private syncBackdrop() {
    const floating = this.rentTable.visible || (this.tradeOpen && this.visualPhase !== 'ready');
    if (floating && !this.backdrop.visible) this.backdrop.show();
    if (!floating && this.backdrop.visible) this.backdrop.hide();
  }

  /** A point of the printed board (board units, as PLAYER_PANEL) on screen. */
  private onBoard(u: number, v: number) {
    const { left, top, size, imageH } = this.geometry;
    const point = planePoint(u, v);
    return { x: left + point.x * size, y: top + point.y * imageH };
  }

  /** A height in the open field under the players' panel: 0 at its top edge, 1 at its foot. */
  private fieldY(share: number) {
    const { top, bottom } = PLAYER_PANEL.field;
    return this.onBoard(0.5, top + (bottom - top) * share).y;
  }

  /** A seat's well in the panel's list: its ball's center and radius, and where its cash goes. */
  private seatCell(seat: number) {
    const well = PLAYER_PANEL.seats[seat] ?? PLAYER_PANEL.seats[0];
    const { x, y } = this.onBoard(well.u, well.v);
    const r = this.onBoard(well.u + well.r, well.v).x - x;
    const cashX = this.onBoard(PLAYER_PANEL.seatCash.u, well.v).x;
    // The cash may run to the panel's right edge.
    return { x, y, r, cashX, cashW: this.onBoard(0.8, well.v).x - cashX };
  }

  /** A seat's cash, shrunk to fit beside its ball (it changes while money moves). */
  private setSeatCash(seat: number, text: string) {
    const cash = this.playerCash[seat];
    if (!cash) return;
    const { r, cashW } = this.seatCell(seat);
    cash.setFontSize(r * 1.35);
    this.fitText(cash, text, cashW, 12);
  }

  private deedPanelHeight(selected: number) {
    const base = this.deedContentHeight(selected);
    return (
      base + (this.tileActionCount ? this.tileActionCount * this.deedActionStep(selected) + 12 : 0)
    );
  }

  private deedActionStep(selected: number) {
    const available = this.ctx.screen.height - 24 - (this.geometry.panelTop + 34);
    return Math.min(
      62,
      (available - this.deedContentHeight(selected) - 12) / Math.max(1, this.tileActionCount),
    );
  }

  private deedContentHeight(selected: number) {
    const base = (isDeed(BOARD[selected]!) ? 282 : 180) + this.deedTitleExtra;
    return selected === 10
      ? Math.max(base, this.deedOwner.y + this.deedOwner.height - this.geometry.panelTop - 34 + 16)
      : base;
  }

  private drawBoard(ctx: Ctx) {
    const { tile } = this.geometry;
    this.board.clear();
    this.ownerSymbols.setOwners(
      this.shownProperties.map((property) => property.owner),
      PLAYER_COLORS,
    );
    this.specialSymbols.setOwners(
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
      if (ctx.state.stationAuctions[i] && cell.kind === 'station') {
        ctx.state.stationAuctions[i]!.bids.forEach((amount, seat) => {
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
      // A hotel is a capsule across the tile's foot: a cream rim round the owner's color.
      for (const [inset, fill] of [
        [0, 0xfff4db],
        [0.016, color],
      ] as const) {
        this.fillSurfacePolygon(
          square,
          capsule(0.2 + inset, 0.8 - inset, 0.875, 0.052 - inset),
          fill,
          layers.buildings,
        );
      }
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

    if (deed.mortgaged) this.drawBankSeal(square, layers.mortgage);
  }

  /**
   * A mortgaged tile carries the bank's seal: a tilted cinnabar stamp (two rings round a bank
   * front), laid on the tile's surface so it follows the board's perspective.
   */
  private drawBankSeal(square: number, g: Phaser.GameObjects.Graphics) {
    const ink = 0xb0352c;
    const tilt = (-14 * Math.PI) / 180;
    // In seal units (radius 1); depth is shorter than along on a tile, so the seal stays round.
    const at = (x: number, y: number) =>
      this.surfacePoint(
        square,
        0.5 + (x * Math.cos(tilt) - y * Math.sin(tilt)) * 0.36,
        0.44 + (x * Math.sin(tilt) + y * Math.cos(tilt)) * 0.36 * 0.62,
      );
    const ring = (r: number) =>
      Array.from({ length: 32 }, (_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        return at(Math.cos(angle) * r, Math.sin(angle) * r);
      });
    const shape = (coords: [number, number][]) => coords.map(([x, y]) => at(x, y));
    // Phaser only reads x and y of each point.
    const v = (points: { x: number; y: number }[]) => points as Phaser.Math.Vector2[];
    const line = Math.max(1.5, this.geometry.tile * 0.05);
    g.lineStyle(line, ink, 0.85).strokePoints(v(ring(1)), true);
    g.lineStyle(line * 0.5, ink, 0.85).strokePoints(v(ring(0.8)), true);
    g.fillStyle(ink, 0.85);
    // The bank: a pediment, three columns and a step.
    g.fillPoints(
      v(
        shape([
          [-0.5, -0.22],
          [0, -0.52],
          [0.5, -0.22],
        ]),
      ),
      true,
    );
    for (const x of [-0.32, 0, 0.32]) {
      g.fillPoints(
        v(
          shape([
            [x - 0.07, -0.14],
            [x + 0.07, -0.14],
            [x + 0.07, 0.3],
            [x - 0.07, 0.3],
          ]),
        ),
        true,
      );
    }
    g.fillPoints(
      v(
        shape([
          [-0.52, 0.36],
          [0.52, 0.36],
          [0.52, 0.48],
          [-0.52, 0.48],
        ]),
      ),
      true,
    );
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
    if (state.phase === 'auction' && state.auction) {
      // The bidder's choices, the same as on the auctioned tile's card.
      return tileActions(state, me.seat, state.auction.square).map(({ label, event, payload }) => [
        label,
        () => this.send(event, payload),
      ]);
    }
    if (state.phase === 'debt')
      return decisionSeat(state) === me.seat
        ? [
            [`Trả ${state.debt!.amount}`, () => this.send('pay-debt')],
            ['Phá sản', () => this.send('bankrupt')],
          ]
        : [];
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
        tax: `Thuế: 10% tiền mặt · tối thiểu ${cell.tax} ₫`,
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
      cell.name,
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

  /** A pawn's scale at height `y`: small, so tiles stay readable; bigger nearer the viewer. */
  private pawnScale(y: number) {
    const { top, imageH } = this.geometry;
    return 0.5 * (0.78 + 0.35 * Math.max(0, Math.min(1, (y - top) / imageH)));
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

  /**
   * The airport's flight: a plane sweeps across the board without stopping, snatches the pawn
   * in a short beam as it passes over it, and drops it on `to` as it passes there, then flies on
   * off the board. Its shadow runs along the board below it.
   */
  private async airlift(fx: FlowContext, seat: number, to: number) {
    const token = this.tokens[seat]!;
    const pawnShadow = this.pawnShadows[seat]!;
    const name = this.tokenNames[seat]!;
    const { tile, size } = this.geometry;
    const pick = { x: token.x, y: token.y };
    const drop = this.pawnSpot(to, seat);
    // In from beyond the pick-up, out beyond the drop, bowing in over the board's middle so the
    // whole flight stays on screen (a corner or an edge row is near the frame's edge).
    const { left, top: boardTop, imageH } = this.geometry;
    const middle = { x: left + size / 2, y: boardTop + imageH * 0.45 };
    let dx = pick.x - drop.x;
    let dy = pick.y - drop.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const far = size * 0.75;
    const toward = (point: { x: number; y: number }, share: number) => ({
      x: point.x + (middle.x - point.x) * share,
      y: point.y + (middle.y - point.y) * share,
    });
    const halfway = { x: (pick.x + drop.x) / 2, y: (pick.y + drop.y) / 2 };
    const entry = toward({ x: pick.x + dx * far, y: pick.y + dy * far }, 0.55);
    const exit = toward({ x: drop.x - dx * far, y: drop.y - dy * far }, 0.55);
    const path = sweep([entry, pick, toward(halfway, 0.8), drop, exit]);
    const total = path.length;
    // Where along the path (0–1, by distance) the plane is over the pick-up and the drop.
    const at = (point: { x: number; y: number }) => {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i <= 200; i++) {
        const p = path.at(i / 200);
        const d = Math.hypot(p.x - point.x, p.y - point.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = i / 200;
        }
      }
      return best;
    };
    const tPick = at(pick);
    const tDrop = at(drop);
    // Seen from above, the plane is right over its path; its height shows in its shadow's
    // offset. A snatched pawn rises a little and shrinks away under the plane.
    const rise = tile * 0.3;
    const span = tile * 2.4;
    const planeScale = span / this.plane.width;
    const lift = 0.07;
    this.moving[seat] = true;
    // The destination is ringed in the pawn's color for the whole flight, as for a walk.
    this.setMovingTile(seat, to);
    this.plane.setVisible(true).setScale(planeScale);
    this.planeShadow.setVisible(true).setScale(planeScale * 0.8);
    const flyover = this.runtime.audio.play('tycoon-plane', { maxStartDelayMs: 100 });
    fx.defer(() => flyover.stop());
    const cursor = { value: 0 };
    const ease = (f: number) => 1 - (1 - f) ** 3;
    const ring = (at: { x: number; y: number }, f: number) => {
      // A flash of light round the pawn as it is taken or set down.
      if (f <= 0 || f >= 1) return;
      this.planeBeam
        .lineStyle(tile * 0.08, 0xfff3b0, 0.8 * (1 - f))
        .strokeEllipse(at.x, at.y, tile * (0.5 + 0.9 * f), tile * (0.25 + 0.45 * f));
    };
    await fx.tween({
      targets: cursor,
      value: 1,
      duration: Math.min(3600, Math.max(2200, (total / size) * 1100)),
      ease: 'Linear',
      onUpdate: () => {
        const t = cursor.value;
        const ground = path.at(t);
        const ahead = path.at(Math.min(1, t + 0.01));
        const behind = path.at(Math.max(0, t - 0.01));
        const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
        this.plane.setPosition(ground.x, ground.y).setRotation(angle);
        this.planeShadow
          .setPosition(ground.x + tile * 0.7, ground.y + tile * 0.55)
          .setRotation(angle);
        this.planeBeam.clear();
        // Snatched on the fly, then carried along hidden under the plane.
        let carried = 0;
        let x = pick.x;
        let y = pick.y;
        if (t >= tPick - lift / 2 && t < tDrop) {
          carried = ease(Math.min(1, (t - (tPick - lift / 2)) / lift));
          x = pick.x + (ground.x - pick.x) * carried;
          y = pick.y + (ground.y - pick.y) * carried;
          ring(pick, carried);
        }
        let height = rise * carried;
        let shown = 1 - carried;
        if (t >= tDrop) {
          // Let go over the drop: it grows back as it falls, with a little bounce.
          const fall = Math.min(1, (t - tDrop) / 0.09);
          const bounce = Math.min(1, Math.max(0, (t - tDrop - 0.09) / 0.05));
          x = drop.x;
          y = drop.y;
          height = rise * (1 - fall * fall) + Math.sin(bounce * Math.PI) * tile * 0.2;
          shown = fall;
          ring(drop, fall);
        }
        const perspective = this.pawnScale(y);
        const shrink = 0.45 + 0.55 * shown;
        token
          .setPosition(x, y - height)
          .setDepth(shown < 1 ? 20.5 : 5 + y / 1000)
          .setDisplaySize(tile * 0.76 * perspective * shrink, tile * 1.05 * perspective * shrink);
        pawnShadow.setPosition(x, y + 2).setAlpha(shown);
        name.setPosition(x, y - height - tile * 1.22 * perspective * shrink).setAlpha(shown);
      },
    });
    fx.checkpoint();
    flyover.stop();
    this.plane.setVisible(false);
    this.planeShadow.setVisible(false);
    this.planeBeam.clear();
    this.setMovingTile(seat, null);
    this.moving[seat] = false;
  }

  private async travelPawn(
    fx: FlowContext,
    seat: number,
    from: number,
    to: number,
    jailing: boolean,
    onStartReached?: () => void,
  ) {
    const token = this.tokens[seat]!;
    const shadow = this.pawnShadows[seat]!;
    const name = this.tokenNames[seat]!;
    const start = { x: token.x, y: token.y };
    const steps = (to - from + BOARD.length) % BOARD.length;
    const direct = jailing && to === 10;
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
      duration: direct ? 500 : Math.min(2000, points.length * 260),
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
        if (!dice && BOARD[beat.from]!.kind === 'airport' && beat.from !== beat.to)
          await this.airlift(fx, beat.seat, beat.to);
        else
          await this.travelPawn(fx, beat.seat, beat.from, beat.to, beat.jailing, () => {
            this.passedStart = Math.max(this.passedStart, beat.id);
          });
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
      this.setSeatCash(seat, `${this.shownCash[seat]!.toLocaleString('vi-VN')} ₫`);
    }
    const { left, top, size, imageH } = this.geometry;
    // The bank stands low in the middle of the board, clear of the notice lines.
    const bank = { x: left + size / 2, y: top + imageH * 0.64 };
    const endpoint = (seat: number | null) =>
      seat === null
        ? bank
        : {
            x: this.playerCash[seat]!.x + this.playerCash[seat]!.displayWidth / 2,
            y: this.playerCash[seat]!.y,
          };
    this.moneyEffect.draw(transfer, endpoint(transfer.from), endpoint(transfer.to), eased);
  }

  protected onStart(ctx: Ctx) {
    this.autoActionSeen = ctx.state.lastAutoAction?.id ?? 0;
    this.runtime.cancelLane('inventory');
    this.resetInventory(ctx);
    this.resetMoney(ctx);
    this.tileTooltip.hide();
    this.previewTile = null;
    this.closeRentTable();
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
    return Math.max(this.fieldY(0.62), this.notice.y + this.notice.displayHeight + 44);
  }

  private drawEventCountdown(ctx: Ctx) {
    this.eventCountdown.clear();
    this.panelClock = false;
    this.countdownLabel.setVisible(false).setColor('#415c59');
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
    const remaining = Math.max(0, Math.min(1, (ctx.timer.endsAt - Date.now()) / ctx.timer.ms));
    const seconds = Math.max(0, Math.ceil((ctx.timer.endsAt - Date.now()) / 1000));
    if (timedTurn && ctx.state.phase === 'auction') {
      this.drawAuctionCountdown(remaining, seconds, PLAYER_COLORS[seat]!);
      return;
    }
    if (timedTurn && ctx.state.phase !== 'trade') {
      // In the panel's groove under the turn player's cash, its seconds at the groove's end.
      const { u0, u1, v, h } = PLAYER_PANEL.bar;
      this.panelClock = true;
      const height = this.onBoard(u0, v + h / 2).y - this.onBoard(u0, v - h / 2).y;
      const width = Math.max(h, (u1 - u0) * remaining);
      if (remaining > 0) {
        const radius = h / 2;
        const capsule = Array.from({ length: 34 }, (_, step) => {
          const right = step < 17;
          const angle =
            -Math.PI / 2 + ((right ? step : step - 17) / 16) * Math.PI + (right ? 0 : Math.PI);
          return this.onBoard(
            u0 + (right ? width - radius : radius) + Math.cos(angle) * radius,
            v + Math.sin(angle) * radius,
          );
        }) as Phaser.Math.Vector2[];
        this.eventCountdown.fillStyle(PLAYER_COLORS[seat]!).fillPoints(capsule, true);
      }
      const end = this.onBoard(u1 - h * 0.4, v);
      this.countdownLabel
        .setVisible(true)
        .setOrigin(1, 0.5)
        .setFontSize(height * 0.95)
        .setColor('#fff7e8')
        .setPosition(end.x, end.y)
        .setText(`${seconds} giây`);
      return;
    }
    const width = timedTurn ? Math.min(size * 0.22, 150) : Math.min(size * 0.4, 240);
    const x = left + (size - width) / 2;
    // A trade's answer clock sits under the offer's lines.
    const y = timedTurn ? this.card.y + this.card.displayHeight + 12 : this.eventButtonY() + 40;
    this.bar(x, y, width, remaining, PLAYER_COLORS[seat]!);
    if (timedTurn)
      this.countdownLabel
        .setVisible(true)
        .setOrigin(0, 0.5)
        .setFontSize(18 * this.k)
        .setPosition(x + width + 8, y + 5)
        .setText(`${seconds} giây`);
  }

  /**
   * Board ink set tight: lines close together (the font's own leading is loose), and at most
   * `lines` lines, the font shrinking (down to 15) until the text fits them.
   */
  private compact(text: Phaser.GameObjects.Text, size: number, lines: number) {
    let px = Math.round(size);
    const set = () => text.setFontSize(px).setLineSpacing(-Math.round(px * 0.2));
    set();
    while (text.getWrappedText().length > lines && px > 15) {
      px--;
      set();
    }
  }

  /** A countdown bar: a track, and `remaining` (0–1) of it filled in `color`. */
  private bar(x: number, y: number, width: number, remaining: number, color: number) {
    this.eventCountdown.fillStyle(0xddd4ac).fillRoundedRect(x, y, width, 10 * this.k, 5 * this.k);
    if (remaining > 0)
      this.eventCountdown
        .fillStyle(color)
        .fillRoundedRect(x, y, width * remaining, 10 * this.k, 5 * this.k);
  }

  /** The bidder's countdown, in their color, right under the auction's line. */
  private drawAuctionCountdown(remaining: number, seconds: number, color: number) {
    const { left, size } = this.geometry;
    const width = Math.min(size * 0.36, 240);
    const x = left + (size - width) / 2 - 24;
    const y = this.notice.y + (this.notice.visible ? this.notice.displayHeight : 0) + 12;
    this.bar(x, y, width, remaining, color);
    this.countdownLabel
      .setVisible(true)
      .setOrigin(0, 0.5)
      .setFontSize(18 * this.k)
      .setPosition(x + width + 8, y + 5)
      .setText(`${seconds} giây`);
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
      .strokeRoundedRect(
        this.geometry.sideX - 3,
        this.geometry.panelTop + 31,
        sideW + 6,
        height + 6,
        16,
      );
    this.auctionAttention
      .lineStyle(3, 0xffe8a3, 0.4 + pulse * 0.6)
      .strokeRoundedRect(this.geometry.sideX, this.geometry.panelTop + 34, sideW, height, 14);
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
    this.diceGlow.setVisible(this.rollHint.visible);
    if (this.rollHint.visible) {
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 260);
      this.rollHint.setAlpha(pulse);
      this.diceGlow.setPosition(this.diceHit.x, this.diceHit.y).setAlpha(pulse).setVisible(true);
    }
    this.drawAuctionAttention(delta);
    this.specialSymbols.update(this.time.now);
    this.playerPanel.update(this.geometry);
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
    // The notice sits right under the heading.
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
                      : state.phase === 'auction' && state.auction
                        ? `Đấu giá · lượt ${players[state.auction.bidder]?.name ?? ''}`
                        : state.phase === 'debt'
                          ? `${players[decisionSeat(state)]?.name ?? ''} trả nợ`
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
    this.notice.setY(this.heading.y + this.heading.displayHeight + 2);
    this.heading.setVisible(this.visualPhase !== 'ready');
    this.notice.setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    const auction = state.auction;
    const notice =
      state.phase === 'auction' && auction
        ? `${BOARD[auction.square]!.name} · ${
            BOARD[auction.square]!.kind === 'station'
              ? `Lần góp gần nhất ${auction.highest.toLocaleString('vi-VN')} ₫`
              : auction.leader === null
                ? 'chưa ai trả giá'
                : `${players[auction.leader]?.name ?? ''} dẫn ${auction.highest.toLocaleString('vi-VN')} ₫`
          }`
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
    // What each side gives: a plot and/or cash, one short line each.
    const gives = (deed: number | null, cash: number) =>
      [deed === null ? '' : BOARD[deed]!.name, cash ? `${cash.toLocaleString('vi-VN')} ₫` : '']
        .filter(Boolean)
        .join(' + ') || 'không gì';
    const cardText = trade
      ? `${players[trade.from]?.name} đưa ${gives(trade.give, trade.giveCash)}\n${players[trade.to]?.name} đưa ${gives(trade.take, trade.takeCash)}`
      : '';
    this.notice.setVisible(
      !this.tradeOpen && this.visualPhase !== 'ready' && Boolean(this.notice.text),
    );
    // The card decks step aside while an offer or an auction fills the middle.
    this.eventDeck.show(
      this.visualPhase !== 'ready' &&
        !this.tradeOpen &&
        !this.rentTable.visible &&
        state.phase !== 'trade' &&
        state.phase !== 'auction',
    );
    this.card.setVisible(!this.activeMoney && Boolean(cardText) && !this.tradeOpen && !presenting);
    this.card.setText(cardText);
    this.compact(this.notice, 22 * this.k, 2);
    this.compact(this.card, 20 * this.k, 2);
    this.card.setY(this.notice.y + (this.notice.visible ? this.notice.displayHeight + 6 : 0));
    this.people.forEach((text, i) => {
      const p = state.players[i];
      text.setVisible(false);
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
      this.setSeatCash(
        i,
        p.bankrupt
          ? 'Phá sản'
          : `${(this.visualPhase === 'ready' ? Math.max(0, this.readyAmounts[i] ?? 0) : (this.shownCash[i] ?? p.cash)).toLocaleString('vi-VN')} ₫`,
      );
      // Hidden: only records where each token is shown, in words.
      this.playerPlace[i]!.setText(
        (presenting ? (this.shownPositions[i] ?? p.position) : p.position) === 10 &&
          (presenting && this.landingBeat?.seat === i ? this.landingBeat.jailed : p.jailed)
          ? 'Trong tù'
          : (presenting ? (this.shownPositions[i] ?? p.position) : p.position) === 10
            ? 'Ghé thăm nhà tù'
            : BOARD[presenting ? (this.shownPositions[i] ?? p.position) : p.position]!.name,
      );
    });
    const cell = BOARD[selected]!;
    const deed = this.shownProperties[selected] ?? state.properties[selected]!;
    const owner = deed.owner === null ? 'Chưa có chủ' : (players[deed.owner]?.name ?? '');
    const hasDeed = isDeed(cell);
    // One size for everything but the tile's name.
    const ink = sideW < 200 ? 18 : 20;
    const ownerColor = hasDeed && deed.owner !== null ? PLAYER_COLORS[deed.owner] : undefined;
    this.deedLabel.setFontSize(ink);
    this.detail
      .setFontSize(sideW < 200 ? 23 : 28)
      .setAlign('center')
      .setColor(ownerColor === undefined ? '#3d2b20' : ownerInk(ownerColor))
      .setWordWrapWidth(sideW - 28, false)
      .setText(cell.name);
    // Measure the wrapped title before placing the rest of the deed card.
    let titleSize = sideW < 200 ? 23 : 28;
    while (this.detail.height > 68 && titleSize > 18) this.detail.setFontSize(--titleSize);
    this.deedTitleExtra = Math.max(0, this.detail.height - 24);
    const titleExtra = this.deedTitleExtra;
    const rowY = (row: number) => this.geometry.panelTop + 146 + row * 29 + titleExtra;
    // Label left, number right; `null` hides the row.
    const deedRows: ([string, string] | null)[] = [null, null, null];
    this.deedOwner
      .setY(this.geometry.panelTop + 112 + titleExtra)
      .setFontSize(ink)
      .setAlign('center')
      .setWordWrapWidth(0)
      .setVisible(hasDeed || selected === 10);
    if (selected === 10)
      this.deedOwner
        .setWordWrapWidth(sideW - 28)
        .setText('Dừng ở đây: ghé thăm.\nBị đưa vào đây: ở tù.');
    if (hasDeed) {
      const ownerJailed = deed.owner !== null && state.players[deed.owner]!.jailed;
      const ownerLine = [
        owner,
        deed.houses ? (deed.houses === 5 ? 'Khách sạn' : `${deed.houses} nhà`) : '',
        deed.mortgaged ? 'Thế chấp' : '',
        ownerJailed ? 'Chủ ở tù' : '',
      ]
        .filter(Boolean)
        .join(' • ');
      this.fitText(this.deedOwner, ownerLine, sideW - 28, 14);
      const currentRent =
        deed.mortgaged || ownerJailed
          ? '0 ₫'
          : cell.kind === 'utility'
            ? `${deed.owner !== null && this.shownProperties[12]?.owner === deed.owner && this.shownProperties[28]?.owner === deed.owner ? 10 : 4}× xúc xắc`
            : `${(deed.owner === null ? (cell.kind === 'station' ? STATION_BASE_FEE : (cell.rent?.[0] ?? 0)) : rent({ properties: this.shownProperties, players: state.players }, selected, 0)).toLocaleString('vi-VN')} ₫`;
      deedRows[0] = ['Giá', `${cell.price} ₫`];
      deedRows[1] = [cell.kind === 'station' ? 'Phí' : 'Thuê', currentRent];
      const stationAuction = state.stationAuctions[selected];
      if (cell.kind === 'station' && stationAuction) {
        const deposit = ctx.me
          ? stationAuction.bids[ctx.me.seat]!
          : stationAuction.bids.reduce((sum, amount) => sum + amount, 0);
        deedRows[2] = [ctx.me ? 'Đã góp' : 'Tích trữ', `${deposit.toLocaleString('vi-VN')} ₫`];
      }
      if (cell.kind === 'street')
        deedRows[2] =
          deed.houses === 5
            ? ['Đã có khách sạn', '']
            : [deed.houses === 4 ? 'Khách sạn' : `Nhà ${deed.houses + 1}`, `${cell.houseCost} ₫`];
    }
    if (cell.kind === 'tax') {
      deedRows[0] = ['Thuế', '10% tiền mặt'];
      deedRows[1] = ['Tối thiểu', `${cell.tax} ₫`];
    }
    if (cell.kind === 'utility') deedRows[0] = ['Thuế', `${utilityTax(state, selected)} ₫`];
    [this.deedPrice, this.deedRent, this.nextBuilding].forEach((label, i) => {
      const row = deedRows[i];
      const value = this.deedValues[i]!;
      label.setVisible(Boolean(row)).setY(rowY(i)).setFontSize(ink);
      value.setVisible(Boolean(row)).setY(rowY(i)).setFontSize(ink);
      if (!row) return;
      value.setText(row[1]);
      const room = sideW - 28 - (row[1] ? value.width + 12 : 0);
      this.fitText(label, row[0], room, 13);
    });
    this.hide([this.rentTableButton]);
    if (hasDeed && this.visualPhase !== 'ready' && !this.tradeOpen) {
      this.put(
        this.rentTableButton,
        'Bảng thuê',
        this.geometry.sideX + sideW / 2,
        this.geometry.panelTop + 258 + titleExtra,
        sideW - 24,
        () => {
          // Floating over the board's middle, the board blurred behind it.
          const w = Math.min(size * 0.8, 600);
          const x = left + (size - w) / 2;
          const table = this.rentTable.show(
            cell,
            deed,
            deed.owner !== null &&
              ownsGroup({ properties: this.shownProperties }, deed.owner, selected),
            x,
            top + imageH * 0.45,
            w,
            deed.owner !== null && state.players[deed.owner]!.jailed,
            // The row in force: houses built, or stations its owner has.
            deed.owner === null || deed.mortgaged
              ? null
              : cell.kind === 'street'
                ? deed.houses
                : cell.kind === 'station'
                  ? this.shownProperties.filter(
                      (property, i) =>
                        BOARD[i]!.kind === 'station' && property.owner === deed.owner,
                    ).length - 1
                  : null,
          );
          this.tileTooltip.hide();
          this.previewTile = null;
          this.drawBoard(ctx);
          this.put(
            this.rentCloseButton,
            'Đóng',
            x + w / 2,
            table.y + table.height - 32,
            150,
            () => this.closeRentTable(),
            48,
            'secondary',
          );
          this.syncBackdrop();
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
      // Off the board: bottom-left of the column, beside the action buttons.
      this.geometry.sideX + 27,
      ctx.screen.height - 24 - 17,
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
    this.diceGlow.setVisible(false);
    if (idle) {
      this.dice.showIdle();
      this.notice.setVisible(false);
    } else if (!presenting) this.dice.hide();
    this.turnAvatar
      .setTexture(this.avatar(players[state.turn]!))
      .setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    this.turnName.setText(turn).setVisible(!this.tradeOpen && this.visualPhase !== 'ready');
    this.fitText(this.turnName, turn, size * 0.13, 15);
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
    // The offer's buttons float with its paper, above the blurred board.
    const lift = this.tradeOpen ? 30 : 0;
    for (const button of this.main) {
      button.box.setDepth(10 + lift);
      button.text.setDepth(11 + lift);
      button.hit.setDepth(12 + lift);
    }
    if (this.tradeOpen) {
      const innerW = size * 0.68;
      const columnW = (innerW - 24) / 2;
      const cx = left + size / 2;
      const columnX = [cx - (columnW + 24) / 2, cx + (columnW + 24) / 2];
      const labels = [
        'Bạn đưa',
        'Bạn nhận',
        `Tiền: ${this.giveCash.toLocaleString('vi-VN')} ₫`,
        `Tiền: ${this.takeCash.toLocaleString('vi-VN')} ₫`,
      ];
      this.tradeLabels.forEach((label, i) => {
        label
          .setVisible(true)
          .setPosition(columnX[i % 2]!, top + imageH * (i < 2 ? 0.295 : 0.45))
          .setFontSize(i < 2 ? 28 : 24);
        this.fitText(label, labels[i]!, columnW, 16);
      });
      actions.forEach(([label, action], i) => {
        const recipient = i === 0;
        const property = i === 1 || i === 2;
        const money = i >= 3 && i <= 6;
        let x = cx;
        let y = top + imageH * 0.215;
        let w = innerW;
        if (property) {
          x = columnX[i - 1]!;
          y = top + imageH * 0.37;
          w = columnW;
        }
        if (money) {
          const column = i < 5 ? 0 : 1;
          const sign = i % 2 === 1 ? -1 : 1;
          w = (columnW - 8) / 2;
          x = columnX[column]! + (sign * (w + 8)) / 2;
          y = top + imageH * 0.525;
        }
        if (i >= 7) {
          x = columnX[i - 7]!;
          y = top + imageH * 0.66;
          w = columnW;
        }
        this.put(this.main[i]!, label, x, y, w, action, 60, i === 7 ? 'primary' : 'secondary');
        if (recipient) this.main[i]!.text.setFontSize(22);
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
      const x = this.geometry.sideX + 12 + cardButtonW / 2;
      const y =
        this.geometry.panelTop +
        34 +
        this.deedContentHeight(selected) +
        (cardStep - 6) / 2 +
        i * cardStep;
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
    // The speed button takes the column's bottom-left corner.
    const buttonW = Math.min(190, sideW - 66);
    const rows = buttons.filter(
      ({ label }) => label !== 'Gieo xúc xắc' && label !== 'Hết lượt',
    ).length;
    const startY = bottom - 31 - (rows - 1) * 70;
    const cardBottom = this.geometry.panelTop + 34 + this.deedPanelHeight(selected);
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
        // Between the two card decks, clear of the bottom row of tiles.
        this.put(
          button,
          label,
          left + size / 2,
          top + imageH * 0.645,
          Math.min(size * 0.22, 220),
          action,
          60 * this.k,
        );
        return;
      }
      const x = turnRight - buttonW / 2;
      this.put(button, label, x, startY + row++ * 70, buttonW, action);
    });
  }
}

/**
 * A capsule on a tile's surface, as (along, depth) points: from `from` to `to` along the tile, its
 * middle at `depth`, `half` deep each way. Its ends are half-circles (a depth unit is about 0.62
 * of an along unit on screen).
 */
function capsule(from: number, to: number, depth: number, half: number): [number, number][] {
  const r = half / 0.62;
  const points: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const angle = -Math.PI / 2 + (i / 12) * Math.PI;
    points.push([to - r + Math.cos(angle) * r, depth + Math.sin(angle) * half]);
  }
  for (let i = 0; i <= 12; i++) {
    const angle = Math.PI / 2 + (i / 12) * Math.PI;
    points.push([from + r + Math.cos(angle) * r, depth + Math.sin(angle) * half]);
  }
  return points;
}

/** Room left for the tile card column right of the board (design units). */
const SIDE = { min: 210, max: 320 };
const MARGIN = 12;
/**
 * The part of the board image that is drawn (fractions of its width and height): the rest is
 * transparent, so it may run off the frame or under the room bar.
 */
const SEEN = { x0: 0.07, x1: 0.93, y0: 0.048, y1: 0.87 };

/**
 * Where the board goes: its drawn part as big as the frame allows, with the tile card column on
 * its right. When the room bar's middle is free (`gap`) and the board fits between its corners,
 * the board rises to the top of the frame; otherwise it sits under the bar. The bigger of the
 * two wins. `left`/`boardTop`/`size` are the whole image's.
 */
export function boardPlace(screen: {
  width: number;
  height: number;
  top: number;
  gap: { left: number; right: number } | null;
}) {
  const { width, height, top, gap } = screen;
  const R = BOARD_IMAGE_RATIO;
  const seenW = SEEN.x1 - SEEN.x0;
  const seenH = (SEEN.y1 - SEEN.y0) / R;
  // Under the bar: the board and its column centered as a group.
  const under = Math.min((height - top - MARGIN) / seenH, (width - 3 * MARGIN - SIDE.min) / seenW);
  let best = { size: under, seenTop: top, minLeft: MARGIN, maxRight: width };
  if (gap) {
    const minLeft = gap.left + 8;
    const tall = Math.min(
      (height - 2 * MARGIN) / seenH,
      (width - MARGIN - SIDE.min - MARGIN - minLeft) / seenW,
      (gap.right - 8 - minLeft) / seenW,
    );
    if (tall > under) best = { size: tall, seenTop: MARGIN, minLeft, maxRight: gap.right - 8 };
  }
  const { size, minLeft, maxRight } = best;
  const w = size * seenW;
  const h = size * seenH;
  // Spare width is shared on both sides of the group, as far as the board may move right.
  const sideW = Math.min(SIDE.max, width - MARGIN - (minLeft + w + MARGIN));
  const spare = width - MARGIN - (minLeft + w + MARGIN + sideW);
  const seenLeft = Math.min(minLeft + Math.max(0, spare / 2), maxRight - w);
  const seenTop = best.seenTop + Math.max(0, (height - MARGIN - best.seenTop - h) / 2);
  const left = seenLeft - size * SEEN.x0;
  return {
    left,
    boardTop: seenTop - (size / R) * SEEN.y0,
    size,
    sideW: Math.max(SIDE.min, Math.min(SIDE.max, width - MARGIN - (seenLeft + w + MARGIN))),
    /** Where the column starts: right of the board's drawn part. */
    sideLeft: seenLeft + w + MARGIN,
  };
}

/**
 * A smooth path through `points` (Catmull-Rom), walked by distance: `at(0…1)` goes at an even
 * speed from the first point to the last; `length` is its length.
 */
function sweep(points: { x: number; y: number }[]) {
  const samples: { x: number; y: number }[] = [];
  const pick = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let segment = 0; segment < points.length - 1; segment++) {
    const [p0, p1, p2, p3] = [
      pick(segment - 1),
      pick(segment),
      pick(segment + 1),
      pick(segment + 2),
    ];
    for (let step = 0; step < 40; step++) {
      const t = step / 40;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      samples.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  samples.push(points[points.length - 1]!);
  const distance = [0];
  for (let i = 1; i < samples.length; i++)
    distance.push(
      distance[i - 1]! +
        Math.hypot(samples[i]!.x - samples[i - 1]!.x, samples[i]!.y - samples[i - 1]!.y),
    );
  const length = distance[distance.length - 1]!;
  return {
    length,
    at(share: number) {
      const target = Math.max(0, Math.min(1, share)) * length;
      let i = 1;
      while (i < distance.length - 1 && distance[i]! < target) i++;
      const span = distance[i]! - distance[i - 1]! || 1;
      const f = (target - distance[i - 1]!) / span;
      const a = samples[i - 1]!;
      const b = samples[i]!;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    },
  };
}
