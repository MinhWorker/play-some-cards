/**
 * The table, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state as
 * this player may see it, `me`, the players, score, options, timer, result and screen size.
 *
 *   onCreate  mat, seats, cards, texts, buttons     onState   seats, cards, round, buttons
 *   onLayout  place everything (and on resize)      onUpdate  the countdown
 *
 * You sit at the bottom, the others round the table. Before the deal you bet ("Cược 5/10/20")
 * unless you are the dealer ("Cái"). Drag to squeeze a private card, or tap to open it slowly;
 * "Lật bài" turns the whole hand over for everyone. At the count each player's hand
 * name and the points won or lost show at their seat.
 *
 * Local card art, tokens and audio live in assets/. Presentation is scoped to each round.
 */
import {
  type Button,
  type FlowContext,
  GameView,
  type ViewContext,
  type ViewSeat,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Card, handName, handOf } from '../game/cards.js';
import { BETS, type Options, type View } from '../game/model.js';
import { CARD_RATIO, CardSprite } from './Card.js';
import { type CardArt, cardArt, DEFAULT_LOOK } from './deck.js';
import { Mat } from './Mat.js';

type Ctx = ViewContext<View, Options>;

/** Where a seat sits, counted from yours round the table. */
type Slot = 'bottom' | 'left' | 'topLeft' | 'top' | 'topRight' | 'right';
const SLOTS: Record<number, Slot[]> = {
  1: ['bottom'],
  2: ['bottom', 'top'],
  3: ['bottom', 'topLeft', 'topRight'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'topLeft', 'topRight', 'right'],
  6: ['bottom', 'left', 'topLeft', 'top', 'topRight', 'right'],
};

/** Card widths: yours and everyone else's (design units). */
const MY_CARD = 116;
const THEIR_CARD = 64;

interface SeatObjs {
  avatar: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  line: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  plate: Phaser.GameObjects.Graphics;
  hand: Phaser.GameObjects.Text;
  delta: Phaser.GameObjects.Text;
  chip: Phaser.GameObjects.Image;
  dealer: Phaser.GameObjects.Image;
  cards: CardSprite[];
  /** Where its cards go: the middle of the three, and a card's width. */
  at: { x: number; y: number; width: number };
  /** What its cards showed last time (to flip or deal only on a change). */
  shown: string;
}

export class BaiCaoView extends GameView<View, Options> {
  private mat!: Mat;
  private art!: CardArt;
  private seats: SeatObjs[] = [];
  private info!: Phaser.GameObjects.Text;
  private roundLabel!: Phaser.GameObjects.Text;
  private dealerLabel!: Phaser.GameObjects.Text;
  private phases!: Phaser.GameObjects.Text[];
  private action!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Graphics;
  private gesture: {
    seat: number;
    k: number;
    id: number;
    x: number;
    y: number;
    distance: number;
  } | null = null;
  private reducedMotion = false;
  private countdown!: Phaser.GameObjects.Text;
  private buttons!: { bets: Button[]; reveal: Button };
  /** Your cards you have looked at this round (by position). */
  private peeked = new Set<number>();
  private peekRound = 0;
  private center = { x: 0, y: 0 };
  private plaque!: Phaser.GameObjects.Graphics;
  private presented: View | null = null;
  private ended = false;
  private tick = '';

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    this.seats = [];
    this.peeked = new Set();
    this.peekRound = ctx.state.round;
    this.presented = null;
    this.ended = false;
    this.tick = '';
    this.gesture = null;
    this.reducedMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.mat = new Mat(this, this.texture('mat'));
    this.art = cardArt(DEFAULT_LOOK, (name) => this.texture(name));
    this.roundLabel = this.label('', { size: 24 }).setDepth(20);
    this.dealerLabel = this.label('', { size: 24 }).setColor('#ffe8a3').setDepth(20);
    this.phases = ['Cược', 'Nặn bài', 'So bài'].map((text) =>
      this.label(text, { size: 28 }).setDepth(20),
    );
    this.action = this.label('', { size: 28 }).setDepth(20);
    this.progress = this.add.graphics().setDepth(20);
    this.info = this.label('', { size: 24 }).setDepth(20);
    this.countdown = this.label('', { size: 24 }).setColor('#ffe8a3').setDepth(20);
    this.plaque = this.add.graphics().setDepth(19);
    const opts = { image: 'button', size: 32 };
    this.buttons = {
      bets: BETS.map((amount) =>
        this.button(`Cược ${amount}`, () => this.send('bet', { amount }), opts),
      ),
      reveal: this.button('Lật bài', () => this.send('reveal'), opts),
    };
    this.makeSeats(ctx);
    const move = (pointer: Phaser.Input.Pointer) => this.moveSqueeze(pointer);
    const up = (pointer: Phaser.Input.Pointer) => this.endSqueeze(pointer);
    const cancel = () => this.cancelSqueeze();
    this.input.on('pointermove', move);
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.game.events.on('blur', cancel);
    this.events.once('shutdown', () => {
      this.game.events.off('blur', cancel);
    });
  }

  /** One seat's objects per player at the table. */
  private makeSeats(ctx: Ctx) {
    for (const seat of this.seats) {
      for (const obj of [
        seat.avatar,
        seat.ring,
        seat.name,
        seat.line,
        seat.tag,
        seat.status,
        seat.plate,
        seat.hand,
        seat.delta,
        seat.chip,
        seat.dealer,
        ...seat.cards,
      ])
        obj.destroy();
    }
    this.seats = ctx.players.map((_, i) => {
      const cards = [0, 1, 2].map((k) => {
        const card = new CardSprite(this, this.art, null).setVisible(false).setDepth(10 + k);
        return card;
      });
      cards.forEach((card, k) => {
        card.setSize(MY_CARD, MY_CARD * CARD_RATIO).setInteractive({ useHandCursor: true });
        card.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.beginSqueeze(i, k, pointer));
      });
      return {
        avatar: this.add.image(0, 0, this.avatar({})).setDepth(12),
        ring: this.add.graphics().setDepth(11),
        name: this.label('', { size: 22 }).setDepth(12),
        line: this.label('', { size: 18 }).setColor('#ffe8a3').setDepth(12),
        tag: this.label('', { size: 24 }).setColor('#ffd54f').setDepth(13),
        status: this.label('', { size: 24 }).setDepth(13),
        plate: this.add.graphics().setDepth(11),
        hand: this.label('', { size: 22 }).setDepth(14),
        delta: this.label('', { size: 30 }).setDepth(15),
        chip: this.image(0, 0, 'chip-5').setVisible(false).setDepth(16),
        dealer: this.image(0, 0, 'dealer').setVisible(false).setDepth(16),
        cards,
        at: { x: 0, y: 0, width: THEIR_CARD },
        shown: '',
      };
    });
  }

  /** The mat over the whole screen; seats round the table, you at the bottom. */
  protected onLayout(ctx: Ctx) {
    this.cancelSqueeze();
    this.runtime.cancelLane('settlement');
    const { width, height, hud } = ctx.screen;
    const bleed = this.bleed;
    this.mat.layout({
      area: {
        x: bleed.left,
        y: bleed.top,
        width: width - 2 * bleed.left,
        height: height - 2 * bleed.top,
      },
      frame: { left: 16, top: 16, right: width - 16, bottom: height - 12 },
    });
    if (this.seats.length !== ctx.players.length) this.makeSeats(ctx);
    const cx = width / 2;
    this.center = { x: cx, y: 400 };
    this.roundLabel
      .setFontSize(24)
      .setStroke('#40271b', 0)
      .setPosition(cx - 112, 355);
    this.dealerLabel.setStroke('#40271b', 0).setPosition(cx + 52, 355);
    this.phases.forEach((phase, k) => {
      phase
        .setFontSize(26)
        .setStroke('#40271b', 0)
        .setPosition(cx + (k - 1) * 112, 395);
    });
    this.info
      .setStroke('#40271b', 0)
      .setPosition(cx - 38, 433)
      .setWordWrapWidth(264);
    this.countdown
      .setFontSize(26)
      .setStroke('#40271b', 0)
      .setPosition(cx + 138, 433);
    this.action
      .setFontSize(26)
      .setPosition(cx + 324, 599)
      .setWordWrapWidth(212);
    this.plaque
      .clear()
      .fillStyle(0x40271b, 0.94)
      .fillRoundedRect(cx - 192, 332, 384, 132, 20);
    this.plaque.lineStyle(2, 0xf2cb7d, 0.7).strokeRoundedRect(cx - 192, 332, 384, 132, 20);
    const mine = this.mySeat(ctx) ?? 0;
    const n = this.seats.length;
    const slots = SLOTS[n] ?? SLOTS[6] ?? [];
    this.seats.forEach((seat, i) => {
      const slot = slots[(i - mine + n) % n] ?? 'top';
      this.placeSeat(seat, slot, ctx);
    });
    // Keep actions in the same lower band for every phase, away from opponents and the HUD.
    const btnW = Math.min(160, 132 * hud);
    const btnH = 88;
    this.buttons.bets.forEach((b, k) => {
      b.setSize(btnW, btnH).setPosition(cx + 96 + (k - 1) * (btnW + 16), height - 94);
    });
    this.buttons.reveal.setSize(212, btnH).setPosition(width - 156, height - 62);
    this.refresh(ctx, false);
  }

  /** Puts a seat's picture, texts and cards in its slot. */
  private placeSeat(seat: SeatObjs, slot: Slot, ctx: Ctx) {
    const { width, height, hud } = ctx.screen;
    const cx = width / 2;
    const pic = Math.min(80, 56 * hud);
    const bottom = slot === 'bottom';
    const side = slot === 'left' || slot === 'right';
    let cards: SeatObjs['at'];
    let plate: { x: number; y: number };
    const opponentWidth = Math.min(80, THEIR_CARD + (width - 960) * 0.03);
    if (bottom) {
      cards = { x: cx, y: height - 114, width: Math.min(128, MY_CARD + (width - 960) * 0.04) };
      plate = { x: 104, y: height - 92 };
    } else if (side) {
      const left = slot === 'left';
      const x = left ? 144 : width - 144;
      cards = { x, y: 520, width: opponentWidth };
      plate = { x: x + (left ? -72 : 72), y: 380 };
    } else {
      const spread = cx - 228;
      const shift = { topLeft: -spread, top: 0, topRight: spread }[slot] ?? 0;
      cards = { x: cx + shift, y: 260, width: opponentWidth };
      plate = { x: cards.x - 72, y: 118 };
    }
    seat.at = cards;
    seat.avatar.setDisplaySize(pic, pic).setPosition(plate.x, plate.y);
    seat.ring.setPosition(plate.x, plate.y);
    const textX = bottom
      ? plate.x + 92
      : side
        ? cards.x + (slot === 'left' ? 24 : -24)
        : cards.x + 24;
    const textY = plate.y - 14;
    seat.plate
      .clear()
      .fillStyle(0x40271b, 0.88)
      .fillRoundedRect(textX - 86, textY - 18, 172, 64, 12);
    seat.name.setFontSize(28).setPosition(textX, textY);
    seat.line.setFontSize(24).setPosition(textX, textY + 30);
    seat.tag.setPosition(plate.x - pic / 2, plate.y - pic / 2);
    seat.status
      .setFontSize(24)
      .setPosition(bottom ? textX : cards.x, bottom ? plate.y + 60 : textY + 66);
    seat.dealer.setDisplaySize(48, 48).setPosition(plate.x + pic / 2, plate.y - pic / 2 + 6);
    seat.chip
      .setDisplaySize(44, 44)
      .setPosition(
        bottom ? plate.x - 56 : side ? plate.x : plate.x - 56,
        bottom ? plate.y + 40 : side ? plate.y - 58 : plate.y + 16,
      );
    seat.hand
      .setFontSize(bottom ? 30 : 24)
      .setPosition(cards.x - (bottom ? 50 : 35), bottom ? cards.y - 108 : seat.status.y);
    seat.delta
      .setFontSize(30)
      .setPosition(cards.x + (bottom ? 112 : 72), bottom ? cards.y - 108 : seat.status.y);
    seat.cards.forEach((card, k) => {
      // A card still flying in lands at once (a resize, or the scene restarting).
      this.runtime.cancelLane(`card:${this.seats.indexOf(seat)}:${k}`);
      this.runtime.cancelTweens(card);
      card.dealing = false;
      card
        .setCardWidth(cards.width)
        .setScale(1)
        .setAngle(0)
        .setAlpha(1)
        .setPosition(cards.x + (k - 1) * (cards.width + 8), cards.y);
    });
  }

  protected onStart() {
    this.cancelSqueeze();
    this.peeked.clear();
    this.peekRound = this.ctx.state.round;
    for (const seat of this.seats) seat.shown = '';
    this.onLayout(this.ctx);
  }

  protected onResync(ctx: Ctx) {
    this.cancelSqueeze();
    this.presented = null;
    this.tick = '';
    this.peeked.clear();
    this.peekRound = ctx.state.round;
    for (const seat of this.seats) seat.shown = '';
    this.onLayout(ctx);
  }

  protected onState(ctx: Ctx) {
    if (this.seats.length !== ctx.players.length) this.onLayout(ctx);
    else this.refresh(ctx, true);
  }

  protected onUpdate(ctx: Ctx) {
    const timer = ctx.timer;
    if (!timer || ctx.result) {
      this.countdown.setText('');
      this.progress.clear();
      return;
    }
    const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const text = `${left}s`;
    const ratio = Math.max(0, Math.min(1, (timer.endsAt - Date.now()) / timer.ms));
    const color = left <= 3 && timer.event !== 'next-round' ? 0xff8a80 : 0xffd54f;
    this.progress
      .clear()
      .fillStyle(0xfff8e7, 0.16)
      .fillRoundedRect(this.center.x - 168, 455, 336, 4, 2);
    this.progress.fillStyle(color, 1).fillRoundedRect(this.center.x - 168, 455, 336 * ratio, 4, 2);
    if (this.countdown.text !== text) this.countdown.setText(text);
    this.countdown.setColor(left <= 3 && timer.event !== 'next-round' ? '#ffbc9b' : '#ffe8a3');
    const key = `${ctx.state.round}:${timer.event}:${left}`;
    const mine = this.mySeat(ctx);
    const needsAction =
      mine !== null &&
      !ctx.state.gone.includes(mine) &&
      ((ctx.state.phase === 'bet' && mine !== ctx.state.dealer && ctx.state.bets[mine] === null) ||
        (ctx.state.phase === 'reveal' && !ctx.state.revealed[mine]));
    if (key !== this.tick && left > 0 && left <= 3 && needsAction) void this.sfx('bai-cao-tick');
    this.tick = key;
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────────────────

  private mySeat({ me }: Ctx): number | null {
    return me ? me.seat : null;
  }

  private player(ctx: Ctx, seat: number): ViewSeat | undefined {
    return ctx.players.find((p) => p.seat === seat);
  }

  /** Everything from the state; `animate`: deal and flip cards that changed. */
  private refresh(ctx: Ctx, animate: boolean) {
    const { state } = ctx;
    const mine = this.mySeat(ctx);
    if (state.round !== this.peekRound) {
      this.gesture = null;
      this.runtime.newRound('game-round');
      this.peekRound = state.round;
      for (const seat of this.seats) {
        seat.shown = '';
        this.runtime.cancelTweens(seat.delta);
        seat.delta.setText('').setAlpha(1).setScale(1);
        seat.cards.forEach((card, k) => {
          card.dealing = false;
          card
            .setCard(null)
            .setScale(1)
            .setAngle(0)
            .setAlpha(1)
            .setPosition(seat.at.x + (k - 1) * (seat.at.width + 8), seat.at.y);
        });
      }
      this.peeked.clear();
    }
    if (this.gesture && !this.canSqueeze(this.gesture.seat, this.gesture.k)) {
      const { seat, k } = this.gesture;
      const card = this.seats[seat]?.cards[k];
      const at = this.seats[seat]?.at;
      this.gesture = null;
      if (card && at) card.setCard(null).setAngle(0).setY(at.y);
    }
    if (animate) this.present(ctx);
    this.presented = state;
    this.ended = Boolean(ctx.result);
    this.seats.forEach((seat, i) => {
      this.showSeat(ctx, seat, i, i === mine, animate);
    });
    const dealer = this.player(ctx, state.dealer);
    const dealerName = state.dealer === mine ? 'Bạn' : (dealer?.name ?? '…');
    const active = ctx.players.filter((p) => !state.gone.includes(p.seat));
    const punters = active.filter((p) => p.seat !== state.dealer);
    const done =
      state.phase === 'bet'
        ? punters.filter((p) => state.bets[p.seat] !== null).length
        : active.filter((p) => state.revealed[p.seat]).length;
    this.roundLabel.setText(`Ván ${state.round}/${state.rounds}`);
    this.dealerLabel.setFontSize(24);
    this.fitText(this.dealerLabel, `Cái: ${dealerName}`, 180, 24);
    this.phases.forEach((phase, k) => {
      phase.setColor(k === { bet: 0, reveal: 1, showdown: 2 }[state.phase] ? '#ffd54f' : '#bda787');
    });
    let info =
      state.phase === 'bet'
        ? `Đã cược ${done}/${punters.length}`
        : state.phase === 'reveal'
          ? `Đã lật ${done}/${active.length}`
          : 'Đã so bài';
    let action =
      mine === null
        ? 'Đang xem'
        : state.gone.includes(mine)
          ? 'Rời bàn'
          : state.phase === 'bet'
            ? mine === state.dealer
              ? 'Bạn làm cái'
              : state.bets[mine] !== null
                ? `Đã cược ${state.bets[mine]}`
                : 'Đặt cược'
            : state.phase === 'reveal'
              ? state.revealed[mine]
                ? 'Đã lật bài'
                : `Đã nặn ${this.peeked.size}/3`
              : 'Ván sau';
    if (ctx.result) {
      const winners = ctx.players.filter((p) => ctx.result?.winners.includes(p.id));
      info =
        winners.length === 0
          ? 'Hoà cả bàn'
          : winners.length === 1
            ? `${winners[0]?.seat === mine ? 'Bạn' : winners[0]?.name} thắng`
            : `${winners.length} người thắng`;
      action = 'Kết thúc';
    } else if (state.phase === 'showdown' && !state.results) {
      info = 'Nhà cái rời · Huỷ ván';
    } else if (state.phase === 'showdown' && mine !== null) {
      const delta = state.results?.find((r) => r.seat === mine)?.delta;
      if (delta !== undefined) action = `${delta > 0 ? '+' : ''}${delta} điểm`;
    }
    this.info.setFontSize(26);
    this.fitText(this.info, info, 264, 24);
    this.action.setPosition(
      state.phase === 'bet' ? this.center.x + 96 : ctx.screen.width - 156,
      state.phase === 'bet' ? 544 : 599,
    );
    this.action
      .setText(action)
      .setColor(mine === state.dealer && state.phase === 'bet' ? '#ffd54f' : '#fff8e7');
    const betting = Boolean(
      !ctx.result &&
        state.phase === 'bet' &&
        mine !== null &&
        mine !== state.dealer &&
        state.bets[mine] === null &&
        !state.gone.includes(mine),
    );
    for (const b of this.buttons.bets) b.container.setVisible(betting);
    const revealing = Boolean(
      !ctx.result &&
        state.phase === 'reveal' &&
        mine !== null &&
        !state.revealed[mine] &&
        (state.hands[mine]?.length ?? 0) > 0,
    );
    this.buttons.reveal.container.setVisible(revealing);
  }

  private showSeat(ctx: Ctx, seat: SeatObjs, i: number, isMe: boolean, animate: boolean) {
    const { state } = ctx;
    const player = this.player(ctx, i);
    const gone = state.gone.includes(i);
    seat.avatar.setTexture(this.avatar(player ?? {})).setAlpha(gone ? 0.35 : 1);
    this.fitText(seat.name, isMe ? 'Bạn' : (player?.name ?? '…'), 160, 24);
    seat.name.setAlpha(gone ? 0.5 : 1);
    const bet = state.bets[i];
    seat.line.setText(`${state.points[i] ?? 0} điểm`);
    const waiting =
      !ctx.result &&
      ((state.phase === 'bet' && i !== state.dealer && bet === null) ||
        (state.phase === 'reveal' && !state.revealed[i]));
    seat.status
      .setText(
        gone
          ? 'Rời bàn'
          : i === state.dealer
            ? 'Nhà cái'
            : state.phase === 'bet'
              ? bet === null
                ? 'Chờ cược'
                : `Cược ${bet}`
              : state.revealed[i]
                ? 'Đã lật'
                : 'Đang nặn',
      )
      .setColor(i === state.dealer ? '#ffd54f' : waiting ? '#ffe8a3' : '#fff8e7');
    seat.tag.setText(gone ? 'Rời bàn' : player?.id === ctx.hostId ? '👑' : '');
    seat.dealer.setVisible(i === state.dealer && !gone);
    seat.chip.setVisible(Boolean(bet && !gone));
    if (bet) seat.chip.setTexture(this.texture(`chip-${bet}`));
    // The dealer's picture has a gold ring.
    seat.ring.clear();
    if (!gone && (i === state.dealer || waiting)) {
      seat.ring
        .lineStyle(i === state.dealer ? 5 : 2, i === state.dealer ? 0xffd54f : 0xffe8a3, 1)
        .strokeCircle(0, 0, seat.avatar.displayWidth / 2 + 4);
    }

    const hand = state.hands[i];
    const dealt = hand === null || (hand?.length ?? 0) > 0;
    const faces: (Card | null)[] = [0, 1, 2].map((k) => {
      if (!hand) return null;
      if (isMe && !state.revealed[i] && state.phase !== 'showdown' && !this.peeked.has(k))
        return null;
      return hand[k] ?? null;
    });
    const key = dealt ? faces.map((c) => c ?? '_').join(',') : '';
    const fresh = seat.shown === '' && key !== '';
    seat.cards.forEach((card, k) => {
      card.setVisible(dealt);
      if (card.input)
        card.input.enabled =
          isMe &&
          !gone &&
          !ctx.result &&
          state.phase === 'reveal' &&
          !state.revealed[i] &&
          !this.peeked.has(k);
      if (!dealt) return;
      const face = faces[k] ?? null;
      if (this.gesture?.seat === i && this.gesture.k === k && this.canSqueeze(i, k)) return;
      if (card.dealing && animate) {
        card.targetCard = face;
        return;
      }
      if (fresh && animate && !this.reducedMotion) {
        // Dealt: fly in from the middle of the table.
        const { x, y } = card;
        card.setCard(null).setPosition(this.center.x, this.center.y).setAlpha(0);
        card.targetCard = face;
        card.dealing = true;
        this.runtime.run(
          async (fx) => {
            await fx.tween({
              targets: card,
              x,
              y,
              alpha: 1,
              duration: 260,
              delay:
                (k * this.seats.length +
                  ((i - state.dealer + this.seats.length) % this.seats.length)) *
                65,
              ease: 'Quad.easeOut',
            });
            fx.checkpoint();
            card.dealing = false;
            if (card.targetCard !== null) await card.flip(fx, card.targetCard, 260);
          },
          { lane: `card:${i}:${k}` },
        );
      } else if (!animate || this.reducedMotion) {
        card.setCard(face);
      } else if (card.targetCard !== face) {
        this.runtime.cancelLane(`card:${i}:${k}`);
        card.setAngle(0).setPosition(seat.at.x + (k - 1) * (seat.at.width + 8), seat.at.y);
        card.flipTo(face, `card:${i}:${k}`, 260);
      }
    });
    seat.shown = key;

    // The count: what each hand is worth and the points won or lost.
    const full =
      hand &&
      hand.length === 3 &&
      (state.revealed[i] || state.phase === 'showdown' || (isMe && this.peeked.size === 3));
    seat.status.setVisible(!full || isMe);
    seat.hand.setText(
      full ? `${i === state.dealer && !isMe ? 'Cái · ' : ''}${handName(handOf(hand))}` : '',
    );
    seat.hand.setColor(full && handOf(hand).tay ? '#ffe078' : '#fff8e7');
    const result =
      state.phase === 'showdown' ? state.results?.find((r) => r.seat === i) : undefined;
    if (result && seat.delta.text === '' && animate && !this.reducedMotion) {
      seat.delta.setAlpha(0).setScale(0.6);
      this.runtime.tween({
        targets: seat.delta,
        alpha: 1,
        scale: 1,
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    seat.delta
      .setText(result ? `${result.delta > 0 ? '+' : ''}${result.delta}` : '')
      .setColor(result && result.delta > 0 ? '#8dff8a' : '#ff8a80');
    if (!result) seat.delta.setAlpha(1).setScale(1);
  }

  private canSqueeze(seat: number, k: number) {
    const { state, result } = this.ctx;
    return (
      seat === this.mySeat(this.ctx) &&
      !result &&
      state.phase === 'reveal' &&
      !state.gone.includes(seat) &&
      !state.revealed[seat] &&
      Boolean(state.hands[seat]?.length) &&
      !this.peeked.has(k)
    );
  }

  private beginSqueeze(seat: number, k: number, pointer: Phaser.Input.Pointer) {
    if (this.gesture || !this.canSqueeze(seat, k)) return;
    const card = this.seats[seat]?.cards[k];
    if (
      !card ||
      card.dealing ||
      card.alpha < 1 ||
      Math.abs(card.y - (this.seats[seat]?.at.y ?? 0)) > 1
    )
      return;
    this.runtime.cancelLane(`card:${seat}:${k}`);
    this.gesture = { seat, k, id: pointer.id, x: pointer.worldX, y: pointer.worldY, distance: 0 };
    void this.sfx('bai-cao-peek');
  }

  private moveSqueeze(pointer: Phaser.Input.Pointer) {
    const g = this.gesture;
    if (!g || g.id !== pointer.id || !pointer.isDown) return;
    const card = this.seats[g.seat]?.cards[g.k];
    const face = this.ctx.state.hands[g.seat]?.[g.k];
    if (!card || face === undefined || !this.canSqueeze(g.seat, g.k)) return;
    g.distance = Math.max(g.distance, Math.hypot(pointer.worldX - g.x, pointer.worldY - g.y));
    const progress = Math.min(
      0.96,
      Math.max(0, g.y - pointer.worldY, (pointer.worldX - g.x) * 0.8) / (card.cardHeight * 0.65),
    );
    card.squeeze(face, progress);
    if (!this.reducedMotion)
      card.setAngle(-progress * 3).setY((this.seats[g.seat]?.at.y ?? card.y) - progress * 12);
  }

  private endSqueeze(pointer: Phaser.Input.Pointer) {
    const g = this.gesture;
    if (!g || g.id !== pointer.id) return;
    this.gesture = null;
    const card = this.seats[g.seat]?.cards[g.k];
    if (!card || !this.canSqueeze(g.seat, g.k)) return;
    this.finishSqueeze(g.seat, g.k, g.distance < 8 || card.squeezeProgress >= 0.52);
  }

  private cancelSqueeze() {
    const g = this.gesture;
    this.gesture = null;
    if (g && this.canSqueeze(g.seat, g.k)) this.finishSqueeze(g.seat, g.k, false);
  }

  private finishSqueeze(seat: number, k: number, open: boolean) {
    const card = this.seats[seat]?.cards[k];
    const face = this.ctx.state.hands[seat]?.[k];
    const at = this.seats[seat]?.at;
    if (!card || face === undefined || !at) return;
    if (open) this.peeked.add(k);
    card.squeeze(face, card.squeezeProgress);
    if (this.reducedMotion) {
      card
        .setCard(open ? face : null)
        .setAngle(0)
        .setY(at.y);
      this.refresh(this.ctx, true);
      return;
    }
    this.runtime.run(
      async (fx) => {
        await fx.tween({
          targets: card,
          squeezeProgress: open ? 1 : 0,
          angle: 0,
          y: at.y,
          duration: open ? 320 : 180,
          ease: 'Sine.easeOut',
        });
        fx.checkpoint();
        card.setCard(open ? face : null);
        this.refresh(this.ctx, true);
      },
      { lane: `card:${seat}:${k}` },
    );
  }

  /** Only live changes play audio or transfer tokens; resync and layout rebuild silently. */
  private present(ctx: Ctx) {
    const previous = this.presented;
    if (!previous) return;
    const { state } = ctx;
    if (state.bets.some((bet, i) => bet !== null && bet !== previous.bets[i]))
      void this.sfx('bai-cao-chip');
    if (
      state.phase === 'reveal' &&
      (previous.phase !== 'reveal' || previous.round !== state.round)
    ) {
      void this.sfx('bai-cao-deal');
    } else if (state.revealed.some((up, i) => up && !previous.revealed[i])) {
      void this.sfx('bai-cao-reveal');
    }
    if (state.phase === 'showdown' && previous.phase !== 'showdown' && state.results) {
      this.runtime.run(
        async (fx) => {
          await fx.wait(320);
          const mine = this.mySeat(ctx);
          const special = state.hands.some((hand) => hand?.length === 3 && handOf(hand).tay);
          const delta = state.results?.find((r) => r.seat === mine)?.delta;
          await fx.sound(
            special
              ? 'bai-cao-ba-tay'
              : delta !== undefined && delta < 0
                ? 'bai-cao-lose'
                : 'bai-cao-win',
            { duck: true },
          );
          if (this.reducedMotion) return;
          await fx.parallel(
            ...(state.results ?? [])
              .filter((r) => r.seat !== state.dealer)
              .map((r) => async (flow: FlowContext) => {
                const player = this.seats[r.seat];
                const dealer = this.seats[state.dealer];
                if (!player || !dealer) return;
                const from = r.delta > 0 ? dealer : player;
                const to = r.delta > 0 ? player : dealer;
                const chip = this.image(from.chip.x, from.chip.y, `chip-${state.bets[r.seat] ?? 5}`)
                  .setDisplaySize(44, 44)
                  .setDepth(30);
                flow.defer(() => chip.destroy());
                await flow.tween({
                  targets: chip,
                  x: to.chip.x,
                  y: to.chip.y,
                  duration: 550,
                  ease: 'Cubic.easeInOut',
                });
                await flow.sound('bai-cao-chip');
              }),
          );
        },
        { lane: 'settlement' },
      );
    }
    if (ctx.result && !this.ended) this.jingle('bai-cao-end');
  }
}
