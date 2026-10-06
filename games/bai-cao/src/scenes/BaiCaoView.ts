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
    this.mat = new Mat(this, this.texture('mat'));
    this.art = cardArt(DEFAULT_LOOK, (name) => this.texture(name));
    this.info = this.label('', { size: 28 }).setDepth(20);
    this.countdown = this.label('', { size: 24 }).setColor('#ffe8a3').setDepth(20);
    this.plaque = this.add.graphics().setDepth(19);
    const opts = { image: 'button', size: 30 };
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
        let down: { x: number; y: number } | null = null;
        card.setSize(MY_CARD, MY_CARD * CARD_RATIO).setInteractive({ useHandCursor: true });
        card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          down = { x: pointer.worldX, y: pointer.worldY };
        });
        card.on('pointerup', () => this.peek(i, k));
        card.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          if (
            pointer.isDown &&
            down &&
            Math.hypot(pointer.worldX - down.x, pointer.worldY - down.y) > 24
          )
            this.peek(i, k);
        });
      });
      return {
        avatar: this.add.image(0, 0, this.avatar({})).setDepth(12),
        ring: this.add.graphics().setDepth(11),
        name: this.label('', { size: 22 }).setDepth(12),
        line: this.label('', { size: 18 }).setColor('#ffe8a3').setDepth(12),
        tag: this.label('', { size: 18 }).setColor('#ffd54f').setDepth(13),
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
    this.runtime.cancelLane('settlement');
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
    const cy = Math.max(420, (top + height) / 2);
    this.center = { x: cx, y: cy };
    this.info
      .setFontSize(24)
      .setPosition(cx, cy - 5)
      .setWordWrapWidth(320);
    this.countdown.setFontSize(24).setPosition(cx, cy + 53);
    this.plaque
      .clear()
      .fillStyle(0x40271b, 0.8)
      .fillRoundedRect(cx - 176, cy - 30, 352, 112, 24);
    this.plaque.lineStyle(2, 0xf2cb7d, 0.6).strokeRoundedRect(cx - 176, cy - 30, 352, 112, 24);

    const mine = this.mySeat(ctx) ?? 0;
    const n = this.seats.length;
    const slots = SLOTS[n] ?? SLOTS[6] ?? [];
    this.seats.forEach((seat, i) => {
      const slot = slots[(i - mine + n) % n] ?? 'top';
      this.placeSeat(seat, slot, ctx);
    });
    // Betting replaces the empty hand; reveal sits beside the dealt cards.
    const btnW = 144 * hud;
    const btnH = Math.max(88, 72 * hud);
    const x = Math.min(width - 24 - btnW / 2, cx + 280);
    this.buttons.bets.forEach((b, k) => {
      b.setSize(btnW, btnH).setPosition(cx + 64 + (k - 1) * (btnW + 16), height - 102);
    });
    this.buttons.reveal.setSize(btnW, btnH).setPosition(x, height - 102);
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
        plate = { x: cx - 300, y: cards.y - 20 * hud };
        break;
      case 'left':
      case 'right': {
        const x = slot === 'left' ? cx - 354 : cx + 354;
        plate = { x: slot === 'left' ? cx - 398 : cx + 398, y: cy - 44 * hud };
        cards = { x, y: cy + 100, width: THEIR_CARD };
        break;
      }
      default: {
        const shift = { topLeft: -240, top: 0, topRight: 240 }[slot] ?? 0;
        const x = cx + shift;
        const y = Math.max(140, top + 28);
        plate = { x, y };
        cards = { x, y: y + 154, width: THEIR_CARD };
      }
    }
    seat.at = cards;
    seat.avatar.setDisplaySize(pic, pic).setPosition(plate.x, plate.y);
    seat.ring.setPosition(plate.x, plate.y);
    seat.name.setFontSize(24 * hud).setPosition(plate.x, plate.y + pic / 2 + 16 * hud);
    seat.line.setFontSize(24).setPosition(plate.x, plate.y + pic / 2 + 42 * hud);
    seat.tag.setFontSize(24).setPosition(plate.x, plate.y - pic / 2 - 16);
    seat.dealer.setDisplaySize(48, 48).setPosition(plate.x + pic / 2 + 12, plate.y - pic / 2 + 8);
    seat.chip
      .setDisplaySize(36, 36)
      .setPosition(cards.x + (slot === 'bottom' ? -204 : slot === 'right' ? -114 : 114), cards.y);
    const cardH = cards.width * CARD_RATIO;
    const below = slot === 'bottom' ? -cardH / 2 - 20 * hud : cardH / 2 + 16 * hud;
    const side = slot === 'left' || slot === 'right';
    const upper = slot !== 'bottom' && !side;
    seat.hand
      .setFontSize(upper ? 24 : (slot === 'bottom' ? 28 : 24) * hud)
      .setPosition(cards.x - (upper ? 40 : 28), cards.y + below);
    seat.delta
      .setFontSize(30 * hud)
      .setPosition(
        cards.x + (side ? (slot === 'left' ? 152 : -152) : upper ? 60 : 88),
        cards.y + below,
      );
    seat.cards.forEach((card, k) => {
      // A card still flying in lands at once (a resize, or the scene restarting).
      this.runtime.cancelLane(`card:${this.seats.indexOf(seat)}:${k}`);
      this.runtime.cancelTweens(card);
      card
        .setCardWidth(cards.width)
        .setScale(1)
        .setAlpha(1)
        .setPosition(cards.x + (k - 1) * (cards.width + 8), cards.y);
    });
  }

  protected onStart() {
    this.peeked.clear();
    this.peekRound = this.ctx.state.round;
    for (const seat of this.seats) seat.shown = '';
    this.onLayout(this.ctx);
  }

  protected onResync(ctx: Ctx) {
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
      return;
    }
    const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    const what = { 'bet-over': 'Đặt cược', 'reveal-over': 'Lật bài', 'next-round': 'Ván sau' }[
      timer.event
    ];
    const text = what ? `${what} · ${left}s` : '';
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
      this.runtime.newRound('game-round');
      this.peekRound = state.round;
      for (const seat of this.seats) {
        seat.shown = '';
        this.runtime.cancelTweens(seat.delta);
        seat.delta.setText('').setAlpha(1).setScale(1);
        seat.cards.forEach((card, k) => {
          card
            .setScale(1)
            .setAlpha(1)
            .setPosition(seat.at.x + (k - 1) * (seat.at.width + 8), seat.at.y);
        });
      }
      this.peeked.clear();
    }
    if (animate) this.present(ctx);
    this.presented = state;
    this.ended = Boolean(ctx.result);
    this.seats.forEach((seat, i) => {
      this.showSeat(ctx, seat, i, i === mine, animate);
    });
    const dealer = this.player(ctx, state.dealer);
    const dealerName = state.dealer === mine ? 'Bạn' : (dealer?.name ?? '…');
    let info = `Ván ${state.round}/${state.rounds}\nCái: ${dealerName}`;
    if (ctx.result) {
      const top = ctx.players.filter((p) => ctx.result?.winners.includes(p.id)).map((p) => p.seat);
      const best = Math.max(...top.map((s) => state.points[s] ?? 0));
      const names = top.map((s) => (s === mine ? 'Bạn' : (this.player(ctx, s)?.name ?? '…')));
      info =
        top.length === 0
          ? 'Hết ván · Hoà cả bàn'
          : `Hết ván · ${best} điểm\n${names.length === 1 ? names[0] : `${names.length} người`} thắng`;
    } else if (state.phase === 'showdown' && !state.results) {
      info = `Ván ${state.round}/${state.rounds}\nNhà cái rời · Ván bị huỷ`;
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
    this.fitText(seat.name, isMe ? 'Bạn' : (player?.name ?? '…'), 160, 24);
    seat.name.setAlpha(gone ? 0.5 : 1);
    const bet = state.bets[i];
    seat.line.setText(`${state.points[i] ?? 0} điểm`);
    seat.tag.setText(gone ? 'Rời bàn' : player?.id === ctx.hostId ? '👑' : '');
    seat.dealer.setVisible(i === state.dealer && !gone);
    seat.chip.setVisible(Boolean(bet && !gone));
    if (bet) seat.chip.setTexture(this.texture(`chip-${bet}`));
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
        card.targetCard = face;
        this.runtime.run(
          async (fx) => {
            await fx.tween({
              targets: card,
              x,
              y,
              alpha: 1,
              duration: 260,
              delay: (i * 3 + k) * 40,
              ease: 'Quad.easeOut',
            });
            if (face !== null) await card.flip(fx, face);
          },
          { lane: `card:${i}:${k}` },
        );
      } else if (!animate) {
        card.setCard(face);
      } else if (card.targetCard !== face) {
        card.flipTo(face, `card:${i}:${k}`);
      }
    });
    seat.shown = key;

    // The count: what each hand is worth and the points won or lost.
    const full =
      hand &&
      hand.length === 3 &&
      (state.revealed[i] || state.phase === 'showdown' || (isMe && this.peeked.size === 3));
    seat.hand.setText(full ? handName(handOf(hand)) : '');
    seat.hand.setColor(full && handOf(hand).tay ? '#ffe078' : '#fff8e7');
    const result =
      state.phase === 'showdown' ? state.results?.find((r) => r.seat === i) : undefined;
    if (result && seat.delta.text === '' && animate) {
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

  /** Your own card tapped: look at it yourself (the others still see its back). */
  private peek(seat: number, k: number) {
    const ctx = this.ctx;
    if (
      seat !== this.mySeat(ctx) ||
      ctx.state.phase !== 'reveal' ||
      ctx.state.revealed[seat] ||
      !ctx.state.hands[seat]?.length ||
      this.peeked.has(k)
    )
      return;
    this.peeked.add(k);
    void this.sfx('bai-cao-peek');
    this.refresh(ctx, true);
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
