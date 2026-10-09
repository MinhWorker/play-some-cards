/**
 * (Copied from games/tien-len: games share no files.)
 * One playing card on screen: a face (blank card, rank written in code, suit symbols) or its
 * back, both from the table's card look (deck.ts). A Phaser container, so it moves, turns and
 * flips as one object.
 */
import { type FlowContext, FONT, type GameScene } from '@xomdao/sdk/client';
import Phaser from 'phaser';
import { type Card, isRed, RANKS, rankOf, suitOf } from '../game/cards.js';
import type { CardArt } from './deck.js';

/** Height / width of the card art. */
export const CARD_RATIO = 1.5;

/** A rank is drawn once at this font size (px), then scaled: sharp on the biggest card at 3×. */
const RANK_PX = 128;

/**
 * The texture of a rank ("10") in a color, drawn once per page. Cards show it as an image and
 * only scale it: a Text redraws its texture on every size, text or color change, and dozens of
 * cards resizing and flipping at once made animations stutter on phones.
 */
function rankTexture(scene: Phaser.Scene, rank: string, color: string) {
  const key = `card-rank:${rank}:${color}`;
  if (scene.textures.exists(key)) return key;
  const style = { fontFamily: FONT, fontStyle: '800', fontSize: `${RANK_PX}px`, color };
  const text = scene.make.text({ text: rank, style }, false);
  scene.textures.createCanvas(key, text.width, text.height)?.draw(0, 0, text.canvas);
  text.destroy();
  return key;
}

export class CardSprite extends Phaser.GameObjects.Container {
  /** The card it shows face up, or `null` face down. */
  card: Card | null = null;
  targetCard: Card | null = null;
  dealing = false;
  private readonly face: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private readonly rank: Phaser.GameObjects.Image;
  private readonly small: Phaser.GameObjects.Image;
  private readonly big: Phaser.GameObjects.Image;
  private readonly fold: Phaser.GameObjects.Graphics;
  private squeezedCard: Card | null = null;
  private progress = 0;
  private cardWidth = 60;

  constructor(
    private readonly view: GameScene,
    private readonly art: CardArt,
    card: Card | null,
  ) {
    const scene = view;
    super(scene);
    this.face = scene.add.image(0, 0, art.blank);
    this.back = scene.add.image(0, 0, art.back);
    this.rank = scene.add.image(0, 0, '__DEFAULT');
    this.small = scene.add.image(0, 0, art.suits.spade);
    this.big = scene.add.image(0, 0, art.suits.spade);
    this.fold = scene.add.graphics();
    this.add([this.face, this.rank, this.small, this.big, this.back, this.fold]);
    scene.add.existing(this);
    this.setCard(card);
  }

  get cardHeight() {
    return this.cardWidth * CARD_RATIO;
  }

  /** Face up with `card`, or face down (`null`). */
  setCard(card: Card | null) {
    this.squeezedCard = null;
    this.progress = 0;
    this.back.setCrop();
    this.fold.clear();
    this.card = card;
    this.targetCard = card;
    const up = card !== null;
    this.back.setVisible(!up);
    for (const obj of [this.face, this.rank, this.small, this.big]) obj.setVisible(up).setCrop();
    if (up) {
      const color = isRed(card) ? this.art.ink.red : this.art.ink.black;
      this.rank.setTexture(rankTexture(this.scene, RANKS[rankOf(card)] ?? '', color));
      this.small.setTexture(this.art.suits[suitOf(card)]);
      this.big.setTexture(this.art.suits[suitOf(card)]);
    }
    return this.setCardWidth(this.cardWidth);
  }

  /** Peel the back down to expose the rank first. This never publishes a game event. */
  squeeze(card: Card, progress: number) {
    if (this.squeezedCard !== card) {
      this.setCard(card);
      this.squeezedCard = card;
    }
    this.targetCard = card;
    this.squeezeProgress = progress;
  }

  get squeezeProgress() {
    return this.progress;
  }

  set squeezeProgress(value: number) {
    this.progress = Phaser.Math.Clamp(value, 0, 1);
    const p = this.progress;
    this.card = p === 1 ? this.squeezedCard : null;
    this.back.setVisible(p < 1);
    const source = this.back.texture.getSourceImage();
    this.back.setCrop(0, source.height * p, source.width, source.height * (1 - p));
    const seam = -this.cardHeight / 2 + this.cardHeight * p;
    for (const symbol of [this.rank, this.small, this.big]) {
      const exposed = Phaser.Math.Clamp(
        (seam - symbol.y + symbol.displayHeight / 2) / symbol.displayHeight,
        0,
        1,
      );
      const image = symbol.texture.getSourceImage();
      symbol.setVisible(exposed > 0).setCrop(0, 0, image.width, image.height * exposed);
    }
    this.fold.clear();
    if (p > 0 && p < 1) {
      const w = this.cardWidth;
      // The curled edge and contact shadow travel with the pointer, over the existing art.
      this.fold.fillStyle(0x241309, 0.22).fillRect(-w / 2, seam - 7, w, 14);
      this.fold.fillStyle(0xd6c6a7, 1).fillRect(-w / 2, seam, w, 10);
      this.fold.fillStyle(0xfff8e7, 1).fillRect(-w / 2, seam + 1, w, 4);
    }
  }

  /** Sizes the card by its width (the height follows the art). */
  setCardWidth(width: number) {
    this.cardWidth = width;
    const w = width;
    const h = this.cardHeight;
    this.face.setDisplaySize(w, h);
    this.back.setDisplaySize(w, h);
    this.setSize(w, h);
    // A tappable card keeps a tap area as big as the card.
    if (this.input) (this.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, w, h);
    const { rank, small, big } = this.art;
    this.rank.setScale((w * rank.size) / RANK_PX).setPosition(w * rank.x, h * rank.y);
    this.small.setPosition(w * small.x, h * small.y).setScale((w * small.size) / this.small.width);
    this.big.setPosition(w * big.x, h * big.y).setScale((w * big.size) / this.big.width);
    return this;
  }

  /** Turns the card over to show `card` (or its back), like a flip in the hand. */
  flipTo(card: Card | null, lane: string, duration = 180) {
    this.targetCard = card;
    this.view.runtime.run(
      async (fx) => {
        await this.flip(fx, card, duration);
      },
      { lane },
    );
  }

  async flip(fx: FlowContext, card: Card | null, duration = 180) {
    const scaleX = 1;
    await fx.tween({ targets: this, scaleX: 0, duration: duration / 2, ease: 'Sine.easeIn' });
    fx.checkpoint();
    // A later queued flip may already have a different target.
    const target = this.targetCard;
    this.setCard(card);
    this.targetCard = target;
    await fx.tween({ targets: this, scaleX, duration: duration / 2, ease: 'Sine.easeOut' });
  }
}
