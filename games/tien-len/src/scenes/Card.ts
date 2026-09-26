/**
 * One playing card on screen: the blank face from assets/ with its rank written in code and the
 * suit symbol, or the back. A Phaser container, so it moves, turns and flips as one object.
 */
import { FONT } from '@psc/sdk/client';
import Phaser from 'phaser';
import { type Card, isRed, RANKS, rankOf, SUITS, type Suit, suitOf } from '../game/cards.js';

/** Texture keys the card needs (from the view's `this.texture(...)`). */
export interface CardTextures {
  front: string;
  back: string;
  suits: Record<Suit, string>;
}

/** Height / width of the card art. */
export const CARD_RATIO = 1.5;

export class CardSprite extends Phaser.GameObjects.Container {
  /** The card it shows face up, or `null` face down. */
  card: Card | null = null;
  private readonly face: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private readonly rank: Phaser.GameObjects.Text;
  private readonly small: Phaser.GameObjects.Image;
  private readonly big: Phaser.GameObjects.Image;
  private cardWidth = 60;

  constructor(
    scene: Phaser.Scene,
    private readonly textures: CardTextures,
    card: Card | null,
  ) {
    super(scene);
    this.face = scene.add.image(0, 0, textures.front);
    this.back = scene.add.image(0, 0, textures.back);
    this.rank = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontStyle: '800', align: 'center' })
      .setOrigin(0.5);
    this.small = scene.add.image(0, 0, textures.suits.spade);
    this.big = scene.add.image(0, 0, textures.suits.spade);
    this.add([this.face, this.back, this.rank, this.small, this.big]);
    scene.add.existing(this);
    this.setCard(card);
  }

  get cardHeight() {
    return this.cardWidth * CARD_RATIO;
  }

  /** Face up with `card`, or face down (`null`). */
  setCard(card: Card | null) {
    this.card = card;
    const up = card !== null;
    this.back.setVisible(!up);
    for (const obj of [this.face, this.rank, this.small, this.big]) obj.setVisible(up);
    if (up) {
      const suit = SUITS.indexOf(suitOf(card));
      this.rank.setText(RANKS[rankOf(card)] ?? '').setColor(isRed(card) ? '#c8102e' : '#1d1d1f');
      this.small.setTexture(this.textures.suits[SUITS[suit] as Suit]);
      this.big.setTexture(this.textures.suits[SUITS[suit] as Suit]);
    }
    return this.setCardWidth(this.cardWidth);
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
    this.rank.setFontSize(Math.round(w * 0.32)).setPosition(-w * 0.27, -h * 0.34);
    this.small.setPosition(-w * 0.27, -h * 0.15).setScale((w * 0.22) / this.small.width);
    this.big.setPosition(w * 0.1, h * 0.14).setScale((w * 0.52) / this.big.width);
    return this;
  }

  /** Turns the card over to show `card` (or its back), like a flip in the hand. */
  flipTo(card: Card | null, duration = 180) {
    const scaleX = this.scaleX || 1;
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      duration: duration / 2,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.setCard(card);
        this.scene.tweens.add({
          targets: this,
          scaleX,
          duration: duration / 2,
          ease: 'Sine.easeOut',
        });
      },
    });
  }
}
