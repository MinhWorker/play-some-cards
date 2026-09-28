/**
 * One playing card on screen: the blank face from assets/ with its rank written in code and the
 * suit symbol, or the back. A Phaser container, so it moves as one object. Turning it over plays
 * drawn frames (flip-back → flip-edge → flip-front), not a squashed image.
 */
import { FONT } from '@psc/sdk/client';
import Phaser from 'phaser';
import { type Card, isRed, RANKS, rankOf, type Suit, suitOf } from '../game/cards.js';

/** Texture keys the card needs (from the view's `this.texture(...)`). */
export interface CardTextures {
  front: string;
  back: string;
  suits: Record<Suit, string>;
  /** The flip, from the back to the face: turned, edge-on, face turned. */
  flip: [string, string, string];
}

/** Height / width of a card. */
export const CARD_RATIO = 1.5;

/** A rank is drawn once at this font size (px), then scaled: sharp on the biggest card at 3×. */
const RANK_PX = 128;

/**
 * The texture of a rank ("10") in a color, drawn once per page. Cards show it as an image and
 * only scale it: a Text redraws its texture on every size, text or color change, and every card
 * of a chi resizing and flipping at once made the comparison stutter on phones.
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
  private readonly face: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private readonly frame: Phaser.GameObjects.Image;
  private readonly rank: Phaser.GameObjects.Image;
  private readonly small: Phaser.GameObjects.Image;
  private readonly big: Phaser.GameObjects.Image;
  /** Picked, winning, losing…: a colored outline (see `setMark`), made when first needed. */
  private mark: Phaser.GameObjects.Graphics | null = null;
  private markColor: number | null = null;
  private cardWidth = 60;
  private flipping: Phaser.Time.TimerEvent[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly textures: CardTextures,
    card: Card | null,
  ) {
    super(scene);
    this.face = scene.add.image(0, 0, textures.front);
    this.back = scene.add.image(0, 0, textures.back);
    this.frame = scene.add.image(0, 0, textures.flip[0]).setVisible(false);
    this.rank = scene.add.image(0, 0, '__DEFAULT');
    this.small = scene.add.image(0, 0, textures.suits.spade);
    this.big = scene.add.image(0, 0, textures.suits.spade);
    this.add([this.face, this.back, this.frame, this.rank, this.small, this.big]);
    scene.add.existing(this);
    this.setCard(card);
  }

  get cardHeight() {
    return this.cardWidth * CARD_RATIO;
  }

  /** Face up with `card`, or face down (`null`). */
  setCard(card: Card | null) {
    this.card = card;
    this.showSide(card !== null);
    if (card !== null) {
      const color = isRed(card) ? '#c8102e' : '#1d1d1f';
      this.rank.setTexture(rankTexture(this.scene, RANKS[rankOf(card)] ?? '', color));
      this.small.setTexture(this.textures.suits[suitOf(card)]);
      this.big.setTexture(this.textures.suits[suitOf(card)]);
    }
    return this.setCardWidth(this.cardWidth);
  }

  private showSide(up: boolean | null) {
    this.back.setVisible(up === false);
    for (const obj of [this.face, this.rank, this.small, this.big]) obj.setVisible(up === true);
    this.frame.setVisible(up === null);
  }

  /** Sizes the card by its width (the height follows). */
  setCardWidth(width: number) {
    this.cardWidth = width;
    const w = width;
    const h = this.cardHeight;
    this.face.setDisplaySize(w, h);
    this.back.setDisplaySize(w, h);
    this.sizeFrame();
    this.setSize(w, h);
    // A tappable card keeps a tap area as big as the card.
    if (this.input) (this.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, w, h);
    this.rank.setScale((w * 0.32) / RANK_PX).setPosition(-w * 0.27, -h * 0.34);
    this.small.setPosition(-w * 0.27, -h * 0.15).setScale((w * 0.22) / this.small.width);
    this.big.setPosition(w * 0.1, h * 0.14).setScale((w * 0.52) / this.big.width);
    this.drawMark();
    return this;
  }

  /** A flip frame keeps the card's height; its own art gives how wide it looks. */
  private sizeFrame() {
    const h = this.cardHeight;
    const src = this.frame.frame;
    this.frame.setDisplaySize((h * src.width) / src.height, h);
  }

  /** An outline around the card (`null` for none). */
  setMark(color: number | null) {
    this.markColor = color;
    this.drawMark();
    return this;
  }

  private drawMark() {
    this.mark?.clear();
    if (this.markColor === null) return;
    if (!this.mark) {
      this.mark = this.scene.add.graphics();
      this.add(this.mark);
    }
    const w = this.cardWidth;
    const h = this.cardHeight;
    const line = Math.max(2, w * 0.06);
    this.mark
      .lineStyle(line, this.markColor, 1)
      .strokeRoundedRect(-w / 2, -h / 2, w, h, Math.max(3, w * 0.1));
  }

  /** A card cleared off the table mid-flip stops flipping (the frames would touch it gone). */
  protected override preDestroy() {
    for (const t of this.flipping) t.remove(false);
    this.flipping = [];
    super.preDestroy();
  }

  /**
   * Turns the card over to show `card` (or its back): three drawn frames in between, the
   * whole flip taking `duration` ms.
   */
  flipTo(card: Card | null, duration = 240) {
    if (!this.scene) return;
    for (const t of this.flipping) t.remove(false);
    const toFace = card !== null;
    const frames = toFace ? this.textures.flip : [...this.textures.flip].reverse();
    const step = duration / (frames.length + 1);
    this.flipping = frames.map((key, i) =>
      this.scene.time.delayedCall(step * i, () => {
        this.frame.setTexture(key);
        this.sizeFrame();
        this.showSide(null);
      }),
    );
    this.flipping.push(
      this.scene.time.delayedCall(step * frames.length, () => {
        this.flipping = [];
        this.setCard(card);
      }),
    );
  }
}
