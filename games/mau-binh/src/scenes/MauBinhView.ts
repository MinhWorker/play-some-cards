/**
 * The Mậu Binh table, in the browser. Your 13 cards lie in three rows at the bottom: chi 3 on
 * top, chi 1 nearest you. Tap two cards (or drag one onto another) to swap them; "Tự xếp"
 * arranges them for you, "Hoàn tác" undoes, "Xong" hands the rows in. The others sit around
 * the table with their cards face down. The players are listed top-left.
 *
 * Each round: the deck is shuffled and dealt, "Vòng 2" and "Xếp bài!" pop up, and the clock
 * (an hourglass) runs. When everyone is done, "Lật bài!": tới trắng first, then chi 1, 2 and 3
 * are turned over one after another with who won each, sập 3 chi, everyone's points, and the
 * round's scores. After the match, the final standings.
 */
import { type Button, GameView, type ViewContext } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { bestRows } from '../game/arrange.js';
import { type Card, foulOf, handName, type Rows, rankOf, SUITS, type Suit } from '../game/cards.js';
import { standings, winners } from '../game/match.js';
import {
  DEAL,
  INTRO_MS,
  type Options,
  REVEAL,
  type RoundResult,
  type View,
} from '../game/model.js';
import { sideOf, specialInfo } from '../game/scoring.js';
import { ARENA_STEP, Arena } from './Arena.js';
import { callout } from './Callout.js';
import { CARD_RATIO, CardSprite, type CardTextures } from './Card.js';
import { PlayerList, type PlayerRow } from './PlayerList.js';
import { type ResultEntry, ResultsPanel } from './ResultsPanel.js';
import { RulesPanel } from './RulesPanel.js';
import { type StandingRow, Standings } from './Standings.js';

type Ctx = ViewContext<View, Options>;
type Slot = 'bottom' | 'right' | 'top' | 'left';

/** Where each seat sits, counted from you (you are always at the bottom). */
const SLOTS: Record<number, Slot[]> = {
  2: ['bottom', 'top'],
  3: ['bottom', 'right', 'left'],
  4: ['bottom', 'right', 'top', 'left'],
};

/** Positions 0–12 in a player's rows: chi 1 = 0–4, chi 2 = 5–9, chi 3 = 10–12. */
const ROW_OF = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2];
const ROW_START = [0, 5, 10];
const ROW_LENGTH = [5, 5, 3];

const PLACES = ['Nhất', 'Nhì', 'Ba', 'Tư'];
const PLACE_COLORS = ['#ffd84a', '#e3ecf5', '#f0a868', '#c9d6e3'];
const WIN = '#7dff9a';
const LOSE = '#ff8a7a';

/** "+3", "−2", "0". */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const colorOf = (n: number) => (n > 0 ? WIN : n < 0 ? LOSE : '#ffffff');
/** The outline of a chi that won (green), lost (red) or tied (none). */
const markOf = (n: number) => (n > 0 ? 0x43d17a : n < 0 ? 0xff5a4f : null);

/** A repeatable "random" number in [-1, 1], the same on every screen. */
const jitter = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** A player's place at the table: 13 cards in rows, their picture, name and labels. */
interface Block {
  /** By position (see ROW_OF). Your own are face up and can be moved. */
  cards: CardSprite[];
  /** Each chi's hand and points, over (or beside) the row. */
  labels: Phaser.GameObjects.Text[];
  avatar: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  /** "Đang xếp…", "Xong", "Binh lủng", "Sảnh rồng", "Rời bàn". */
  tag: Phaser.GameObjects.Text;
  /** The round's points, once shown. */
  total: Phaser.GameObjects.Text;
  /** Where the tag goes: beside the name while arranging, under the cards once shown. */
  tagAt: { head: { x: number; y: number }; below: { x: number; y: number } };
}

/** A row of the players list, before the HUD scale (PlayerList.ts). */
const LIST_ROW = 54;
/** The table's size against its art's pixels: its red rim comes out thin (docs/ui-guide.md). */
const TABLE_SCALE = 0.4;

export class MauBinhView extends GameView<View, Options> {
  private cardTextures!: CardTextures;
  private table!: Phaser.GameObjects.NineSlice;
  private status!: Phaser.GameObjects.Text;
  private hourglass!: Phaser.GameObjects.Sprite;
  private autoButton!: Button;
  private undoButton!: Button;
  private doneButton!: Button;
  private cancelButton!: Button;
  private rulesButton!: Button;
  private resultsButton!: Button;
  private list!: PlayerList;
  private board!: Standings;
  private rules!: RulesPanel;
  private arena!: Arena;
  private results!: ResultsPanel;
  private blocks: Block[] = [];
  // What the screen has shown so far, to animate only what's new.
  private shownRound = 0;
  private shownPhase: View['phase'] | null = null;
  private shownResults = 0;
  private shownGone = 0;
  /** The deal runs: the cards fly out, arranging waits. */
  private dealing = false;
  /** This round's rows are being turned over (or have been). */
  private revealing = false;
  /** Your picked card, waiting for a second one to swap with. */
  private picked: CardSprite | null = null;
  /** Your earlier arrangements (cards by position), for "Hoàn tác". */
  private undo: Card[][] = [];
  /** A drag just ended: the tap that ends it is not a pick. */
  private dragged = false;
  /** "Xong" on binh lủng asks once; a second tap within a few seconds hands it in. */
  private foulWarnedAt = -Infinity;
  /** This round's points have popped up (until then the list shows the points before it). */
  private totalsShown = true;
  /** Rows handed in automatically as time ran out (once per round). */
  private autoSent = false;
  private shownSecond = -1;
  /** Whose eyes the cards were laid out for (your seat, -1 for a spectator). */
  private shownSeat = -1;

  // ── Create ──────────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    this.cardTextures = {
      front: this.texture('card-front'),
      back: this.texture('card-back'),
      suits: Object.fromEntries(SUITS.map((s) => [s, this.texture(`suit-${s}`)])) as Record<
        Suit,
        string
      >,
      flip: [this.texture('flip-back'), this.texture('flip-edge'), this.texture('flip-front')],
    };
    const frames = (name: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ key: this.texture(`${name}-${i + 1}`) }));
    if (!this.anims.exists('mau-binh-sand')) {
      this.anims.create({
        key: 'mau-binh-sand',
        frames: frames('hourglass', 3),
        frameRate: 6,
        repeat: -1,
      });
      this.anims.create({ key: 'mau-binh-burst', frames: frames('burst', 4), frameRate: 8 });
    }
    const tableArt = this.textures.getFrame(this.texture('table'));
    const inset = tableArt.width * 0.09;
    this.table = this.add
      .nineslice(0, 0, this.texture('table'), undefined, 400, 300, inset, inset, inset, inset)
      .setDepth(-10);
    this.status = this.label('', { size: 26 }).setDepth(700);
    this.hourglass = this.add.sprite(0, 0, this.texture('hourglass-1')).setDepth(700);
    this.hourglass.play('mau-binh-sand');
    const quiet = { image: 'button', hoverSound: false };
    this.autoButton = this.button('Tự xếp', () => this.autoArrange(), quiet);
    this.undoButton = this.button('Hoàn tác', () => this.undoLast(), quiet);
    this.doneButton = this.button('Xong', () => this.submit(), {
      ...quiet,
      sound: 'mau-binh-submit',
    });
    this.cancelButton = this.button('Xếp lại', () => this.send('cancel'), quiet);
    this.rulesButton = this.button('Luật', () => this.toggleRules(), quiet);
    for (const b of [this.autoButton, this.undoButton, this.doneButton, this.cancelButton]) {
      b.container.setDepth(700);
    }
    this.rulesButton.container.setDepth(970);
    // Above its own overlay, so it closes it.
    this.resultsButton = this.button('Kết quả', () => this.toggleResults(), quiet);
    this.resultsButton.container.setDepth(995);
    this.list = new PlayerList(this);
    this.board = new Standings(this);
    this.rules = new RulesPanel(this, () => this.toggleRules());
    this.arena = new Arena(this);
    this.results = new ResultsPanel(this, this.cardTextures, (text, onTap) =>
      this.button(text, onTap, { image: 'button', size: 20, hoverSound: false }),
    );
    this.input.dragDistanceThreshold = 10;
    this.makeBlocks(ctx);
  }

  private makeBlocks(ctx: Ctx) {
    for (const b of this.blocks) {
      for (const obj of [...b.cards, ...b.labels, b.avatar, b.name, b.tag, b.total]) obj.destroy();
    }
    const small = (size: number) => this.label('', { size }).setDepth(600);
    this.blocks = ctx.players.map((player) => ({
      cards: [],
      labels: [0, 1, 2].map(() =>
        small(15)
          .setOrigin(1, 0.5)
          .setPadding(4, 1, 4, 1)
          // A dark pill keeps it readable over the cards.
          .setBackgroundColor('rgba(20, 10, 5, 0.72)'),
      ),
      avatar: this.add.image(0, 0, this.avatar(player)).setDepth(590),
      name: small(16).setOrigin(0, 0.5),
      tag: small(16),
      total: small(34).setDepth(650),
      tagAt: { head: { x: 0, y: 0 }, below: { x: 0, y: 0 } },
    }));
  }

  // ── Layout ──────────────────────────────────────────────────────────────────────────────

  /**
   * Sizes and places on the frame (docs/ui-guide.md): your three rows big at the bottom (under
   * half the height), the buttons stacked in the bottom-right corner, the others' smaller blocks
   * around the top and sides, the players list in the top-left corner.
   */
  private geometry({ screen, players }: Ctx) {
    const { width, height, top, hud } = screen;
    const labelW = 92 * hud;
    const margin = 16;
    const button = { w: 150 * hud, h: 56 * hud };
    // Your cards: five across (overlapping), three rows, beside the row labels, clear of the
    // button column.
    const big = Math.min(
      110,
      (width / 2 - button.w - 2 * margin - labelW / 2) / ((1 + 4 * 0.78) / 2),
      ((height - top) * 0.46) / (CARD_RATIO * (1 + 2 * 0.66)),
    );
    const bigRowStep = big * CARD_RATIO * 0.66;
    const handH = big * CARD_RATIO + 2 * bigRowStep;
    const handBottom = height - 14 * hud;
    const handCy = handBottom - handH / 2;
    // Just above your cards: your tag once the rows are shown, and the status line above it.
    const tagY = handBottom - handH - 24 * hud;
    const statusY = tagY - 40 * hud;
    // The others: smaller cards, packed tighter.
    // Wide screens seat the others beside the players list (top row); tall ones below it.
    const head = 28 * hud;
    // The others' seats, each a column of free table (name above the block):
    // top: under the room bar, above the status line;
    // left: under the players list, beside your cards;
    // right: under the "Luật" and "Kết quả" buttons, above the button stack.
    const listRight = 10 * hud + Math.min(230 * hud, width * 0.42);
    const listBottom = top + players.length * LIST_ROW * hud;
    const stackTop = height - margin - 3 * button.h - 20;
    const rooms = {
      top: statusY - 20 * hud - (top + head),
      left: height - margin - (listBottom + head + 12),
      right: stackTop - 16 - (top + 94 * hud + head),
    };
    // Smaller cards, packed tighter: as big as the tightest seat allows.
    const fit = Math.min(rooms.top, rooms.left, rooms.right) / (CARD_RATIO * (1 + 2 * 0.55));
    const small = Math.max(24, Math.min(44 * hud, big * 0.62, fit));
    const smallRowStep = small * CARD_RATIO * 0.55;
    const blockW = small * (1 + 4 * 0.52);
    const blockH = small * CARD_RATIO + 2 * smallRowStep;
    const topY = top + head + blockH / 2 + 6 * hud;
    const topX = Math.max(width / 2, listRight + blockW / 2 + 12 * hud);
    const leftX = margin + 10 + blockW / 2;
    const leftY = listBottom + 12 + head + rooms.left / 2;
    const rightX = width - margin - Math.max(blockW, button.w) / 2;
    const rightY = top + 94 * hud + head + rooms.right / 2;
    // The "bàn đấu" where chi are compared: above your cards, beside the list.
    const arenaX = listRight + 8 * hud;
    const arenaY = top + 4 * hud;
    const arena = {
      x: arenaX,
      y: arenaY,
      w: width - 12 * hud - arenaX,
      h: handBottom - handH - 8 * hud - arenaY,
    };
    return {
      width,
      height,
      top,
      hud,
      cx: width / 2,
      /** The middle of the table, between the top seats and the status line. */
      midY: (topY + blockH / 2 + statusY) / 2,
      labelW,
      arena,
      tagY,
      statusY,
      button: { ...button, x: width - margin - button.w / 2, bottom: height - margin },
      blockW,
      blockH,
      head,
      sizes: { big, small, bigRowStep, smallRowStep },
      centers: {
        bottom: { x: width / 2 - labelW / 2, y: handCy },
        top: { x: topX, y: topY },
        left: { x: leftX, y: leftY },
        right: { x: rightX, y: rightY },
      } satisfies Record<Slot, { x: number; y: number }>,
    };
  }
  private g() {
    return this.geometry(this.ctx);
  }

  /** The seat you look through: yours, or seat 0 for a spectator. */
  private mySeat(ctx: Ctx) {
    return ctx.me?.seat ?? 0;
  }

  private slotOf(ctx: Ctx, seat: number): Slot {
    const n = ctx.players.length;
    return SLOTS[n]?.[(seat - this.mySeat(ctx) + n) % n] ?? 'top';
  }

  /** Where card position `pos` of `seat` lies, and how wide the card is. */
  private cardSpot(ctx: Ctx, seat: number, pos: number) {
    const g = this.geometry(ctx);
    const slot = this.slotOf(ctx, seat);
    const bottom = slot === 'bottom';
    const w = bottom ? g.sizes.big : g.sizes.small;
    const step = w * (bottom ? 0.78 : 0.52);
    const rowStep = bottom ? g.sizes.bigRowStep : g.sizes.smallRowStep;
    const row = ROW_OF[pos] as number;
    const i = pos - (ROW_START[row] as number);
    const n = ROW_LENGTH[row] as number;
    const c = g.centers[slot];
    // Chi 1 is the lowest row, chi 3 the highest.
    const lift = bottom && this.picked === this.blocks[seat]?.cards[pos] ? 14 * g.hud : 0;
    return {
      x: c.x + (i - (n - 1) / 2) * step,
      y: c.y + (1 - row) * rowStep - lift,
      w,
      // Lower rows cover the rows above them.
      depth: (bottom ? 200 : 100) + (3 - row) * 10 + i,
    };
  }

  protected onLayout(ctx: Ctx) {
    const g = this.geometry(ctx);
    const inset = 8;
    // Drawn at TABLE_SCALE of the art's pixels: a thin rim, the felt filling the frame.
    this.table
      .setPosition(g.cx, (g.top + g.height) / 2)
      .setSize((g.width - 2 * inset) / TABLE_SCALE, (g.height - g.top - inset) / TABLE_SCALE)
      .setScale(TABLE_SCALE);
    this.status.setFontSize(26 * g.hud);
    // Stacked in the bottom-right corner, "Xong" (or "Xếp lại") at the bottom.
    const b = g.button;
    const slotY = (i: number) => b.bottom - b.h / 2 - i * (b.h + 10);
    [this.doneButton, this.undoButton, this.autoButton].forEach((button, i) => {
      button.setSize(b.w, b.h).setPosition(b.x, slotY(i));
    });
    this.cancelButton.setSize(b.w, b.h).setPosition(b.x, slotY(0));
    this.rulesButton
      .setSize(84 * g.hud, 40 * g.hud)
      .setPosition(g.width - 56 * g.hud, g.top + 26 * g.hud);
    this.resultsButton
      .setSize(84 * g.hud, 40 * g.hud)
      .setPosition(g.width - 56 * g.hud, g.top + 72 * g.hud);
    this.results.layout({ width: g.width, height: g.height, top: g.top, hud: g.hud });
    this.list.layout(10 * g.hud, g.top, g.hud, Math.min(230 * g.hud, g.width * 0.42));
    const area = { cx: g.cx, top: g.top, width: g.width - 24, hud: g.hud };
    this.board.layout({ ...area, bottom: g.tagY });
    this.rules.layout({ ...area, top: g.top + 50 * g.hud, bottom: g.height - 12 });
    this.placeBlocks(ctx, false);
    this.showStatus(ctx);
  }

  /** Puts every seat's cards, picture and labels in place. */
  private placeBlocks(ctx: Ctx, animate: boolean) {
    const g = this.geometry(ctx);
    ctx.players.forEach((_, seat) => {
      const b = this.blocks[seat];
      if (!b) return;
      b.cards.forEach((sprite, pos) => {
        const { x, y, w, depth } = this.cardSpot(ctx, seat, pos);
        sprite.setCardWidth(w).setDepth(depth);
        if (animate)
          this.tweens.add({ targets: sprite, x, y, duration: 140, ease: 'Quad.easeOut' });
        else sprite.setPosition(x, y);
      });
      const slot = this.slotOf(ctx, seat);
      const c = g.centers[slot];
      const bottom = slot === 'bottom';
      const w = bottom ? g.sizes.big : g.sizes.small;
      const halfW = bottom ? (w * (1 + 4 * 0.78)) / 2 : g.blockW / 2;
      const halfH = bottom ? g.sizes.big * CARD_RATIO * 0.5 + g.sizes.bigRowStep : g.blockH / 2;
      b.labels.forEach((label, row) => {
        const y = c.y + (1 - row) * (bottom ? g.sizes.bigRowStep : g.sizes.smallRowStep);
        // Yours beside the rows; the others' over the right end of their rows.
        if (bottom) {
          label
            .setOrigin(0, 0.5)
            .setFontSize(17 * g.hud)
            .setPosition(c.x + halfW + 8 * g.hud, y);
        } else {
          label
            .setOrigin(1, 0.5)
            .setFontSize(13 * g.hud)
            .setPosition(c.x + halfW, y - w * 0.35);
        }
      });
      const size = 26 * g.hud;
      const headY = c.y - halfH - g.head / 2;
      const shown = !bottom;
      b.avatar
        .setDisplaySize(size, size)
        .setPosition(c.x - halfW + size / 2, headY)
        .setVisible(shown);
      b.name.setFontSize(15 * g.hud).setPosition(c.x - halfW + size + 4 * g.hud, headY);
      this.fitText(b.name, ctx.players[seat]?.name ?? '', halfW * 2 - size - 4 * g.hud);
      b.name.setVisible(shown);
      b.tagAt = {
        head: { x: c.x + halfW, y: headY },
        below: { x: c.x, y: bottom ? g.tagY : c.y + halfH + 12 * g.hud },
      };
      b.tag.setFontSize(16 * g.hud);
      this.placeTag(ctx, seat);
      b.total.setFontSize(34 * g.hud).setPosition(c.x, c.y);
    });
  }

  private placeTag(ctx: Ctx, seat: number) {
    const b = this.blocks[seat];
    if (!b) return;
    const shown = ctx.state.phase === 'show';
    const at = shown ? b.tagAt.below : b.tagAt.head;
    b.tag.setOrigin(shown ? 0.5 : 1, 0.5).setPosition(at.x, at.y);
  }

  // ── A round: deal ───────────────────────────────────────────────────────────────────────

  /** A new match: forget the last one. Its first round starts in `onState`. */
  protected onStart(ctx: Ctx) {
    this.shownRound = 0;
    this.board.hide();
    if (this.results.visible) this.results.show(this.resultEntries(ctx));
  }

  /** A round begins on screen: fresh cards, dealt out if the deal is on now. */
  private startRound(ctx: Ctx) {
    const { state } = ctx;
    this.shownRound = state.round;
    this.shownPhase = state.phase;
    this.shownResults = state.results.length - (state.phase === 'show' ? 1 : 0);
    this.shownGone = state.gone.length;
    this.revealing = false;
    this.dealing = false;
    this.picked = null;
    this.undo = [];
    this.autoSent = false;
    this.foulWarnedAt = -Infinity;
    if (!ctx.result) this.board.hide();
    this.makeCards(ctx);
    if (state.phase === 'deal') this.deal(ctx);
  }

  /** Every seat in the round gets 13 cards: yours face up in your rows, the others face down. */
  private makeCards(ctx: Ctx) {
    const me = this.mySeat(ctx);
    this.shownSeat = ctx.me?.seat ?? -1;
    this.blocks.forEach((b, seat) => {
      for (const c of b.cards) c.destroy();
      for (const l of b.labels) l.setText('').setVisible(false);
      b.total.setText('');
      b.cards = [];
      if (!ctx.state.inRound[seat]) return;
      const order = seat === me && ctx.me ? this.startingOrder(ctx) : Array(13).fill(null);
      b.cards = order.map((card: Card | null) => {
        const sprite = new CardSprite(this, this.cardTextures, card);
        if (seat === me && ctx.me) this.makeMovable(sprite);
        return sprite;
      });
    });
    this.placeBlocks(ctx, false);
    this.updateMyLabels(ctx);
  }

  /** Your cards as they start: the rows you handed in, or strongest first. */
  private startingOrder(ctx: Ctx): Card[] {
    if (ctx.state.mine) return ctx.state.mine.flat();
    return [...ctx.state.hand].sort((a, b) => rankOf(b) - rankOf(a) || b - a);
  }

  private deal(ctx: Ctx) {
    const g = this.geometry(ctx);
    const round = ctx.state.round;
    const current = () => this.shownRound === round && this.ctx.state.round === round;
    const n = ctx.players.length;
    // One card at a time to each seat in the round, starting with the seat after you.
    const order = Array.from({ length: n }, (_, i) => (this.mySeat(ctx) + 1 + i) % n).filter(
      (seat) => ctx.state.inRound[seat],
    );
    for (const b of this.blocks) for (const c of b.cards) c.setVisible(false);
    // Your cards arrive face down and turn over once everyone has theirs.
    const mine = this.myBlock(ctx);
    const faces = mine?.cards.map((c) => c.card) ?? [];
    for (const c of mine?.cards ?? []) c.setCard(null);
    const deckW = g.sizes.small * 1.2;
    // The flying deck is plain card backs (lighter than whole cards).
    const deck = Array.from({ length: 13 * order.length }, (_, i) =>
      this.add
        .image(g.cx - i * 0.15, g.midY - i * 0.3, this.cardTextures.back)
        .setDisplaySize(deckW, deckW * CARD_RATIO)
        .setDepth(400 + i),
    );
    this.dealing = true;
    this.updateButtons(ctx);
    // Shuffle: the deck splits in two halves that slide apart and back together, three times.
    [deck.filter((_, i) => i % 2 === 0), deck.filter((_, i) => i % 2 === 1)].forEach(
      (half, side) => {
        this.tweens.add({
          targets: half,
          x: `${side ? '+' : '-'}=${deckW * 0.7}`,
          angle: side ? 8 : -8,
          duration: 120,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
        });
      },
    );
    this.time.delayedCall(DEAL.shuffleMs, () => this.sfx('mau-binh-deal'));
    deck.forEach((sprite, i) => {
      const seat = order[i % order.length] as number;
      const pos = Math.floor(i / order.length);
      const spot = this.cardSpot(ctx, seat, pos);
      this.tweens.add({
        targets: sprite,
        x: spot.x,
        y: spot.y,
        angle: jitter(i + 3) * 20,
        scale: (sprite.scale * spot.w) / deckW,
        delay: DEAL.shuffleMs + i * DEAL.stepMs,
        duration: DEAL.flyMs - 20,
        ease: 'Quad.easeOut',
        onComplete: () => {
          sprite.destroy();
          this.blocks[seat]?.cards[pos]?.setVisible(true);
        },
      });
    });
    const dealt = DEAL.shuffleMs + deck.length * DEAL.stepMs + DEAL.flyMs;
    this.time.delayedCall(dealt, () => {
      if (!current()) return;
      mine?.cards.forEach((sprite, i) => {
        sprite.flipTo(faces[i] ?? null, DEAL.flipMs);
      });
      this.time.delayedCall(DEAL.flipMs, () => {
        if (!current()) return;
        callout(this, `Vòng ${round}`, g.cx, g.midY, {
          size: 72,
          hold: Math.max(200, INTRO_MS - 700),
        });
        this.time.delayedCall(INTRO_MS * 0.8, () => {
          if (!current()) return;
          this.dealing = false;
          this.onState(this.ctx);
        });
      });
    });
  }

  // ── Arranging your cards ────────────────────────────────────────────────────────────────

  /** Your block, when you have cards this round. */
  private myBlock(ctx: Ctx) {
    return ctx.me && ctx.state.inRound[ctx.me.seat] ? this.blocks[ctx.me.seat] : undefined;
  }

  private canArrange(ctx: Ctx) {
    const { state, me } = ctx;
    return Boolean(
      me &&
        !this.dealing &&
        state.phase === 'arrange' &&
        !state.mine &&
        !state.forfeits.includes(me.seat),
    );
  }

  /** Your rows as they lie now. */
  private myRows(ctx: Ctx): Rows | null {
    const cards = this.myBlock(ctx)?.cards.map((c) => c.card);
    if (cards?.length !== 13 || cards.some((c) => c === null)) return null;
    const all = cards as Card[];
    return [all.slice(0, 5), all.slice(5, 10), all.slice(10)];
  }

  private makeMovable(sprite: CardSprite) {
    sprite.setInteractive({ useHandCursor: true, draggable: true });
    sprite.on('pointerdown', () => {
      this.dragged = false;
    });
    sprite.on('dragstart', () => {
      if (!this.canArrange(this.ctx)) return;
      this.dragged = true;
      this.pick(null);
      sprite.setDepth(500);
    });
    sprite.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => {
      if (this.dragged && this.canArrange(this.ctx)) sprite.setPosition(x, y);
    });
    sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragged) return;
      const at = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const target = this.cardAt(at.x, at.y, sprite);
      if (target && this.canArrange(this.ctx)) this.swap(sprite, target);
      else this.placeBlocks(this.ctx, true);
    });
    sprite.on('pointerup', () => {
      if (this.dragged || !this.canArrange(this.ctx)) return;
      if (!this.picked) this.pick(sprite);
      else if (this.picked === sprite) this.pick(null);
      else this.swap(this.picked, sprite);
    });
  }

  /** Your card under (x, y), besides `except`: the one in front where cards overlap. */
  private cardAt(x: number, y: number, except: CardSprite) {
    const cards = this.myBlock(this.ctx)?.cards ?? [];
    return cards
      .filter((c) => c !== except && c.getBounds().contains(x, y))
      .sort((a, b) => b.depth - a.depth)[0];
  }

  private pick(sprite: CardSprite | null) {
    this.picked?.setMark(null);
    this.picked = sprite;
    sprite?.setMark(0xffd84a);
    this.placeBlocks(this.ctx, true);
  }

  private swap(a: CardSprite, b: CardSprite) {
    const cards = this.myBlock(this.ctx)?.cards;
    if (!cards) return;
    this.undo.push(cards.map((c) => c.card as Card));
    const i = cards.indexOf(a);
    const j = cards.indexOf(b);
    cards[i] = b;
    cards[j] = a;
    this.sfx('mau-binh-place');
    this.afterMove();
  }

  /** Lays your cards out in this order (by position). */
  private reorder(order: Card[]) {
    const block = this.myBlock(this.ctx);
    if (!block) return;
    const byCard = new Map(block.cards.map((c) => [c.card as Card, c]));
    block.cards = order.map((card) => byCard.get(card) as CardSprite);
    this.afterMove();
  }

  private afterMove() {
    this.picked?.setMark(null);
    this.picked = null;
    this.foulWarnedAt = -Infinity;
    this.placeBlocks(this.ctx, true);
    this.updateMyLabels(this.ctx);
    this.updateButtons(this.ctx);
    this.showStatus(this.ctx);
  }

  private autoArrange() {
    const block = this.myBlock(this.ctx);
    if (!block || !this.canArrange(this.ctx)) return;
    this.undo.push(block.cards.map((c) => c.card as Card));
    this.sfx('mau-binh-swap');
    this.reorder(bestRows(this.ctx.state.hand).flat());
  }

  private undoLast() {
    const order = this.undo.pop();
    if (order && this.canArrange(this.ctx)) this.reorder(order);
  }

  /** "Xong": hands the rows in; binh lủng asks for a second tap first. */
  private submit() {
    const rows = this.myRows(this.ctx);
    if (!rows || !this.canArrange(this.ctx)) return;
    if (foulOf(rows) && this.time.now - this.foulWarnedAt > 4000) {
      this.foulWarnedAt = this.time.now;
      this.showStatus(this.ctx);
      this.updateButtons(this.ctx);
      return;
    }
    this.pick(null);
    this.send('submit', { rows });
  }

  /** Your rows' labels: each chi's hand, red where it breaks the order (binh lủng). */
  private updateMyLabels(ctx: Ctx) {
    const block = this.myBlock(ctx);
    const rows = this.myRows(ctx);
    if (!block || !rows || this.revealing) return;
    const foul = foulOf(rows);
    const bad = foul === 'Chi 2 mạnh hơn chi 1' ? [0, 1] : foul ? [1, 2] : [];
    rows.forEach((cards, row) => {
      block.labels[row]
        ?.setVisible(true)
        .setText(`Chi ${row + 1}\n${handName(cards)}`)
        .setColor(bad.includes(row) ? LOSE : '#ffffff');
    });
  }

  // ── Showing the state ───────────────────────────────────────────────────────────────────

  protected onState(ctx: Ctx) {
    const { state } = ctx;
    if (this.blocks.length !== ctx.players.length) this.makeBlocks(ctx);
    if (state.round !== this.shownRound) this.startRound(ctx);
    else if ((ctx.me?.seat ?? -1) !== this.shownSeat) {
      // Someone else's eyes now (the sandbox's seat buttons): lay the table out again.
      this.picked = null;
      this.undo = [];
      this.makeCards(ctx);
      const result = state.results.at(-1);
      if (state.phase === 'show' && result && this.revealing) this.reveal(ctx, false);
    }
    if (!this.dealing) {
      if (state.phase === 'arrange' && this.shownPhase !== 'arrange') {
        const g = this.geometry(ctx);
        if (this.shownPhase === 'deal') callout(this, 'Xếp bài!', g.cx, g.midY, { size: 60 });
      }
      // Handed in (here or on another tab): your cards lie as handed in.
      if (state.mine && state.phase === 'arrange') {
        const now = this.myRows(ctx)?.flat().join();
        if (now !== state.mine.flat().join()) this.reorder(state.mine.flat());
      }
      if (state.phase === 'show' && this.shownResults < state.results.length) {
        this.shownResults = state.results.length;
        this.reveal(ctx, this.shownPhase === 'arrange');
      }
      this.shownPhase = state.phase;
    }
    this.announceLeavers(ctx);
    this.showPlayers(ctx);
    this.showStatus(ctx);
    this.updateButtons(ctx);
  }

  private updateButtons(ctx: Ctx) {
    const { state, me } = ctx;
    const arranging = Boolean(
      me && state.phase === 'arrange' && !this.dealing && this.myBlock(ctx),
    );
    const open = arranging && !state.mine && !state.forfeits.includes(me?.seat ?? -1);
    for (const b of [this.autoButton, this.undoButton, this.doneButton])
      b.container.setVisible(open);
    this.undoButton.setEnabled(this.undo.length > 0);
    this.doneButton.setText(this.time.now - this.foulWarnedAt < 4000 ? 'Vẫn nộp' : 'Xong');
    this.cancelButton.container.setVisible(arranging && Boolean(state.mine));
  }

  /** The players list: picture, name, points, who is done. */
  private showPlayers(ctx: Ctx) {
    const { state, players } = ctx;
    const n = players.length;
    const order = Array.from({ length: n }, (_, i) => (this.mySeat(ctx) + i) % n);
    const rows = order.map((seat): PlayerRow => {
      const player = players[seat];
      const tag = this.tagOf(ctx, seat);
      return {
        name: seat === ctx.me?.seat ? `${player?.name ?? ''} (bạn)` : (player?.name ?? ''),
        avatar: this.avatar(player ?? {}),
        info: `${this.pointsOf(ctx, seat)} điểm`,
        badge: tag?.text ?? null,
        badgeColor: tag?.color,
        turn: false,
        dim: state.gone.includes(seat),
      };
    });
    this.list.set(rows);
    this.blocks.forEach((b, seat) => {
      b.avatar.setAlpha(state.gone.includes(seat) ? 0.4 : 1);
      // Once the rows are shown, the tags tell binh lủng and tới trắng (see `showMarks`).
      if (state.phase === 'show') return;
      const tag = this.tagOf(ctx, seat);
      const bottom = this.slotOf(ctx, seat) === 'bottom';
      b.tag
        .setText(tag?.text ?? '')
        .setColor(tag?.color ?? '#ffffff')
        .setVisible(Boolean(tag) && !bottom);
      this.placeTag(ctx, seat);
      for (const c of b.cards) c.setAlpha(state.gone.includes(seat) ? 0.5 : 1);
    });
  }

  /** Match points as the screen tells them: this round's only once the totals have popped up. */
  private pointsOf(ctx: Ctx, seat: number) {
    const { state } = ctx;
    const pending = state.phase === 'show' && !this.totalsShown;
    return (state.points[seat] ?? 0) - (pending ? (state.results.at(-1)?.points[seat] ?? 0) : 0);
  }

  private tagOf(ctx: Ctx, seat: number): { text: string; color: string } | null {
    const { state } = ctx;
    if (state.gone.includes(seat)) return { text: 'Rời bàn', color: '#c9c9c9' };
    if (!state.inRound[seat]) return null;
    if (state.phase === 'arrange' && !this.dealing) {
      return state.ready[seat] ? { text: '✓', color: WIN } : null;
    }
    return null;
  }

  private showStatus(ctx: Ctx) {
    const { state, result } = ctx;
    const g = this.geometry(ctx);
    let text = '';
    let color = '#ffffff';
    const seconds = this.secondsLeft(ctx);
    const clock = state.phase === 'arrange' && !this.dealing && seconds !== null;
    if (result) text = 'Hết ván!';
    else if (state.phase === 'arrange' && !this.dealing) {
      const rows = this.myRows(ctx);
      const foul = rows && !state.mine ? foulOf(rows) : null;
      if (this.time.now - this.foulWarnedAt < 4000) {
        text = 'Binh lủng! Bấm "Vẫn nộp" để nộp';
        color = LOSE;
      } else if (foul && this.canArrange(ctx)) {
        text = `Binh lủng: ${foul}`;
        color = LOSE;
      } else if (state.mine) {
        const waiting = state.ready.filter(
          (r, s) => !r && state.inRound[s] && !state.forfeits.includes(s),
        ).length;
        text = `Chờ ${waiting} người xếp xong`;
      } else if (ctx.me && this.myBlock(ctx)) text = 'Xếp bài';
      else text = 'Mọi người đang xếp bài';
      if (seconds !== null) text += ` · ${seconds}`;
      if (seconds !== null && seconds <= 10 && color === '#ffffff') color = '#ff7a6b';
    }
    this.status
      .setColor(color)
      .setFontSize(26 * g.hud)
      .setVisible(
        !this.board.visible && !this.rules.visible && !this.results.visible && text !== '',
      );
    this.fitText(this.status, text, g.width - 70 * g.hud, 13 * g.hud);
    const hourglassH = 40 * g.hud;
    this.status.setPosition(g.cx + (clock ? hourglassH * 0.35 : 0), g.statusY);
    this.hourglass
      .setDisplaySize((hourglassH * this.hourglass.width) / this.hourglass.height, hourglassH)
      .setPosition(this.status.x - this.status.width / 2 - hourglassH * 0.45, g.statusY)
      .setVisible(clock && this.status.visible);
  }

  /** "Lan bỏ cuộc" when someone leaves the table. */
  private announceLeavers(ctx: Ctx) {
    const { state } = ctx;
    const g = this.geometry(ctx);
    while (this.shownGone < state.gone.length) {
      const seat = state.gone[this.shownGone++] as number;
      const name = ctx.players[seat]?.name ?? '';
      callout(this, `${name} bỏ cuộc`, g.cx, g.midY, { size: 34, color: '#ff9d9d' });
    }
  }

  // ── The clock ───────────────────────────────────────────────────────────────────────────

  private secondsLeft(ctx: Ctx) {
    const t = ctx.timer;
    if (t?.event !== 'arrange-over') return null;
    return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  }

  protected onUpdate(ctx: Ctx) {
    const t = ctx.timer;
    if (t?.event === 'arrange-over' && !this.dealing) {
      const seconds = this.secondsLeft(ctx) ?? -1;
      if (seconds !== this.shownSecond) {
        this.shownSecond = seconds;
        this.showStatus(ctx);
        this.updateButtons(ctx);
        this.tick(ctx, seconds);
      }
    }
    if (t?.event === 'next-round' && this.board.visible && !ctx.result) {
      const seconds = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      this.board.setFooter(`Vòng ${ctx.state.round + 1} bắt đầu sau ${seconds} giây`);
    }
  }

  /**
   * The last ten seconds: the status line beats once a second; the last three pop up big with
   * a tick. Two seconds before the end, rows that are fine are handed in for you.
   */
  private tick(ctx: Ctx, seconds: number) {
    if (seconds > 10 || seconds <= 0) return;
    this.tweens.add({
      targets: this.status,
      scale: 1.18,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    if (seconds <= 3) {
      const g = this.geometry(ctx);
      callout(this, String(seconds), g.cx, g.midY, { size: 96, color: '#ff7a6b', hold: 250 });
      this.sfx('mau-binh-tick');
    }
    const rows = this.myRows(ctx);
    if (seconds <= 2 && !this.autoSent && rows && !foulOf(rows) && this.canArrange(ctx)) {
      this.autoSent = true;
      this.send('submit', { rows });
    }
  }

  // ── The reveal ──────────────────────────────────────────────────────────────────────────

  /** The seat whose side the numbers are told from: you, or seat 0 for a spectator. */
  private reference(ctx: Ctx, result: RoundResult) {
    const seat = this.mySeat(ctx);
    return result.rows[seat] ? seat : null;
  }

  /**
   * Everyone's rows are turned over and scored: tới trắng, then chi 1, 2, 3, sập 3 chi and the
   * totals (see REVEAL for the timing), then the round's scores. Without `animate` (joining
   * late) it all shows at once.
   */
  private reveal(ctx: Ctx, animate: boolean) {
    const result = ctx.state.results.at(-1);
    if (!result) return;
    this.revealing = true;
    this.totalsShown = false;
    this.pick(null);
    const round = ctx.state.round;
    const current = () => this.shownRound === round && this.ctx.state.round === round;
    const g = this.geometry(ctx);
    // Your cards lie as scored (e.g. arranged by the computer when time ran out).
    const mine = this.myBlock(ctx);
    const myRows = ctx.me ? result.rows[ctx.me.seat] : null;
    if (mine && myRows) this.reorder(myRows.flat());
    for (const b of this.blocks) b.tag.setText('');
    const specialSeats = result.specials.flatMap((s, seat) => (s ? [seat] : []));
    const steps: [number, () => void][] = [];
    let t = 0;
    const at = (fn: () => void, ms: number) => {
      steps.push([t, fn]);
      t += ms;
    };
    at(() => {
      if (animate) {
        callout(this, 'Lật bài!', g.cx, g.midY, { size: 64 });
        this.sfx('mau-binh-reveal');
      }
      this.showMarks(ctx, result);
    }, REVEAL.introMs);
    if (specialSeats.length) {
      at(() => {
        for (const seat of specialSeats)
          for (let row = 0; row < 3; row++) this.turnRow(seat, row, result, animate);
        const words = specialSeats
          .map(
            (seat) =>
              `${this.nameOf(ctx, seat)}: ${specialInfo(result.specials[seat] ?? null)?.name}!`,
          )
          .join('\n');
        if (animate) this.cutIn(words, '#ffe066', 'mau-binh-special');
      }, REVEAL.specialMs);
    }
    for (let row = 0; row < 3; row++) {
      at(() => {
        if (animate) {
          this.battle(ctx, result, row, current);
          return;
        }
        result.rows.forEach((rows, seat) => {
          if (rows && !result.specials[seat]) this.turnRow(seat, row, result, false);
        });
        this.showChi(ctx, result, row);
      }, REVEAL.chiMs);
    }
    const scoops = result.duels.filter((d) => d.scoop !== 0);
    if (scoops.length) {
      at(() => {
        const words = scoops
          .map((d) => {
            const [winner, loser] = d.scoop > 0 ? [d.a, d.b] : [d.b, d.a];
            return `${this.nameOf(ctx, winner)} bắt sập ${this.nameOf(ctx, loser)}!`;
          })
          .join('\n');
        if (animate) this.cutIn(words, '#ffb02e', 'mau-binh-scoop');
      }, REVEAL.scoopMs);
    }
    at(() => this.showTotals(ctx, result, animate), REVEAL.totalMs);
    at(() => {
      if (this.ctx.result) this.showStandings(this.ctx, animate);
      else this.showRoundResult(this.ctx, animate);
    }, 0);
    for (const [when, fn] of steps) {
      if (!animate) fn();
      else this.time.delayedCall(when, () => current() && fn());
    }
  }

  private nameOf(ctx: Ctx, seat: number) {
    return seat === ctx.me?.seat ? 'Bạn' : (ctx.players[seat]?.name ?? '');
  }

  /** Bỏ cuộc, binh lủng, tới trắng or rows arranged by the computer, or `null`. */
  private markOf(result: RoundResult, seat: number) {
    const special = specialInfo(result.specials[seat] ?? null);
    if (result.forfeits[seat]) return { text: 'Bỏ cuộc', color: LOSE };
    if (result.fouls[seat]) return { text: 'Binh lủng', color: LOSE };
    if (special) return { text: special.name, color: '#ffe066' };
    if (result.auto[seat]) return { text: 'Hết giờ, máy xếp', color: '#ffe8a3' };
    return null;
  }

  /** Binh lủng, bỏ cuộc and tới trắng, under each player's cards. */
  private showMarks(ctx: Ctx, result: RoundResult) {
    this.blocks.forEach((b, seat) => {
      const mark = this.markOf(result, seat);
      const text = mark?.text ?? '';
      const color = mark?.color ?? '#ffffff';
      const bottom = this.slotOf(ctx, seat) === 'bottom';
      b.tag
        .setText(text)
        .setColor(color)
        .setVisible(text !== '');
      if (bottom) b.tag.setPosition(this.g().cx, this.g().tagY);
      else this.placeTag(ctx, seat);
    });
  }

  /** Turns one row of `seat` face up, with the cards of the result. */
  private turnRow(seat: number, row: number, result: RoundResult, animate: boolean) {
    const b = this.blocks[seat];
    const rows = result.rows[seat];
    if (!b || !rows) return;
    const cards = rows[row] ?? [];
    cards.forEach((card, i) => {
      const sprite = b.cards[(ROW_START[row] as number) + i];
      if (!sprite || sprite.card === card) return;
      if (animate) this.time.delayedCall(i * 40, () => sprite.flipTo(card, 260));
      else sprite.setCard(card);
    });
  }

  /** Chi `row`: every hand's name and what it won, told from your side. */
  /**
   * `seat`'s chi `row`: its hand's name and the points it won, told from your side (yours: the
   * sum against everyone; theirs: against you). `null` points when chi weren't compared.
   */
  private chiOutcome(ctx: Ctx, result: RoundResult, seat: number, row: number) {
    const ref = this.reference(ctx, result);
    const name = handName(result.rows[seat]?.[row] ?? []);
    let points: number | null = null;
    if (seat === ref) {
      const chi = result.duels.filter((d) => d.kind === 'chi' && (d.a === seat || d.b === seat));
      if (chi.length) points = chi.reduce((sum, d) => sum + (sideOf(d, seat).chi[row] ?? 0), 0);
    } else if (ref !== null) {
      const d = result.duels.find(
        (x) => x.kind === 'chi' && [x.a, x.b].includes(seat) && [x.a, x.b].includes(ref),
      );
      if (d) points = sideOf(d, seat).chi[row] ?? 0;
    }
    return { name, points };
  }

  /**
   * One chi compared on the "bàn đấu": everyone's cards of that chi fly from their rows to the
   * middle of the table, turn over, show who won, then go back to their rows.
   */
  private battle(ctx: Ctx, result: RoundResult, row: number, current: () => boolean) {
    const g = this.geometry(ctx);
    const order: Slot[] = ['top', 'left', 'right', 'bottom'];
    const seats = result.rows
      .flatMap((r, seat) => (r && !result.specials[seat] ? [seat] : []))
      .sort((a, b) => order.indexOf(this.slotOf(ctx, a)) - order.indexOf(this.slotOf(ctx, b)));
    if (!seats.length) return;
    const lay = this.arena.layout(g.arena, seats.length, g.sizes.big * 0.9, g.hud);
    this.arena.show(g.arena, g.hud);
    const start = ROW_START[row] as number;
    const count = ROW_LENGTH[row] as number;
    const spritesOf = (seat: number) =>
      (this.blocks[seat]?.cards ?? []).slice(start, start + count);
    // Laid down: each card flies to its place, growing or shrinking to the arena's size.
    this.sfx('mau-binh-swap');
    seats.forEach((seat, k) => {
      const cell = lay.cells[k] ?? { x: g.cx, y: g.midY };
      spritesOf(seat).forEach((sprite, i) => {
        const from = sprite.width;
        sprite
          .setCardWidth(lay.w)
          .setScale(from / lay.w)
          .setDepth(760 + k * 10 + i);
        this.tweens.add({
          targets: sprite,
          x: cell.x + (i - (count - 1) / 2) * lay.w * ARENA_STEP,
          y: cell.y,
          scale: 1,
          angle: 0,
          delay: k * 70 + i * 30,
          duration: 300,
          ease: 'Cubic.easeOut',
        });
      });
    });
    const later = (ms: number, fn: () => void) =>
      this.time.delayedCall(ms, () => {
        if (current()) fn();
      });
    // Turned over together, then compared.
    later(420 + seats.length * 70, () => {
      for (const seat of seats) this.turnRow(seat, row, result, true);
      this.sfx('mau-binh-place');
    });
    later(1000 + seats.length * 70, () => {
      seats.forEach((seat, k) => {
        const cell = lay.cells[k] ?? { x: g.cx, y: g.midY };
        const { name, points } = this.chiOutcome(ctx, result, seat, row);
        const who = seat === ctx.me?.seat ? 'Bạn' : (ctx.players[seat]?.name ?? '');
        const text = points === null ? `${who}: ${name}` : `${who}: ${name} ${signed(points)}`;
        const color = points === null ? '#ffffff' : colorOf(points);
        this.arena.label(cell.x, cell.y + lay.labelDy, text, color, g.hud);
        if (points !== null) for (const sprite of spritesOf(seat)) sprite.setMark(markOf(points));
      });
      this.showChi(ctx, result, row);
    });
    // Back to their rows.
    later(REVEAL.chiMs - 420, () => {
      this.arena.clearLabels();
      seats.forEach((seat) => {
        spritesOf(seat).forEach((sprite, i) => {
          const spot = this.cardSpot(this.ctx, seat, start + i);
          sprite.setCardWidth(spot.w).setScale(lay.w / spot.w);
          this.tweens.add({
            targets: sprite,
            x: spot.x,
            y: spot.y,
            scale: 1,
            delay: i * 25,
            duration: 280,
            ease: 'Cubic.easeInOut',
            onComplete: () => sprite.setDepth(spot.depth),
          });
        });
      });
      if (row === 2) this.arena.hide();
    });
  }

  private showChi(ctx: Ctx, result: RoundResult, row: number) {
    result.rows.forEach((rows, seat) => {
      const b = this.blocks[seat];
      if (!b || !rows) return;
      const { name, points } = this.chiOutcome(ctx, result, seat, row);
      const bottom = this.slotOf(ctx, seat) === 'bottom';
      const label = bottom ? `Chi ${row + 1}\n${name}` : name;
      b.labels[row]
        ?.setVisible(true)
        .setText(points === null ? label : `${label} ${signed(points)}`)
        .setColor(points === null ? '#ffffff' : colorOf(points));
      // Winning chi get a green outline, losing ones a red one.
      if (points !== null) {
        for (let i = 0; i < (ROW_LENGTH[row] as number); i++) {
          b.cards[(ROW_START[row] as number) + i]?.setMark(markOf(points));
        }
      }
    });
  }

  /** Everyone's points for the round pop up over their cards. */
  private showTotals(ctx: Ctx, result: RoundResult, animate: boolean) {
    result.rows.forEach((rows, seat) => {
      const b = this.blocks[seat];
      if (!b || !rows) return;
      const points = result.points[seat] ?? 0;
      b.total.setText(signed(points)).setColor(colorOf(points)).setVisible(true);
      if (animate) {
        b.total.setScale(0.2).setAlpha(0);
        this.tweens.add({
          targets: b.total,
          scale: 1,
          alpha: 1,
          duration: 260,
          ease: 'Back.easeOut',
        });
      }
    });
    const mine = ctx.me ? (result.points[ctx.me.seat] ?? 0) : 0;
    if (animate && mine > 0) this.sfx('mau-binh-win');
    this.totalsShown = true;
    this.showPlayers(ctx);
    // An open "Kết quả" gets the new round.
    if (this.results.visible) this.results.show(this.resultEntries(ctx));
  }

  /**
   * A cut-in: a golden burst (drawn frames) behind big words, for tới trắng and sập 3 chi.
   * It only comes once the result is out.
   */
  private cutIn(words: string, color: string, sound: string) {
    const g = this.g();
    const size = Math.min(g.width, g.height) * 0.9;
    const burst = this.add.sprite(g.cx, g.midY, this.texture('burst-1')).setDepth(880);
    burst.setDisplaySize(size, size).play('mau-binh-burst');
    burst.once('animationcomplete', () => burst.destroy());
    const band = this.add
      .rectangle(
        g.cx,
        g.midY,
        g.width,
        (40 + 52 * words.split('\n').length) * g.hud,
        0x2a0e08,
        0.72,
      )
      .setDepth(885)
      .setScale(1, 0);
    this.tweens.chain({
      targets: band,
      tweens: [
        { scaleY: 1, duration: 160, ease: 'Quad.easeOut' },
        { scaleY: 0, delay: 1300, duration: 200, ease: 'Quad.easeIn' },
      ],
      onComplete: () => band.destroy(),
    });
    callout(this, words, g.cx, g.midY, { size: 40, color, hold: 1150 });
    this.sfx(sound);
  }

  // ── Scores ──────────────────────────────────────────────────────────────────────────────

  /** The round's scores, best first, each with how they did against you. */
  private showRoundResult(ctx: Ctx, animate: boolean) {
    const { state } = ctx;
    const result = state.results.at(-1);
    if (!result || state.phase !== 'show') return;
    const ref = this.reference(ctx, result);
    const seats = result.rows.flatMap((r, seat) => (r ? [seat] : []));
    seats.sort((a, b) => (result.points[b] ?? 0) - (result.points[a] ?? 0) || a - b);
    const rows = seats.map((seat, place): StandingRow => {
      const vs = result.duels.find(
        (d) =>
          ref !== null && seat !== ref && [d.a, d.b].includes(seat) && [d.a, d.b].includes(ref),
      );
      const marks = [
        result.forfeits[seat]
          ? 'Bỏ cuộc'
          : result.fouls[seat]
            ? 'Binh lủng'
            : specialInfo(result.specials[seat] ?? null)?.name,
        `Tổng ${state.points[seat] ?? 0}`,
        vs && ctx.me ? `với bạn ${signed(sideOf(vs, seat).points)}` : null,
      ];
      return {
        place: PLACES[place] ?? '',
        placeColor: PLACE_COLORS[place] ?? '#ffffff',
        avatar: this.avatar(ctx.players[seat] ?? {}),
        name: ctx.players[seat]?.name ?? '',
        score: signed(result.points[seat] ?? 0),
        note: marks.filter(Boolean).join(' · '),
        me: seat === ctx.me?.seat,
      };
    });
    this.board.show(`Kết quả vòng ${state.round}`, rows, animate);
    this.showStatus(ctx);
  }

  /** The match's final standings, with its jingle for everyone. */
  private showStandings(ctx: Ctx, animate: boolean) {
    const { state } = ctx;
    const best = winners(state);
    const rows = standings(state).map(
      (seat, place): StandingRow => ({
        place: best.includes(seat) ? 'Nhất' : (PLACES[place] ?? ''),
        placeColor: best.includes(seat) ? '#ffd84a' : (PLACE_COLORS[place] ?? '#ffffff'),
        avatar: this.avatar(ctx.players[seat] ?? {}),
        name: ctx.players[seat]?.name ?? '',
        score: `${state.points[seat] ?? 0} điểm`,
        note: state.gone.includes(seat)
          ? 'Rời bàn'
          : `Vòng cuối ${signed(state.results.at(-1)?.points[seat] ?? 0)}`,
        me: seat === ctx.me?.seat,
      }),
    );
    this.board.setFooter('');
    this.board.show('Tổng kết', rows, animate);
    this.showStatus(ctx);
    this.onLayout(ctx);
    if (animate) this.sfx('mau-binh-standings');
  }

  /** The match is over: after the last reveal (see `reveal`), or everyone else left. */
  protected onEnd(ctx: Ctx) {
    if (this.revealing && this.board.visible) this.showStandings(ctx, true);
    else if (!this.revealing) this.showStandings(ctx, false);
  }

  /**
   * Every finished round for the "Kết quả" overlay, each player told from your side. The round
   * being revealed joins once its totals have popped up.
   */
  private resultEntries(ctx: Ctx): ResultEntry[][] {
    const { state, players } = ctx;
    const pending = state.phase === 'show' && !this.totalsShown ? 1 : 0;
    return state.results.slice(0, state.results.length - pending).map((result) =>
      result.rows.flatMap((rows, seat) =>
        rows
          ? [
              {
                name: players[seat]?.name ?? '',
                avatar: this.avatar(players[seat] ?? {}),
                points: result.points[seat] ?? 0,
                mark: this.markOf(result, seat),
                rows,
                chi: [0, 1, 2].map((row) => this.chiOutcome(ctx, result, seat, row)),
                me: seat === ctx.me?.seat,
              },
            ]
          : [],
      ),
    );
  }

  private toggleResults() {
    if (this.results.visible) this.results.hide();
    else {
      if (this.rules.visible) this.toggleRules();
      this.results.show(this.resultEntries(this.ctx));
    }
    this.resultsButton.setText(this.results.visible ? 'Đóng' : 'Kết quả');
    this.showStatus(this.ctx);
  }

  private toggleRules() {
    if (!this.rules.visible && this.results.visible) this.toggleResults();
    if (this.rules.visible) this.rules.hide();
    else this.rules.show(this.ctx.options.rounds, this.ctx.options.arrangeSeconds);
    this.rulesButton.setText(this.rules.visible ? 'Đóng' : 'Luật');
    this.showStatus(this.ctx);
  }
}
