/**
 * The Tiến Lên table, in the browser: a sedge mat over the whole screen. Your hand fans out along
 * the bottom (tap cards to pick them, then "Đánh"), the others sit on plates at the mat's edges
 * (picture, points, cards left, a stamp when they pass), and every play is slammed onto a messy
 * pile in the middle. The status sits on the pattern's lower edge with your turn clock; "Điểm"
 * opens the full list of players.
 *
 * Each round: the deck is shuffled and dealt in front of everyone, "Vòng 2" and "Lan đi trước"
 * pop up, then play starts. Big words pop up for special plays ("Chặt heo!", "Tứ quý!") and for
 * places ("Về nhất!"). After a round its ranking is shown; after the match, the final standings.
 */
import {
  type Button,
  type FlowContext,
  GameView,
  titleStyle,
  type ViewContext,
  type ViewEvent,
} from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import { beats, type Card, comboOf, isChop, rankOf, TWO } from '../game/cards.js';
import { standings } from '../game/match.js';
import { DEAL, INTRO, type Options, type Play, type View } from '../game/model.js';
import { callout } from './Callout.js';
import { CARD_RATIO, CardSprite } from './Card.js';
import { type CardArt, cardArt, DEFAULT_LOOK } from './deck.js';
import { Mat } from './Mat.js';
import { drawRing, PlayerList, type PlayerRow } from './PlayerList.js';
import { plateTexture, type SeatInfo, SeatPlate, type SeatStamp } from './Seat.js';
import { type StandingRow, Standings } from './Standings.js';

type Ctx = ViewContext<View, Options>;
type Slot = 'bottom' | 'right' | 'top' | 'left';

/** Where each seat sits, counted from you (you are always at the bottom). */
const SLOTS: Record<number, Slot[]> = {
  2: ['bottom', 'top'],
  3: ['bottom', 'right', 'left'],
  4: ['bottom', 'right', 'top', 'left'],
};

/** A card on the pile, placed relative to the middle in card widths (so it survives resizes). */
interface PileCard {
  sprite: CardSprite;
  dx: number;
  dy: number;
  angle: number;
  trick: number;
  /** Its place in the stack at the table's edge once its trick is over (face down). */
  stacked?: number;
}

/** Where finished tricks are swept to: right of the pile, in card widths from the middle. */
const STACK = { dx: 2.4, dy: -0.1 };
/** When the four sweeps of the trick-over sound come (ms): each moves a quarter of the cards. */
const SWEEPS_MS = [20, 160, 300, 440];

/** How long a thrown card flies before it hits the table. */
const THROW_MS = 230;

/** Places in a round, and in the final standings. */
const ROUND_PLACES = ['Nhất', 'Nhì', 'Ba', 'Bét'];
const FINAL_PLACES = ['Nhất', 'Nhì', 'Ba', 'Tư'];
const PLACE_COLORS = ['#ffd84a', '#e3ecf5', '#f0a868', '#ff9d9d'];
/** The last of a round is "Bét" however many play. */
const roundPlace = (place: number, players: number) =>
  place === players - 1 && players > 1 ? 'Bét' : (ROUND_PLACES[place] ?? '');
const placeColor = (place: number, players: number) =>
  PLACE_COLORS[place === players - 1 && players > 1 ? 3 : place] ?? '#ffffff';

/**
 * How a play hits the table: the sound of the slap, how hard the table shakes (0 = not at
 * all), and the words that pop up for special plays. `before` is the play it was put on.
 */
function impactOf(play: Play, before: Play | undefined) {
  const table = before?.trick === play.trick ? comboOf(before.cards) : null;
  const combo = comboOf(play.cards);
  const plain = combo?.kind === 'single' ? 'tien-len-card-play' : 'tien-len-combo';
  if (!combo) return { sound: plain, shake: 0, words: null };
  if (table && isChop(combo, table)) {
    const onTwo = rankOf(table.top) === TWO;
    const words = onTwo ? (table.kind === 'pair' ? 'Chặt đôi heo!' : 'Chặt heo!') : 'Chặt chồng!';
    return { sound: 'tien-len-special-cut', shake: 0.006, words, color: '#ff7a45' };
  }
  if (combo.kind === 'quad') {
    return { sound: 'tien-len-bomb', shake: 0.004, words: 'Tứ quý!', color: '#ffb02e' };
  }
  if (combo.kind === 'pairs') {
    const count = ['', '', '', 'Ba', 'Bốn', 'Năm', 'Sáu'][combo.size / 2] ?? '';
    return { sound: 'tien-len-bomb', shake: 0.004, words: `${count} đôi thông!`, color: '#ffb02e' };
  }
  if (rankOf(combo.top) === TWO) {
    const twos: Record<string, string> = { single: 'Heo!', pair: 'Đôi heo!', triple: 'Ba heo!' };
    return { sound: plain, shake: 0, words: twos[combo.kind] ?? null };
  }
  if (combo.kind === 'straight' && combo.size >= 7) {
    const words = combo.size === 12 ? 'Sảnh rồng!' : 'Sảnh dài!';
    return { sound: 'tien-len-special-hand', shake: 0, words };
  }
  return { sound: plain, shake: 0, words: null };
}

/** The stamp on a seat's plate for "Bỏ lượt", a place or "Rời bàn" (see `tagOf`). */
const stampOf = (tag: { text: string; color: string; kind: 'pass' | 'place' | 'gone' }) =>
  ({
    text: tag.text,
    fill:
      tag.kind === 'pass'
        ? 0xb3261e
        : tag.kind === 'gone'
          ? 0x6b6b6b
          : Number.parseInt(tag.color.slice(1), 16),
    ink: tag.kind === 'place' ? '#4a2a00' : '#fff3d6',
  }) satisfies SeatStamp;

/** A small list icon (three lines) for the "Điểm" button, drawn once. */
function listIcon(scene: Phaser.Scene) {
  const key = 'icon-list';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffd98a, 1);
  for (const y of [14, 42, 70]) {
    g.fillCircle(12, y, 8);
    g.fillRoundedRect(30, y - 6, 66, 12, 6);
  }
  g.generateTexture(key, 100, 84);
  g.destroy();
  return key;
}

/** A repeatable "random" number in [-1, 1] for a pile position, the same on every screen. */
const jitter = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export class TienLenView extends GameView<View, Options> {
  private art!: CardArt;
  private mat!: Mat;
  /** The status on the pattern's lower edge: your picture (with your clock) and the words. */
  private status!: {
    box: Phaser.GameObjects.Container;
    plate: Phaser.GameObjects.NineSlice;
    avatar: Phaser.GameObjects.Image;
    ring: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
  };
  private playButton!: Button;
  private passButton!: Button;
  /** "Điểm": opens the list of players (cards, points, places). */
  private listButton!: Phaser.GameObjects.Container;
  private list!: PlayerList;
  private listPanel!: Phaser.GameObjects.NineSlice;
  private board!: Standings;
  /** Each seat's plate (yours is hidden while you hold a hand). */
  private seats: SeatPlate[] = [];
  private hand = new Map<Card, CardSprite>();
  private selected = new Set<Card>();
  private pile: PileCard[] = [];
  // What the screen has shown so far, to animate only what's new.
  private shownRound = 0;
  private shownPlays = 0;
  private shownTrick = 0;
  private shownOut = 0;
  private shownGone = 0;
  private shownResults = 0;
  /** Seats already warned about with "Còn 1 lá!" this round. */
  private lastCardWarned = new Set<number>();
  private lastTurn = -1;
  /** The deal (and the round's announcement) runs: the hand appears, play waits. */
  private dealing = false;
  /** The turn clock's whole second shown, to redraw the status only when it changes. */
  private shownSecond = -1;

  // ── Create ──────────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    this.shownRound = -1;
    this.hand = new Map();
    this.pile = [];
    this.selected = new Set();
    this.dealing = false;
    this.lastTurn = -1;
    this.art = cardArt(DEFAULT_LOOK, (name) => this.texture(name));
    this.mat = new Mat(this, this.texture('mat'));
    this.makeStatus();
    // Used every turn: no hover sound, it gets distracting.
    const quiet = { image: 'button', hoverSound: false };
    this.passButton = this.button('Bỏ lượt', () => this.send('pass'), quiet);
    this.playButton = this.button('Đánh', () => this.playSelected(), quiet);
    this.makeList();
    this.board = new Standings(this);
    this.makeSeats(ctx);
  }

  private makeStatus() {
    const plate = this.add.nineslice(0, 0, plateTexture(this), undefined, 130, 170, 64, 64, 64, 74);
    const avatar = this.add.image(0, 0, '__DEFAULT');
    const ring = this.add.graphics();
    const text = this.add
      .text(0, 0, '', { ...titleStyle(24), strokeThickness: 0, color: '#fff3d6' })
      .setOrigin(0, 0.5);
    const box = this.add.container(0, 0, [plate, avatar, ring, text]).setDepth(90);
    this.status = { box, plate, avatar, ring, text };
  }

  /** The "Điểm" button and the list of players it opens (tap anywhere to close it). */
  private makeList() {
    const plate = this.add.nineslice(0, 0, plateTexture(this), undefined, 130, 170, 64, 64, 64, 74);
    const icon = this.add.image(0, 0, listIcon(this));
    // A container needs a size before its tap area (`layoutList` resizes both).
    this.listButton = this.add.container(0, 0, [plate, icon]).setDepth(95).setSize(88, 88);
    this.listButton.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.showList(!this.list.visible);
    });
    this.listPanel = this.add
      .nineslice(0, 0, plateTexture(this), undefined, 130, 170, 64, 64, 64, 74)
      .setOrigin(0)
      .setDepth(799);
    this.list = new PlayerList(this);
    this.showList(false);
    this.input.on('pointerdown', (_: unknown, over: Phaser.GameObjects.GameObject[]) => {
      if (this.list.visible && !over.includes(this.listButton)) this.showList(false);
    });
  }

  private showList(shown: boolean) {
    this.list.setVisible(shown);
    this.listPanel.setVisible(shown);
  }

  private makeSeats(ctx: Ctx) {
    for (const seat of this.seats) seat.destroy();
    this.seats = ctx.players.map(() => new SeatPlate(this, this.art.back).setDepth(80));
  }

  // ── Layout ──────────────────────────────────────────────────────────────────────────────

  /**
   * Sizes and places on the frame (docs/ui-guide.md). The mat covers the whole screen. Your hand
   * runs along the bottom and a little off it, "Bỏ lượt" / "Đánh" stacked in the bottom-right
   * corner with "Điểm" above them. The side seats sit on narrow plates against the edges, the
   * seat across on a flat plate in the free middle of the room bar's row (or, when it doesn't
   * fit there, under the bar). The pattern frames the play area between them, down to just over
   * your hand, and the pile sits in it.
   */
  private geometry(ctx: Ctx) {
    const { width, height, top, hud, gap } = ctx.screen;
    const margin = 16;
    const buttonW = 150 * hud;
    const buttonH = 60 * hud;
    const handLeft = margin;
    const handRight = width - buttonW - 2 * margin;
    const handSpan = handRight - handLeft;
    const handWidth = Math.min(150, handSpan / (1 + 12 * 0.42));
    const handH = handWidth * CARD_RATIO;
    // The hand runs a little off the bottom edge: its ranks and suits stay in sight.
    const handY = height - handH * 0.32;
    const lift = 30 * hud;

    const slots = new Set(ctx.players.map((_, seat) => this.slotOf(ctx, seat)));
    const side = { w: 104 * hud, h: 128 * hud };
    const flat = { w: 250 * hud, h: 64 * hud };
    const across = slots.has('top');
    const statusH = 52 * hud;
    // The same side margins without side seats: clear of "Điểm" and the buttons' column.
    const inset = margin + side.w + 14;
    const cx = width / 2;
    // The seat across: in the room bar's row when the plate fits there (in the middle if it
    // can), else under the bar, where the pattern's top edge runs through it.
    const room = 16;
    const free = gap ? gap.right - gap.left - 2 * room : 0;
    const fitsRow = gap !== null && free >= 200 * hud;
    // Narrower in a tight row (the name is cut), never wider than it needs.
    if (fitsRow) flat.w = Math.min(flat.w, free);
    const acrossX = fitsRow
      ? Math.min(Math.max(cx, gap.left + room + flat.w / 2), gap.right - room - flat.w / 2)
      : cx;
    const acrossY = fitsRow
      ? Math.max((gap.top + gap.bottom) / 2, gap.top + flat.h / 2)
      : top + flat.h / 2;
    const frame = {
      left: inset,
      right: width - inset,
      top: across && !fitsRow ? acrossY : top + 8,
      bottom: handY - handH / 2 - lift - statusH / 2 - 4,
    };
    // The pile keeps clear of the top plate.
    const pileTop = Math.max(frame.top + 16, across ? acrossY + flat.h / 2 + 8 : 0);
    const cy = (pileTop + frame.bottom) / 2;
    const pileWidth = Math.min(handWidth, (frame.bottom - pileTop) / 2.1);
    const b = { w: buttonW, h: buttonH, x: width - margin - buttonW / 2, y: height - margin };
    const listSize = 64 * hud;
    return {
      width,
      height,
      top,
      hud,
      margin,
      cx,
      cy,
      frame,
      handWidth,
      handSpan,
      handX: (handLeft + handRight) / 2,
      handY,
      lift,
      statusH,
      side,
      flat,
      button: b,
      list: {
        size: listSize,
        x: width - margin - listSize / 2,
        y: b.y - 2 * b.h - 12 - 14 * hud - listSize / 2,
      },
      pileWidth,
      /** The finished tricks' stack, right of the pile but inside the pattern. */
      stackDx: Math.min(STACK.dx, (frame.right - cx) / pileWidth - 1),
      slots: {
        bottom: { x: (handLeft + handRight) / 2, y: handY },
        top: { x: acrossX, y: acrossY },
        left: { x: margin + side.w / 2, y: top + side.h / 2 },
        right: { x: width - margin - side.w / 2, y: top + side.h / 2 },
      } satisfies Record<Slot, { x: number; y: number }>,
    };
  }

  /** The seat you look through: yours, or seat 0 for a spectator. */
  private mySeat(ctx: Ctx) {
    return ctx.me?.seat ?? 0;
  }

  private slotOf(ctx: Ctx, seat: number): Slot {
    const n = ctx.players.length;
    return SLOTS[n]?.[(seat - this.mySeat(ctx) + n) % n] ?? 'top';
  }

  /** Where a seat's words pop up: just inside the pattern by their plate, or above your hand. */
  private seatSpot(ctx: Ctx, seat: number) {
    const g = this.geometry(ctx);
    const slot = this.slotOf(ctx, seat);
    const { x, y } = g.slots[slot];
    if (slot === 'bottom') return { x, y: g.frame.bottom - 50 * g.hud };
    if (slot === 'top') return { x, y: y + g.flat.h / 2 + 40 * g.hud };
    const inside = 130 * g.hud;
    return {
      x: slot === 'left' ? g.frame.left + inside : g.frame.right - inside,
      y: y + 20 * g.hud,
    };
  }

  protected onLayout(ctx: Ctx) {
    const g = this.geometry(ctx);
    const { left, top, right, bottom } = this.bleed;
    this.mat.layout({
      area: { x: left, y: top, width: right - left, height: bottom - top },
      frame: g.frame,
    });
    const b = g.button;
    this.playButton.setSize(b.w, b.h).setPosition(b.x, b.y - b.h / 2);
    this.passButton.setSize(b.w, b.h).setPosition(b.x, b.y - b.h * 1.5 - 12);
    this.layoutList(g);
    this.board.layout({
      cx: g.cx,
      top: g.top,
      // Over the table; the app's result panel sits at the bottom right once the match is over.
      bottom: g.frame.bottom,
      width: g.width - 24,
      hud: g.hud,
    });
    this.placeSeats(ctx);
    this.showStatus(ctx);
    for (const p of this.pile) this.placePileCard(p, g);
    this.placeHand(ctx, false);
  }

  private layoutList(g: ReturnType<TienLenView['geometry']>) {
    const { size, x, y } = g.list;
    const [plate, icon] = this.listButton.list as [
      Phaser.GameObjects.NineSlice,
      Phaser.GameObjects.Image,
    ];
    const corner = (20 * g.hud) / 60;
    plate.setSize(size / corner, size / corner).setScale(corner);
    icon.setDisplaySize(size * 0.5, size * 0.42).setPosition(0, -2 * g.hud);
    this.listButton.setPosition(x, y).setSize(size, size);
    (this.listButton.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, size, size);
    // Rows are 54 tall (PlayerList); the panel opens left of the right column, under the room bar.
    const rows = this.ctx?.players.length ?? 4;
    const w = 300 * g.hud;
    const h = rows * 54 * g.hud + 24 * g.hud;
    const px = g.width - g.margin - w;
    this.listPanel
      .setSize(w / corner, h / corner)
      .setScale(corner)
      .setPosition(px, g.top);
    this.list.layout(px + 14 * g.hud, g.top + 12 * g.hud, g.hud, w - 28 * g.hud);
  }

  private placeSeats(ctx: Ctx) {
    const g = this.geometry(ctx);
    ctx.players.forEach((_, seat) => {
      const plate = this.seats[seat];
      if (!plate) return;
      const slot = this.slotOf(ctx, seat);
      // Your own hand has the bottom; a spectator sees seat 0 there like the others.
      plate.setVisible(slot !== 'bottom' || !ctx.me);
      const side = slot === 'left' || slot === 'right';
      plate.layout(side ? 'side' : 'flat', g.hud, g.flat.w);
      const { x, y } = g.slots[slot];
      plate.setPosition(x, slot === 'bottom' ? g.frame.bottom + g.flat.h : y);
    });
  }

  // ── Your hand ───────────────────────────────────────────────────────────────────────────

  /** Makes the hand match `cards`: new cards appear, played ones go. */
  private syncHand(ctx: Ctx) {
    const cards = ctx.state.hand;
    for (const [card, sprite] of this.hand) {
      if (!cards.includes(card)) {
        sprite.destroy();
        this.hand.delete(card);
        this.selected.delete(card);
      }
    }
    for (const card of cards) {
      if (this.hand.has(card)) continue;
      const sprite = new CardSprite(this, this.art, card);
      sprite.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(card));
      this.hand.set(card, sprite);
    }
    this.placeHand(ctx, false);
  }

  /** Fans the hand out along the bottom; picked cards stand up a little. */
  private placeHand(ctx: Ctx, animate: boolean) {
    const g = this.geometry(ctx);
    const cards = [...this.hand.keys()].sort((a, b) => a - b);
    const step = Math.min(
      g.handWidth * 0.7,
      (g.handSpan - g.handWidth) / Math.max(1, cards.length - 1),
    );
    const start = g.handX - (step * (cards.length - 1)) / 2;
    cards.forEach((card, i) => {
      const sprite = this.hand.get(card) as CardSprite;
      sprite.setCardWidth(g.handWidth).setDepth(100 + i);
      const x = start + i * step;
      const y = g.handY - (this.selected.has(card) ? g.lift : 0);
      if (animate) this.runtime.tween({ targets: sprite, x, y, duration: 90 });
      else sprite.setPosition(x, y);
    });
  }

  private toggle(card: Card) {
    const ctx = this.ctx;
    if (this.dealing || ctx.result || ctx.state.phase !== 'play') return;
    if (this.selected.has(card)) this.selected.delete(card);
    else this.selected.add(card);
    this.sfx('tien-len-card-select');
    this.placeHand(ctx, true);
    this.updateButtons(ctx);
  }

  private playSelected() {
    const cards = [...this.selected];
    if (cards.length) this.send('play', { cards });
  }

  private isMyTurn(ctx: Ctx) {
    const { state, me, result } = ctx;
    return Boolean(me && !result && state.phase === 'play' && state.turn === me.seat);
  }

  /** "Đánh" lights up when the picked cards could go on the table now. */
  private canPlay(ctx: Ctx) {
    const { state } = ctx;
    if (!this.isMyTurn(ctx) || this.selected.size === 0) return false;
    const combo = comboOf([...this.selected]);
    const table = state.table && comboOf(state.table.cards);
    const mustPlay = state.mustPlay === null || this.selected.has(state.mustPlay);
    return Boolean(combo && beats(combo, table) && mustPlay);
  }

  private updateButtons(ctx: Ctx) {
    const { state, me } = ctx;
    const myTurn = this.isMyTurn(ctx) && !this.dealing;
    const holding = Boolean(me && state.hand.length > 0 && state.phase !== 'over');
    for (const b of [this.playButton, this.passButton]) b.container.setVisible(holding);
    this.playButton.setEnabled(myTurn && this.canPlay(ctx));
    this.passButton.setEnabled(myTurn && state.table !== null);
  }

  // ── The pile ────────────────────────────────────────────────────────────────────────────

  /** Where the cards of play number `index` land: a jumble around the middle. */
  private pileSpot(play: Play, index: number) {
    const angle = jitter(index * 7 + 1) * 28;
    const cx = jitter(index * 7 + 2) * 0.9;
    const cy = jitter(index * 7 + 3) * 0.45;
    const rad = (angle * Math.PI) / 180;
    return play.cards.map((_, i) => {
      const along = (i - (play.cards.length - 1) / 2) * 0.34;
      return {
        dx: cx + along * Math.cos(rad),
        dy: cy + along * Math.sin(rad),
        angle: angle + jitter(index * 7 + 4 + i) * 4,
      };
    });
  }

  private placePileCard(p: PileCard, g: ReturnType<TienLenView['geometry']>) {
    const { x, y, angle } = this.spotOf(p, g);
    p.sprite.setCardWidth(g.pileWidth).setPosition(x, y).setAngle(angle);
  }

  /** Where a pile card lies: in the jumble, or in the stack of finished tricks. */
  private spotOf(p: PileCard, g: ReturnType<TienLenView['geometry']>) {
    if (p.stacked === undefined) {
      return { x: g.cx + p.dx * g.pileWidth, y: g.cy + p.dy * g.pileWidth, angle: p.angle };
    }
    return {
      x: g.cx + g.stackDx * g.pileWidth,
      y: g.cy + STACK.dy * g.pileWidth - p.stacked * 0.6,
      angle: jitter(p.stacked + 11) * 5,
    };
  }

  /**
   * Puts a play on the pile. `thrown`: it flies in from `from`, and `onLand` runs when the first
   * card hits the table (without it the cards just lie there, e.g. when joining late).
   */
  private addToPile(
    ctx: Ctx,
    play: Play,
    index: number,
    thrown?: { from: { x: number; y: number }; onLand: () => void },
  ) {
    const g = this.geometry(ctx);
    this.pileSpot(play, index).forEach((spot, i) => {
      const card = play.cards[i] as Card;
      const sprite = new CardSprite(this, this.art, card).setDepth(10 + this.pile.length);
      const p: PileCard = { sprite, ...spot, trick: play.trick };
      this.pile.push(p);
      this.placePileCard(p, g);
      if (!thrown) return;
      // Slam: it flies in big and fast, lands, and bounces a little.
      const { x, y, angle } = sprite;
      sprite
        .setPosition(thrown.from.x, thrown.from.y)
        .setAngle(angle - 40 + i * 10)
        .setScale(1.35);
      this.runtime.tween({
        targets: sprite,
        x,
        y,
        angle,
        scale: 1,
        duration: THROW_MS,
        delay: i * 35,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.runtime.tween({ targets: sprite, scale: 1.06, duration: 60, yoyo: true });
          if (i === 0) thrown.onLand();
        },
      });
    });
  }

  private clearPile() {
    for (const p of this.pile) p.sprite.destroy();
    this.pile = [];
  }

  private rebuildPile(ctx: Ctx) {
    this.clearPile();
    ctx.state.played.forEach((play, i) => {
      this.addToPile(ctx, play, i);
    });
    this.shownPlays = ctx.state.played.length;
    this.sweep(ctx, false);
  }

  /**
   * A trick is over: its cards are swept into the face-down stack at the table's edge, a quarter
   * at each sweep of the sound (or straight there, without `animate`). Returns how many moved.
   */
  private sweep(ctx: Ctx, animate: boolean) {
    const g = this.geometry(ctx);
    const done = this.pile.filter((p) => p.trick < ctx.state.trick && p.stacked === undefined);
    let stacked = this.pile.filter((p) => p.stacked !== undefined).length;
    done.forEach((p, i) => {
      p.stacked = stacked++;
      p.sprite.setDepth(5 + p.stacked);
      if (!animate) {
        p.sprite.setCard(null);
        this.placePileCard(p, g);
        return;
      }
      const at = SWEEPS_MS[Math.floor((i * SWEEPS_MS.length) / done.length)] ?? 0;
      this.runtime.tween({
        targets: p.sprite,
        ...this.spotOf(p, g),
        delay: at,
        duration: 180,
        ease: 'Quad.easeOut',
        onStart: () => p.sprite.flipTo(null, 160),
      });
    });
    return done.length;
  }

  // ── A round: deal, announce ─────────────────────────────────────────────────────────────

  /** A new match: forget the last one. Its first round starts in `onState`. */
  protected onStart(_ctx: Ctx) {
    this.shownRound = 0;
    this.board.hide();
  }

  /** A round begins on screen: clear the table, and deal it out if the deal is on now. */
  protected onResync(ctx: Ctx) {
    this.runtime.newRound('snapshot');
    this.shownRound = -1;
    this.startRound(ctx, false);
    this.rebuildPile(ctx);
    this.shownTrick = ctx.state.trick;
    this.lastCardWarned = new Set(
      ctx.state.counts.flatMap((count, seat) => (count === 1 ? [seat] : [])),
    );
    this.lastTurn = this.isMyTurn(ctx) ? ctx.state.turn : -1;
    if (ctx.result) this.showStandings(ctx, false);
    else if (ctx.state.phase === 'over') this.showRoundResult(ctx, false);
  }

  private startRound(ctx: Ctx, animate = true) {
    this.runtime.newRound('game-round');
    const { state } = ctx;
    this.shownRound = state.round;
    this.clearPile();
    for (const sprite of this.hand.values()) sprite.destroy();
    this.hand.clear();
    this.selected.clear();
    this.shownPlays = 0;
    this.shownTrick = 0;
    this.shownOut = state.out.length;
    this.shownGone = state.gone.length;
    this.shownResults = state.results.length;
    this.lastCardWarned.clear();
    this.lastTurn = -1;
    this.dealing = false;
    if (!ctx.result) this.board.hide();
    if (state.phase === 'deal' && animate) this.deal(ctx);
  }

  private deal(ctx: Ctx) {
    const g = this.geometry(ctx);
    const round = ctx.state.round;
    const n = ctx.players.length;
    // One card at a time to each seat in the round, starting with the seat after you.
    const order = Array.from({ length: n }, (_, i) => (this.mySeat(ctx) + 1 + i) % n).filter(
      (seat) => ctx.state.inRound[seat],
    );
    const deck = Array.from({ length: 13 * order.length }, (_, i) =>
      new CardSprite(this, this.art, null)
        .setCardWidth(g.pileWidth)
        .setPosition(g.cx - i * 0.15, g.cy - i * 0.3)
        .setDepth(200 + i),
    );
    this.dealing = true;
    this.updateButtons(ctx);
    this.runtime.run(
      async (fx) => {
        fx.defer(() => {
          for (const card of deck) card.destroy();
        });
        await fx.parallel(
          ...[0, 1].map((side) => async (child: FlowContext) => {
            await child.tween({
              targets: deck.filter((_, i) => i % 2 === side),
              x: `${side ? '+' : '-'}=${g.pileWidth * 0.7}`,
              angle: side ? 8 : -8,
              duration: 120,
              yoyo: true,
              repeat: 2,
              ease: 'Sine.easeInOut',
            });
          }),
        );
        fx.checkpoint();
        this.sfx('tien-len-deal');
        await fx.parallel(
          ...deck.map((sprite, i) => async (child: FlowContext) => {
            await child.wait(i * DEAL.stepMs);
            const seat = order[i % order.length] as number;
            const target = g.slots[this.slotOf(ctx, seat)];
            await child.tween({
              targets: sprite,
              x: target.x + jitter(i) * 10,
              y: target.y,
              angle: jitter(i + 3) * 30,
              scale: 0.8,
              duration: DEAL.flyMs - 20,
              ease: 'Quad.easeOut',
            });
            child.checkpoint();
            sprite.destroy();
          }),
        );
        fx.checkpoint();
        this.syncHand(this.ctx);
        await fx.parallel(
          ...[...this.hand.values()].map((sprite) => async (child: FlowContext) => {
            const card = sprite.card;
            sprite.setCard(null);
            await sprite.flip(child, card, DEAL.flipMs);
          }),
        );
        fx.checkpoint();
        this.showPlayers(this.ctx);
        await this.announce(fx);
      },
      { lane: 'deal', policy: 'replace', onFailure: () => this.onResync(this.ctx) },
    );
  }

  /** "Vòng 2", then who leads; then the round is on. */
  private async announce(fx: FlowContext) {
    const g = this.geometry(this.ctx);
    const hold = (ms: number) => Math.max(200, ms - 700);
    callout(this, `Vòng ${this.ctx.state.round}`, g.cx, g.cy, {
      size: 76,
      hold: hold(INTRO.roundMs),
    });
    await fx.wait(INTRO.roundMs);
    fx.checkpoint();
    const { state, me, players } = this.ctx;
    const words =
      state.lead === me?.seat ? 'Bạn đi trước' : `${players[state.lead]?.name ?? ''} đi trước`;
    callout(this, words, g.cx, g.cy, { size: 40, color: '#ffffff', hold: hold(INTRO.leadMs) });
    await fx.wait(INTRO.leadMs);
    fx.checkpoint();
    this.dealing = false;
    this.onState(this.ctx);
  }

  // ── Events ──────────────────────────────────────────────────────────────────────────────

  /** Someone put cards on the table: they fly onto the pile, and slap it when they land. */
  protected onPlay(ctx: Ctx, event: ViewEvent<{ cards: Card[] }>) {
    const { played } = ctx.state;
    const play = played.at(-1);
    // A play during the deal (a slow screen) lies on the pile when the deal ends, no slap.
    if (this.dealing || !play || played.length !== this.shownPlays + 1) return;
    const g = this.geometry(ctx);
    const from = event.isMe ? { x: g.handX, y: g.handY } : g.slots[this.slotOf(ctx, play.seat)];
    this.sfx('tien-len-throw');
    this.addToPile(ctx, play, played.length - 1, {
      from,
      onLand: () => this.land(ctx, play, played.at(-2)),
    });
    this.shownPlays = played.length;
  }

  /** The thrown cards hit the table: the slap, a shake for bombs, words for special plays. */
  private land(ctx: Ctx, play: Play, before: Play | undefined) {
    const { sound, shake, words, color } = impactOf(play, before);
    this.sfx(sound);
    if (shake) this.cameras.main.shake(140, shake);
    const g = this.geometry(ctx);
    if (words) callout(this, words, g.cx, g.cy - g.pileWidth * 1.2, { size: 50, color });
  }

  protected onPass(_ctx: Ctx, _event: ViewEvent) {
    if (!this.dealing) this.sfx('tien-len-pass');
  }

  // ── Showing the state ───────────────────────────────────────────────────────────────────

  /** After any change: the round, the pile, places, the players, whose turn, the buttons. */
  protected onState(ctx: Ctx) {
    const { state } = ctx;
    if (this.seats.length !== ctx.players.length) {
      this.makeSeats(ctx);
      this.onLayout(ctx);
    }
    if (state.round !== this.shownRound) this.startRound(ctx);
    if (!this.dealing) {
      if (state.played.length !== this.shownPlays) this.rebuildPile(ctx);
      if (state.trick !== this.shownTrick) {
        if (state.trick > this.shownTrick && this.sweep(ctx, true)) {
          this.sfx('tien-len-trick-clear');
        }
        this.shownTrick = state.trick;
      }
      this.syncHand(ctx);
      this.announcePlaces(ctx);
    }
    this.announceLeavers(ctx);
    this.showBoard(ctx);
    this.showPlayers(ctx);
    this.showStatus(ctx);
    const myTurn = this.isMyTurn(ctx) && !this.dealing;
    if (myTurn && this.lastTurn !== state.turn) this.sfx('tien-len-turn');
    this.lastTurn = myTurn ? state.turn : -1;
    this.updateButtons(ctx);
  }

  /** "Về nhất!" for whoever just emptied their hand, "Còn 1 lá!" for a last card. */
  private announcePlaces(ctx: Ctx) {
    const { state } = ctx;
    // Who was still holding cards when the round ended didn't go out: `showBoard` places them.
    const holder = state.phase === 'over' ? state.results.at(-1)?.holder : undefined;
    while (this.shownOut < state.out.length) {
      const place = this.shownOut++;
      const seat = state.out[place] as number;
      if (seat === holder) continue;
      const { x, y } = this.seatSpot(ctx, seat);
      const words = ['Về nhất!', 'Về nhì!', 'Về ba!'][place] ?? 'Hết bài!';
      callout(this, words, x, y, { size: 38, color: PLACE_COLORS[place] });
      if (place === 0 && seat === ctx.me?.seat) this.sfx('tien-len-win');
    }
    state.counts.forEach((count, seat) => {
      if (count !== 1 || this.lastCardWarned.has(seat) || state.phase !== 'play') return;
      this.lastCardWarned.add(seat);
      this.sfx('tien-len-last-card');
      const { x, y } = this.seatSpot(ctx, seat);
      callout(this, 'Còn 1 lá!', x, y, { size: 30, color: '#ff9d4a' });
    });
  }

  /** "Lan bỏ cuộc" when someone leaves the table. */
  private announceLeavers(ctx: Ctx) {
    const { state } = ctx;
    const g = this.geometry(ctx);
    while (this.shownGone < state.gone.length) {
      const seat = state.gone[this.shownGone++] as number;
      const name = ctx.players[seat]?.name ?? '';
      callout(this, `${name} bỏ cuộc`, g.cx, g.cy + g.pileWidth, { size: 34, color: '#ff9d9d' });
    }
  }

  /**
   * A round just ended: where the one still holding cards placed ("Thối heo!" when last with 2s
   * in hand, or first when everyone else left), then its ranking (or the final standings).
   */
  private showBoard(ctx: Ctx) {
    const { state } = ctx;
    if (state.phase !== 'over' || this.shownResults >= state.results.length) return;
    this.shownResults = state.results.length;
    const result = state.results.at(-1);
    if (result && result.holder !== null) {
      const place = result.order.indexOf(result.holder);
      const count = result.order.length;
      const twos = result.leftover.some((c) => rankOf(c) === TWO);
      const words =
        place === count - 1
          ? twos
            ? 'Thối heo!'
            : 'Về bét!'
          : (['Về nhất!', 'Về nhì!', 'Về ba!'][place] ?? '');
      const { x, y } = this.seatSpot(ctx, result.holder);
      callout(this, words, x, y, { size: 38, color: placeColor(place, count) });
    }
    // Let the last slap and the words land first.
    this.runtime.after(1100, () => {
      if (this.ctx.result) this.showStandings(this.ctx, true);
      else this.showRoundResult(this.ctx);
    });
  }

  private showRoundResult(ctx: Ctx, animate = true) {
    const { state } = ctx;
    const result = state.results.at(-1);
    if (!result || state.phase !== 'over') return;
    const count = result.order.length;
    const rows = result.order.map(
      (seat, place): StandingRow => ({
        place: roundPlace(place, count),
        placeColor: placeColor(place, count),
        avatar: this.avatar(ctx.players[seat] ?? {}),
        name: ctx.players[seat]?.name ?? '',
        score: `+${result.points[seat] ?? 0}`,
        note: state.gone.includes(seat) ? 'Rời bàn' : `Tổng ${state.points[seat] ?? 0} điểm`,
        me: seat === ctx.me?.seat,
      }),
    );
    this.board.show(`Hết vòng ${state.round}`, rows, animate);
    this.showStatus(ctx);
  }

  /** The match's final standings, with its jingle for everyone. */
  private showStandings(ctx: Ctx, animate: boolean) {
    const { state } = ctx;
    const rows = standings(state).map(
      (seat, place): StandingRow => ({
        place: FINAL_PLACES[place] ?? '',
        placeColor: PLACE_COLORS[place] ?? '#ffffff',
        avatar: this.avatar(ctx.players[seat] ?? {}),
        name: ctx.players[seat]?.name ?? '',
        score: `${state.points[seat] ?? 0} điểm`,
        note: state.gone.includes(seat)
          ? 'Rời bàn'
          : `Nhất ${state.firsts[seat] ?? 0}/${state.results.length} vòng`,
        me: seat === ctx.me?.seat,
      }),
    );
    this.board.setFooter('');
    this.board.show('Tổng kết', rows, animate);
    this.showStatus(ctx);
    this.onLayout(ctx);
    if (animate) this.sfx('tien-len-standings');
  }

  /** The match is over: after its last round (see `showBoard`), or too few players are left. */
  protected onEnd(ctx: Ctx) {
    if (this.shownResults < ctx.state.results.length) return;
    this.runtime.after(900, () => {
      if (this.ctx.result) this.showStandings(this.ctx, true);
    });
  }

  /** Each seat's plate, and the list of players behind "Điểm". */
  private showPlayers(ctx: Ctx) {
    const { state, players, result } = ctx;
    const n = players.length;
    const turn = !result && state.phase === 'play' && !this.dealing ? state.turn : -1;
    const tagOf = (seat: number) => {
      if (state.gone.includes(seat)) {
        return { text: 'Rời bàn', color: '#c9c9c9', kind: 'gone' as const };
      }
      const place = state.out.indexOf(seat);
      if (place >= 0) {
        const text =
          state.phase === 'over' ? roundPlace(place, state.out.length) : ROUND_PLACES[place];
        return {
          text: text ?? '',
          color: PLACE_COLORS[place] ?? '#ffffff',
          kind: 'place' as const,
        };
      }
      if (state.passed[seat] && state.table && state.phase === 'play') {
        return { text: 'Bỏ lượt', color: '#ffd0d0', kind: 'pass' as const };
      }
      return null;
    };
    const order = Array.from({ length: n }, (_, i) => (this.mySeat(ctx) + i) % n);
    const rows = order.map((seat): PlayerRow => {
      const player = players[seat];
      const tag = tagOf(seat);
      const cards = state.counts[seat] ?? 0;
      const points = `${state.points[seat] ?? 0} điểm`;
      return {
        name: seat === ctx.me?.seat ? `${player?.name ?? ''} (bạn)` : (player?.name ?? ''),
        avatar: this.avatar(player ?? {}),
        info: cards > 0 && !this.dealing ? `${cards} lá · ${points}` : points,
        badge: tag?.text ?? null,
        badgeColor: tag?.color,
        turn: seat === turn,
        dim: state.gone.includes(seat),
      };
    });
    this.list.set(rows);
    players.forEach((player, seat) => {
      const tag = tagOf(seat);
      const info: SeatInfo = {
        name: player.name,
        avatar: this.avatar(player),
        points: `${state.points[seat] ?? 0} điểm`,
        cards: this.dealing ? 0 : (state.counts[seat] ?? 0),
        turn: seat === turn,
        dim: tag?.kind === 'pass' || tag?.kind === 'place',
        gone: tag?.kind === 'gone',
        stamp: tag ? stampOf(tag) : null,
      };
      this.seats[seat]?.show(info);
    });
    this.drawRings(ctx);
  }

  /** The words on the pattern's lower edge, beside your picture (the plate fits the words). */
  private showStatus(ctx: Ctx) {
    const { state, players, result, me } = ctx;
    let text = '';
    let color = '#fff3d6';
    if (result) text = 'Hết ván đấu!';
    else if (state.phase === 'over') text = `Hết vòng ${state.round}`;
    else if (state.phase === 'play' && !this.dealing) {
      const seconds = this.secondsLeft(ctx);
      const clock = seconds === null ? '' : ` · ${seconds}`;
      text = this.isMyTurn(ctx)
        ? `Tới lượt bạn!${clock}`
        : `Lượt của ${players[state.turn]?.name ?? ''}${clock}`;
      if (seconds !== null && seconds <= 5) color = '#ff9d8a';
    }
    const g = this.geometry(ctx);
    const hud = g.hud;
    const { box, plate, avatar, ring, text: words } = this.status;
    const h = g.statusH;
    const a = h - 8 * hud;
    const pad = 12 * hud;
    const pictured = Boolean(me);
    const maxText = g.frame.right - g.frame.left - a - 4 * pad;
    words.setColor(color).setFontSize(24 * hud);
    this.fitText(words, text, maxText, 14);
    const w = (pictured ? 4 * hud + a + 8 * hud : pad) + words.width + pad + 4 * hud;
    const corner = (20 * hud) / 60;
    plate.setSize(w / corner, (h + 10 * corner) / corner).setScale(corner);
    plate.setPosition(0, 5 * corner);
    const left = -w / 2;
    avatar.setVisible(pictured).setPosition(left + 4 * hud + a / 2, 0);
    if (me) avatar.setTexture(this.avatar(players[me.seat] ?? {})).setDisplaySize(a, a);
    words.setPosition(pictured ? left + 12 * hud + a : left + pad, -1 * hud);
    ring.setData('at', { x: left + 4 * hud + a / 2, y: 0, r: a / 2 + 1 * hud });
    // The ranking board covers the table: no status under it.
    box.setPosition(g.cx, g.frame.bottom).setVisible(Boolean(text) && !this.board.visible);
    this.drawRings(ctx);
  }

  // ── The turn clock ──────────────────────────────────────────────────────────────────────

  /** How much of the turn clock is left (1 → 0), or `null` when there is none. */
  private clockLeft(ctx: Ctx) {
    const t = ctx.timer;
    if (!t || t.event !== 'turn-over' || this.dealing) return null;
    return Math.max(0, Math.min(1, (t.endsAt - Date.now()) / t.ms));
  }

  private secondsLeft(ctx: Ctx) {
    const t = ctx.timer;
    if (!t || t.event !== 'turn-over') return null;
    return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  }

  /** The ring around the turn player's picture: on their plate, in the list, or in the status. */
  private drawRings(ctx: Ctx) {
    const left = this.clockLeft(ctx);
    for (const seat of this.seats) seat.drawClock(left);
    this.list.drawRing(left);
    const { ring } = this.status;
    ring.clear();
    const at = ring.getData('at') as { x: number; y: number; r: number } | undefined;
    if (at && this.isMyTurn(ctx) && !this.dealing) drawRing(ring, at.x, at.y, at.r, left);
  }

  protected onUpdate(ctx: Ctx) {
    const t = ctx.timer;
    if (t?.event === 'turn-over') {
      this.drawRings(ctx);
      const seconds = this.secondsLeft(ctx) ?? -1;
      if (seconds !== this.shownSecond) {
        this.shownSecond = seconds;
        this.showStatus(ctx);
      }
    }
    if (t?.event === 'next-round' && this.board.visible && !ctx.result) {
      const seconds = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      this.board.setFooter(`Vòng ${ctx.state.round + 1} bắt đầu sau ${seconds} giây`);
    }
  }
}
