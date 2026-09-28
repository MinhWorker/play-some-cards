/**
 * The Tiến Lên table, in the browser. Your hand fans out at the bottom (tap cards to pick them,
 * then "Đánh"), the others sit around the table, and every play is slammed onto a messy pile in
 * the middle. The players are listed top-left with the turn clock.
 *
 * Each round: the deck is shuffled and dealt in front of everyone, "Vòng 2" and "Lan đi trước"
 * pop up, then play starts. Big words pop up for special plays ("Chặt heo!", "Tứ quý!") and for
 * places ("Về nhất!"). After a round its ranking is shown; after the match, the final standings.
 */
import { type Button, GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { beats, type Card, comboOf, isChop, rankOf, SUITS, type Suit, TWO } from '../game/cards.js';
import { standings } from '../game/match.js';
import { DEAL, INTRO, type Options, type Play, type View } from '../game/model.js';
import { callout } from './Callout.js';
import { CARD_RATIO, CardSprite, type CardTextures } from './Card.js';
import { drawRing, PlayerList, type PlayerRow } from './PlayerList.js';
import { type StandingRow, Standings } from './Standings.js';

type Ctx = ViewContext<View, Options>;
type Slot = 'bottom' | 'right' | 'top' | 'left';

/** Where each seat sits, counted from you (you are always at the bottom). */
const SLOTS: Record<number, Slot[]> = {
  2: ['bottom', 'top'],
  3: ['bottom', 'right', 'left'],
  4: ['bottom', 'right', 'top', 'left'],
};

/** Someone at the table: their picture, a few card backs, how many cards they hold. */
interface Opponent {
  avatar: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  /** Where the ring goes (around the picture). */
  ringAt: { x: number; y: number; r: number };
  backs: CardSprite[];
  count: Phaser.GameObjects.Text;
  /** "Bỏ lượt", their place, "Rời bàn". */
  tag: Phaser.GameObjects.Text;
}

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

/** Where finished tricks are swept to: the table's right edge, in card widths from the middle. */
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

/** How wide the players list in the top-left corner may get. */
const listWidth = (width: number, hud: number) => Math.min(230 * hud, width * 0.42);
/** How far in from each end of `table.webp` its round ends reach, in its pixels (3-slice). */
const TABLE_END = 300;

/** A repeatable "random" number in [-1, 1] for a pile position, the same on every screen. */
const jitter = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

export class TienLenView extends GameView<View, Options> {
  private cardTextures!: CardTextures;
  private table!: Phaser.GameObjects.NineSlice;
  private status!: Phaser.GameObjects.Text;
  private playButton!: Button;
  private passButton!: Button;
  private list!: PlayerList;
  private board!: Standings;
  private opponents: Opponent[] = [];
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
    this.cardTextures = {
      front: this.texture('card-front'),
      back: this.texture('card-back'),
      suits: Object.fromEntries(SUITS.map((s) => [s, this.texture(`suit-${s}`)])) as Record<
        Suit,
        string
      >,
    };
    // Only the straight middle of the table stretches: it spans wide frames, ends stay round.
    const tex = this.textures.getFrame(this.texture('table'));
    this.table = this.add.nineslice(
      0,
      0,
      this.texture('table'),
      undefined,
      tex.width,
      tex.height,
      TABLE_END,
      TABLE_END,
    );
    this.status = this.label('', { size: 30 });
    // Used every turn: no hover sound, it gets distracting.
    const quiet = { image: 'button', hoverSound: false };
    this.passButton = this.button('Bỏ lượt', () => this.send('pass'), quiet);
    this.playButton = this.button('Đánh', () => this.playSelected(), quiet);
    this.list = new PlayerList(this);
    this.board = new Standings(this);
    this.makeOpponents(ctx);
  }

  private makeOpponents(ctx: Ctx) {
    for (const o of this.opponents) {
      for (const obj of [o.avatar, o.ring, ...o.backs, o.count, o.tag]) obj.destroy();
    }
    this.opponents = ctx.players.map((player) => ({
      avatar: this.add.image(0, 0, this.avatar(player)).setDepth(40),
      ring: this.add.graphics().setDepth(41),
      ringAt: { x: 0, y: 0, r: 0 },
      backs: [0, 1, 2].map(() => new CardSprite(this, this.cardTextures, null)),
      count: this.label('', { size: 26 }).setDepth(42),
      tag: this.label('', { size: 22 }).setDepth(42),
    }));
  }

  // ── Layout ──────────────────────────────────────────────────────────────────────────────

  /**
   * Sizes and places on the frame (docs/ui-guide.md). The players list on the left, the table
   * filling the rest (from under the room bar down behind the top of your hand), and "Bỏ lượt" /
   * "Đánh" stacked in the bottom-right corner. Your hand runs along the bottom, under the list up
   * to the buttons; the others sit at the table's top and round ends.
   */
  private geometry({ screen }: Ctx) {
    const { width, height, top, hud } = screen;
    const margin = 16;
    const listRight = 10 * hud + listWidth(width, hud) + margin;
    const buttonW = 150 * hud;
    const buttonH = 60 * hud;
    const handLeft = margin;
    const handRight = width - buttonW - 2 * margin;
    const handSpan = handRight - handLeft;
    const handWidth = Math.min(140, handSpan / (1 + 12 * 0.42));
    const handH = handWidth * CARD_RATIO;
    const handY = height - handH / 2 - 10;
    const tableLeft = listRight;
    const tableRight = width - margin;
    const tableTop = top;
    const tableH = Math.max(200, handY - handH * 0.2 - tableTop);
    const tableW = Math.max(tableH * 1.2, tableRight - tableLeft);
    const cx = (tableLeft + tableRight) / 2;
    const cy = tableTop + tableH / 2;
    const end = tableH * 0.3;
    return {
      width,
      height,
      top,
      hud,
      cx,
      cy,
      handWidth,
      handSpan,
      handX: (handLeft + handRight) / 2,
      handY,
      statusY: handY - handH / 2 - 26 * hud,
      button: { w: buttonW, h: buttonH, x: width - margin - buttonW / 2, y: height - margin },
      pileWidth: Math.min(96, handWidth * 0.7),
      tableW,
      tableH,
      slots: {
        bottom: { x: (handLeft + handRight) / 2, y: handY },
        top: { x: cx, y: tableTop + tableH * 0.16 },
        left: { x: cx - tableW / 2 + end, y: cy },
        right: { x: cx + tableW / 2 - end, y: cy },
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

  /** Where a seat's words pop up: near their cards, or above your hand. */
  private seatSpot(ctx: Ctx, seat: number) {
    const g = this.geometry(ctx);
    const slot = this.slotOf(ctx, seat);
    const { x, y } = g.slots[slot];
    if (slot === 'bottom') return { x, y: g.statusY - 60 * g.hud };
    if (slot === 'top') return { x, y: y + 80 * g.hud };
    return { x: slot === 'left' ? x + 60 * g.hud : x - 60 * g.hud, y: y + 70 * g.hud };
  }

  protected onLayout(ctx: Ctx) {
    const g = this.geometry(ctx);
    const scale = g.tableH / this.table.height;
    this.table
      .setSize(g.tableW / scale, this.table.height)
      .setScale(scale)
      .setPosition(g.cx, g.cy);
    this.status.setFontSize(28 * g.hud).setPosition(g.handX, g.statusY);
    const b = g.button;
    this.playButton.setSize(b.w, b.h).setPosition(b.x, b.y - b.h / 2);
    this.passButton.setSize(b.w, b.h).setPosition(b.x, b.y - b.h * 1.5 - 12);
    this.list.layout(10 * g.hud, g.top, g.hud, listWidth(g.width, g.hud));
    this.board.layout({
      cx: g.cx,
      top: g.top,
      // Over the table; the app's result panel sits at the bottom right once the match is over.
      bottom: g.statusY - 20 * g.hud,
      width: g.width - 24,
      hud: g.hud,
    });
    this.placeOpponents(ctx);
    for (const p of this.pile) this.placePileCard(p, g);
    this.placeHand(ctx, false);
  }

  private placeOpponents(ctx: Ctx) {
    const g = this.geometry(ctx);
    const small = g.handWidth * 0.55;
    const size = 38 * g.hud;
    ctx.players.forEach((player, seat) => {
      const o = this.opponents[seat];
      if (!o) return;
      const slot = this.slotOf(ctx, seat);
      // Your own hand has the bottom; a spectator sees seat 0 there like the others.
      const shown = slot !== 'bottom' || !ctx.me;
      const { x, y } = g.slots[slot];
      const cardsY = slot === 'bottom' ? y - small : y;
      // The picture sits beside the cards at the top, above them on the sides.
      const ax = slot === 'top' ? x + small * 1.5 : x;
      const ay = slot === 'top' ? cardsY : cardsY - small * CARD_RATIO * 0.5 - size * 0.6;
      o.avatar
        .setTexture(this.avatar(player))
        .setDisplaySize(size, size)
        .setPosition(ax, ay)
        .setVisible(shown);
      o.ringAt = { x: ax, y: ay, r: size / 2 + 2 * g.hud };
      o.ring.setVisible(shown);
      o.backs.forEach((back, i) => {
        back
          .setCardWidth(small)
          .setPosition(x + (i - 1) * small * 0.28, cardsY)
          .setAngle((i - 1) * 8);
      });
      o.count.setFontSize(26 * g.hud).setPosition(x, cardsY);
      const below = cardsY + small * CARD_RATIO * 0.5 + 14 * g.hud;
      o.tag.setFontSize(20 * g.hud).setPosition(x, below);
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
      const sprite = new CardSprite(this, this.cardTextures, card);
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
      g.handWidth * 0.62,
      (g.handSpan - g.handWidth) / Math.max(1, cards.length - 1),
    );
    const start = g.handX - (step * (cards.length - 1)) / 2;
    cards.forEach((card, i) => {
      const sprite = this.hand.get(card) as CardSprite;
      sprite.setCardWidth(g.handWidth).setDepth(100 + i);
      const x = start + i * step;
      const y = g.handY - (this.selected.has(card) ? 22 * g.hud : 0);
      if (animate) this.tweens.add({ targets: sprite, x, y, duration: 90 });
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
      x: g.cx + STACK.dx * g.pileWidth,
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
      const sprite = new CardSprite(this, this.cardTextures, card).setDepth(10 + this.pile.length);
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
      this.tweens.add({
        targets: sprite,
        x,
        y,
        angle,
        scale: 1,
        duration: THROW_MS,
        delay: i * 35,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.tweens.add({ targets: sprite, scale: 1.06, duration: 60, yoyo: true });
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
      this.tweens.add({
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
  private startRound(ctx: Ctx) {
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
    if (state.phase === 'deal') this.deal(ctx);
  }

  private deal(ctx: Ctx) {
    const g = this.geometry(ctx);
    const round = ctx.state.round;
    // A newer round (or match) started meanwhile: this deal's callbacks do nothing.
    const current = () => this.shownRound === round && this.ctx.state.round === round;
    const n = ctx.players.length;
    // One card at a time to each seat in the round, starting with the seat after you.
    const order = Array.from({ length: n }, (_, i) => (this.mySeat(ctx) + 1 + i) % n).filter(
      (seat) => ctx.state.inRound[seat],
    );
    const deck = Array.from({ length: 13 * order.length }, (_, i) =>
      new CardSprite(this, this.cardTextures, null)
        .setCardWidth(g.pileWidth)
        .setPosition(g.cx - i * 0.15, g.cy - i * 0.3)
        .setDepth(200 + i),
    );
    this.dealing = true;
    this.updateButtons(ctx);
    // Shuffle: the deck splits in two halves that slide apart and back together, three times.
    const halves = [deck.filter((_, i) => i % 2 === 0), deck.filter((_, i) => i % 2 === 1)];
    halves.forEach((half, side) => {
      this.tweens.add({
        targets: half,
        x: `${side ? '+' : '-'}=${g.pileWidth * 0.7}`,
        angle: side ? 8 : -8,
        duration: 120,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    });
    const dealAt = DEAL.shuffleMs;
    // A run of card flicks about as long as dealing a full table.
    this.time.delayedCall(dealAt, () => this.sfx('tien-len-deal'));
    deck.forEach((sprite, i) => {
      const seat = order[i % order.length] as number;
      const target = g.slots[this.slotOf(ctx, seat)];
      this.tweens.add({
        targets: sprite,
        x: target.x + jitter(i) * 10,
        y: target.y,
        angle: jitter(i + 3) * 30,
        scale: 0.8,
        delay: dealAt + i * DEAL.stepMs,
        duration: DEAL.flyMs - 20,
        ease: 'Quad.easeOut',
        onComplete: () => sprite.destroy(),
      });
    });
    this.time.delayedCall(dealAt + deck.length * DEAL.stepMs + DEAL.flyMs, () => {
      if (!current()) return;
      this.syncHand(this.ctx);
      for (const sprite of this.hand.values()) {
        const card = sprite.card;
        sprite.setCard(null).flipTo(card, DEAL.flipMs);
      }
      this.showPlayers(this.ctx);
      this.time.delayedCall(DEAL.flipMs, () => this.announce(current));
    });
  }

  /** "Vòng 2", then who leads; then the round is on. */
  private announce(current: () => boolean) {
    if (!current()) return;
    const g = this.geometry(this.ctx);
    // Each line springs in and floats away (~0.7 s) within its part of the announcement.
    const hold = (ms: number) => Math.max(200, ms - 700);
    callout(this, `Vòng ${this.ctx.state.round}`, g.cx, g.cy, {
      size: 76,
      hold: hold(INTRO.roundMs),
    });
    this.time.delayedCall(INTRO.roundMs, () => {
      if (!current()) return;
      const { state, me, players } = this.ctx;
      const words =
        state.lead === me?.seat ? 'Bạn đi trước' : `${players[state.lead]?.name ?? ''} đi trước`;
      callout(this, words, g.cx, g.cy, { size: 40, color: '#ffffff', hold: hold(INTRO.leadMs) });
      this.time.delayedCall(INTRO.leadMs, () => {
        if (!current()) return;
        this.dealing = false;
        this.onState(this.ctx);
      });
    });
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
    if (this.opponents.length !== ctx.players.length) {
      this.makeOpponents(ctx);
      this.placeOpponents(ctx);
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
    this.time.delayedCall(1100, () => {
      if (this.ctx.result) this.showStandings(this.ctx, true);
      else this.showRoundResult(this.ctx);
    });
  }

  private showRoundResult(ctx: Ctx) {
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
    this.board.show(`Hết vòng ${state.round}`, rows, true);
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
    this.time.delayedCall(900, () => {
      if (this.ctx.result) this.showStandings(this.ctx, true);
    });
  }

  /** The players list, and each seat's cards and tag. */
  private showPlayers(ctx: Ctx) {
    const { state, players, result } = ctx;
    const n = players.length;
    const turn = !result && state.phase === 'play' && !this.dealing ? state.turn : -1;
    const tagOf = (seat: number): { text: string; color: string } | null => {
      if (state.gone.includes(seat)) return { text: 'Rời bàn', color: '#c9c9c9' };
      const place = state.out.indexOf(seat);
      if (place >= 0) {
        const text =
          state.phase === 'over' ? roundPlace(place, state.out.length) : ROUND_PLACES[place];
        return { text: text ?? '', color: PLACE_COLORS[place] ?? '#ffffff' };
      }
      if (state.passed[seat] && state.table && state.phase === 'play') {
        return { text: 'Bỏ lượt', color: '#ffd0d0' };
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
    players.forEach((_, seat) => {
      const o = this.opponents[seat];
      if (!o) return;
      const cards = state.counts[seat] ?? 0;
      const shown = o.avatar.visible;
      const holding = shown && cards > 0 && !this.dealing;
      for (const back of o.backs) back.setVisible(holding);
      o.count.setText(String(cards)).setVisible(holding);
      o.avatar.setAlpha(state.gone.includes(seat) ? 0.4 : 1);
      const tag = tagOf(seat);
      o.tag
        .setText(tag?.text ?? '')
        .setColor(tag?.color ?? '#ffffff')
        .setVisible(shown && Boolean(tag));
    });
    this.drawRings(ctx);
  }

  private showStatus(ctx: Ctx) {
    const { state, players, result } = ctx;
    let text = '';
    let color = '#ffffff';
    if (result) text = 'Hết ván đấu!';
    else if (state.phase === 'over') text = `Hết vòng ${state.round}`;
    else if (state.phase === 'play' && !this.dealing) {
      const seconds = this.secondsLeft(ctx);
      const clock = seconds === null ? '' : ` · ${seconds}`;
      text = this.isMyTurn(ctx)
        ? `Tới lượt bạn!${clock}`
        : `Lượt của ${players[state.turn]?.name ?? ''}${clock}`;
      if (seconds !== null && seconds <= 5) color = '#ff7a6b';
    }
    // The ranking board covers the table: no status under it.
    this.status
      .setColor(color)
      .setFontSize(28 * ctx.screen.hud)
      .setVisible(!this.board.visible);
    this.fitText(this.status, text, ctx.screen.width - 24, 14);
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

  /** The ring around the turn player's picture, at their seat and in the list. */
  private drawRings(ctx: Ctx) {
    const left = this.clockLeft(ctx);
    const turn = !ctx.result && ctx.state.phase === 'play' && !this.dealing ? ctx.state.turn : -1;
    this.opponents.forEach((o, seat) => {
      o.ring.clear();
      if (seat === turn && o.ring.visible)
        drawRing(o.ring, o.ringAt.x, o.ringAt.y, o.ringAt.r, left);
    });
    this.list.drawRing(left);
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
