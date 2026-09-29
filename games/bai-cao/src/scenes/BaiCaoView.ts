/**
 * The table, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state as
 * this player may see it, `me`, the players, score, options, timer, result and screen size.
 *
 *   onCreate  mat, seats, cards, texts, buttons     onState   seats, cards, round, buttons
 *   onLayout  place everything (and on resize)      onUpdate  the countdown
 *
 * You sit at the bottom, the others round the table. Before the deal you bet ("Cược 5/10/20")
 * unless you are the dealer ("Cái"). Your three cards come face down: tap one to look at it
 * yourself (nặn bài), "Lật bài" turns them over for everyone. At the count each player's hand
 * name and the points won or lost show at their seat.
 *
 * Cards, the mat and the buttons are Tiến Lên's art (copied, as games share no files); sounds
 * come later.
 */
import { type Button, GameView, type ViewContext, type ViewSeat } from '@psc/sdk/client';
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
const MY_CARD = 100;
const THEIR_CARD = 60;

interface SeatObjs {
  avatar: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  line: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Text;
  hand: Phaser.GameObjects.Text;
  delta: Phaser.GameObjects.Text;
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
  private countdown!: Phaser.GameObjects.Text;
  private buttons!: { bets: Button[]; reveal: Button };
  /** Your cards you have looked at this round (by position). */
  private peeked = new Set<number>();
  private peekRound = 0;
  private center = { x: 0, y: 0 };

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    this.seats = [];
    this.peeked = new Set();
    this.mat = new Mat(this, this.texture('mat'));
    this.art = cardArt(DEFAULT_LOOK, (name) => this.texture(name));
    this.info = this.label('', { size: 28 }).setDepth(20);
    this.countdown = this.label('', { size: 24 }).setColor('#ffe8a3').setDepth(20);
    const opts = { image: 'button', size: 26 };
    this.buttons = {
      bets: BETS.map((amount) =>
        this.button(`Cược ${amount}`, () => this.send('bet', { amount }), opts),
      ),
      reveal: this.button('Lật bài', () => this.send('reveal'), opts),
    };
    this.makeSeats(ctx);
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
        seat.hand,
        seat.delta,
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
        card.on('pointerup', () => this.peek(i, k));
      });
      return {
        avatar: this.add.image(0, 0, this.avatar({})).setDepth(12),
        ring: this.add.graphics().setDepth(11),
        name: this.label('', { size: 22 }).setDepth(12),
        line: this.label('', { size: 18 }).setColor('#ffe8a3').setDepth(12),
        tag: this.label('', { size: 18 }).setColor('#ffd54f').setDepth(13),
        hand: this.label('', { size: 22 }).setDepth(14),
        delta: this.label('', { size: 30 }).setDepth(15),
        cards,
        at: { x: 0, y: 0, width: THEIR_CARD },
        shown: '',
      };
    });
  }

  /** The mat over the whole screen; seats round the table, you at the bottom. */
  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const bleed = this.bleed;
    this.mat.layout({
      area: {
        x: bleed.left,
        y: bleed.top,
        width: width - 2 * bleed.left,
        height: height - 2 * bleed.top,
      },
      frame: { left: 16, top: top - 4, right: width - 16, bottom: height - 12 },
    });
    if (this.seats.length !== ctx.players.length) this.makeSeats(ctx);
    const cx = width / 2;
    const cy = (top + height) / 2 + 10;
    this.center = { x: cx, y: cy };
    this.info
      .setFontSize(28 * hud)
      .setPosition(cx, cy - 18 * hud)
      .setWordWrapWidth(width * 0.4);
    this.countdown.setFontSize(24 * hud).setPosition(cx, cy + 20 * hud);

    const mine = this.mySeat(ctx) ?? 0;
    const n = this.seats.length;
    const slots = SLOTS[n] ?? SLOTS[6] ?? [];
    this.seats.forEach((seat, i) => {
      const slot = slots[(i - mine + n) % n] ?? 'top';
      this.placeSeat(seat, slot, ctx);
    });
    // Your buttons, right of your cards.
    const btnW = 170 * hud;
    const btnH = 56 * hud;
    const x = Math.min(width - 16 - btnW / 2, cx + 1.8 * MY_CARD + btnW / 2);
    this.buttons.bets.forEach((b, k) => {
      b.setSize(btnW, btnH).setPosition(
        x,
        height - 24 - btnH / 2 - (BETS.length - 1 - k) * (btnH + 8),
      );
    });
    this.buttons.reveal.setSize(btnW, btnH).setPosition(x, height - 24 - btnH / 2);
    this.refresh(ctx, false);
  }

  /** Puts a seat's picture, texts and cards in its slot. */
  private placeSeat(seat: SeatObjs, slot: Slot, ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const cx = width / 2;
    const cy = this.center.y;
    const pic = 56 * hud;
    let cards: { x: number; y: number; width: number };
    let plate: { x: number; y: number };
    switch (slot) {
      case 'bottom':
        cards = { x: cx, y: height - 24 - (MY_CARD * CARD_RATIO) / 2, width: MY_CARD };
        plate = { x: cx - 1.6 * MY_CARD - 70 * hud, y: cards.y - 30 * hud };
        break;
      case 'left':
      case 'right': {
        const x = slot === 'left' ? 40 + 110 * hud : width - 40 - 110 * hud;
        plate = { x, y: cy - 70 * hud };
        cards = { x, y: cy + 50 * hud, width: THEIR_CARD };
        break;
      }
      default: {
        const shift = { topLeft: -0.3, top: 0, topRight: 0.3 }[slot] ?? 0;
        const x = cx + shift * width;
        plate = { x: x - 1.6 * THEIR_CARD - 40 * hud, y: top + 60 * hud };
        cards = { x, y: top + 60 * hud, width: THEIR_CARD };
      }
    }
    seat.at = cards;
    seat.avatar.setDisplaySize(pic, pic).setPosition(plate.x, plate.y);
    seat.ring.setPosition(plate.x, plate.y);
    seat.name.setFontSize(22 * hud).setPosition(plate.x, plate.y + pic / 2 + 14 * hud);
    seat.line.setFontSize(18 * hud).setPosition(plate.x, plate.y + pic / 2 + 36 * hud);
    seat.tag.setFontSize(18 * hud).setPosition(plate.x, plate.y - pic / 2 - 12 * hud);
    const cardH = cards.width * CARD_RATIO;
    const below = slot === 'bottom' ? -cardH / 2 - 20 * hud : cardH / 2 + 16 * hud;
    seat.hand
      .setFontSize((slot === 'bottom' ? 26 : 20) * hud)
      .setPosition(cards.x, cards.y + below);
    seat.delta.setFontSize(30 * hud).setPosition(cards.x, cards.y);
    seat.cards.forEach((card, k) => {
      // A card still flying in lands at once (a resize, or the scene restarting).
      this.tweens.killTweensOf(card);
      card
        .setCardWidth(cards.width)
        .setScale(1)
        .setAlpha(1)
        .setPosition(cards.x + (k - 1) * (cards.width + 8), cards.y);
    });
  }

  protected onStart() {
    this.peeked.clear();
    for (const seat of this.seats) seat.shown = '';
  }

  protected onState(ctx: Ctx) {
    if (this.seats.length !== ctx.players.length) this.onLayout(ctx);
    else this.refresh(ctx, true);
  }

  protected onUpdate(ctx: Ctx) {
    const timer = ctx.timer;
    if (!timer || ctx.result) {
      this.countdown.setText('');
      return;
    }
    const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const what = { 'bet-over': 'Đặt cược', 'reveal-over': 'Lật bài', 'next-round': 'Ván sau' }[
      timer.event
    ];
    const text = what ? `${what} · ${left}s` : '';
    if (this.countdown.text !== text) this.countdown.setText(text);
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
      this.peekRound = state.round;
      this.peeked.clear();
    }
    this.seats.forEach((seat, i) => {
      this.showSeat(ctx, seat, i, i === mine, animate);
    });
    const dealer = this.player(ctx, state.dealer);
    const dealerName = state.dealer === mine ? 'Bạn' : (dealer?.name ?? '…');
    let info = `Ván ${state.round}/${state.rounds} · Cái: ${dealerName}`;
    if (ctx.result) {
      const best = Math.max(...state.points);
      const top = state.points.map((p, s) => (p === best ? s : -1)).filter((s) => s >= 0);
      const names = top.map((s) => (s === mine ? 'Bạn' : (this.player(ctx, s)?.name ?? '…')));
      info =
        top.length === state.points.length
          ? 'Hết ván · Hoà cả bàn'
          : `Hết ván · ${names.join(', ')} thắng với ${best} điểm`;
    } else if (state.phase === 'showdown' && !state.results) {
      info += '\nNhà cái rời bàn · Ván này huỷ';
    }
    this.info.setText(info);
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
    this.fitText(seat.name, isMe ? 'Bạn' : (player?.name ?? '…'), 200, 14);
    seat.name.setAlpha(gone ? 0.5 : 1);
    const bet = state.bets[i];
    seat.line.setText(`${state.points[i] ?? 0} điểm${bet ? ` · Cược ${bet}` : ''}`);
    seat.tag.setText(gone ? 'Rời bàn' : i === state.dealer ? 'CÁI' : '');
    // The dealer's picture has a gold ring.
    seat.ring.clear();
    if (i === state.dealer && !gone) {
      seat.ring.lineStyle(4, 0xffd54f, 1).strokeCircle(0, 0, seat.avatar.displayWidth / 2 + 4);
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
      if (!dealt) return;
      const face = faces[k] ?? null;
      if (fresh && animate) {
        // Dealt: fly in from the middle of the table.
        const { x, y } = card;
        card.setCard(null).setPosition(this.center.x, this.center.y).setAlpha(0);
        this.tweens.add({
          targets: card,
          x,
          y,
          alpha: 1,
          duration: 260,
          delay: (i * 3 + k) * 40,
          ease: 'Quad.easeOut',
          onComplete: () => face !== null && card.flipTo(face),
        });
      } else if (card.card !== face) {
        if (animate) card.flipTo(face);
        else card.setCard(face);
      }
    });
    seat.shown = key;

    // The count: what each hand is worth and the points won or lost.
    const full =
      hand &&
      hand.length === 3 &&
      (state.revealed[i] || state.phase === 'showdown' || (isMe && this.peeked.size === 3));
    seat.hand.setText(full ? handName(handOf(hand)) : '');
    const result =
      state.phase === 'showdown' ? state.results?.find((r) => r.seat === i) : undefined;
    if (result && seat.delta.text === '' && animate) {
      seat.delta.setAlpha(0).setScale(0.6);
      this.tweens.add({
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

  /** Your own card tapped: look at it yourself (the others still see its back). */
  private peek(seat: number, k: number) {
    const ctx = this.ctx;
    if (seat !== this.mySeat(ctx) || !ctx.state.hands[seat]?.length || this.peeked.has(k)) return;
    this.peeked.add(k);
    this.refresh(ctx, true);
  }
}
