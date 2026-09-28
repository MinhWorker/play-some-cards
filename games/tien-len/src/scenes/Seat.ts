/**
 * A player's plate at the edge of the mat: their picture (with the turn clock around it), name,
 * points, how many cards they hold, and a stamp for "Bỏ lượt", their place or "Rời bàn". The
 * stamp lies on the plate itself, so it never covers the cards in the middle.
 *
 * Two shapes: `side` stands up narrow against the left or right edge (picture on top), `flat`
 * lies under the room bar for the seat across (picture on the left). Sizes follow the HUD scale.
 */
import { titleStyle } from '@psc/sdk/client';
import Phaser from 'phaser';
import { drawRing } from './PlayerList.js';

export type SeatShape = 'side' | 'flat';

export interface SeatStamp {
  text: string;
  /** Fill color of the stamp, and its text color. */
  fill: number;
  ink: string;
}

export interface SeatInfo {
  name: string;
  /** Texture key of their picture. */
  avatar: string;
  points: string;
  /** Cards in hand; hidden at 0. */
  cards: number;
  /** Their turn: the plate lights up and the clock runs around the picture. */
  turn: boolean;
  /** Passed or out of the round: the plate dims under its stamp. */
  dim: boolean;
  /** Left the table: the whole plate fades. */
  gone: boolean;
  stamp: SeatStamp | null;
}

const LACQUER = 0x6e1d12;
const LACQUER_EDGE = 0x3d0d06;
const GOLD = 0xd9a54c;
const GLOW = 0xffe27a;
const CREAM = 0xfff3d6;
const LAST_CARD = 0xd32f2f;

/** Texture of a plate: red lacquer, gold rim, a darker lip under it (nine-slice, `PLATE_SLICE`). */
const PLATE_PX = 160;
const PLATE_LIP = 10;
const PLATE_SLICE = { side: 64, top: 64, bottom: 64 + PLATE_LIP };
/** Texture of a pill or stamp: white, tinted to its color (nine-slice, `PILL_SLICE`). */
const PILL_PX = { w: 96, h: 60 };
const PILL_SLICE = 26;

/** The plate's texture key (a nine-slice: 64 px corners, 74 px at the bottom with the lip). */
export function plateTexture(scene: Phaser.Scene) {
  textures(scene);
  return 'seat-plate';
}

function textures(scene: Phaser.Scene) {
  if (!scene.textures.exists('seat-plate')) {
    const g = scene.make.graphics({}, false);
    const r = 60;
    const size = PLATE_PX;
    g.fillStyle(LACQUER_EDGE, 1).fillRoundedRect(0, PLATE_LIP, size, size, r);
    g.fillStyle(GOLD, 1).fillRoundedRect(0, 0, size, size, r);
    g.fillStyle(LACQUER, 1).fillRoundedRect(5, 5, size - 10, size - 10, r - 5);
    // A soft sheen on the upper half of the lacquer.
    g.fillStyle(0xffffff, 0.06).fillRoundedRect(10, 8, size - 20, size * 0.42, {
      tl: r - 10,
      tr: r - 10,
      bl: 8,
      br: 8,
    });
    g.generateTexture('seat-plate', size, size + PLATE_LIP);
    g.destroy();
  }
  if (!scene.textures.exists('seat-pill')) {
    const g = scene.make.graphics({}, false);
    const { w, h } = PILL_PX;
    // White body with a light grey rim: a tint colors both, the rim a little darker.
    g.fillStyle(0xb8b8b8, 1).fillRoundedRect(0, 0, w, h, 24);
    g.fillStyle(0xffffff, 1).fillRoundedRect(4, 4, w - 8, h - 8, 20);
    g.generateTexture('seat-pill', w, h);
    g.destroy();
  }
}

/** Sizes a nine-slice to `width` × `height` design units, its corners scaled by `scale`. */
function fitSlice(
  slice: Phaser.GameObjects.NineSlice,
  width: number,
  height: number,
  scale: number,
) {
  slice.setSize(width / scale, height / scale).setScale(scale);
}

/** Sizes a pill (or stamp) to `width` × `height`: its round ends keep their shape. */
function fitPill(slice: Phaser.GameObjects.NineSlice, width: number, height: number) {
  fitSlice(slice, Math.max(width, height), height, height / PILL_PX.h);
}

export class SeatPlate extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.NineSlice;
  private readonly plate: Phaser.GameObjects.NineSlice;
  private readonly avatar: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly score: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Container;
  private readonly badgeBack: Phaser.GameObjects.NineSlice;
  private readonly badgeCard: Phaser.GameObjects.Image;
  private readonly badgeCount: Phaser.GameObjects.Text;
  private readonly stamp: Phaser.GameObjects.Container;
  private readonly stampBack: Phaser.GameObjects.NineSlice;
  private readonly stampText: Phaser.GameObjects.Text;
  private shape: SeatShape = 'side';
  private hud = 1;
  private info: SeatInfo | null = null;
  /** The picture's center and the ring's radius, in the plate's own coordinates. */
  private ringAt = { x: 0, y: 0, r: 0 };
  /** The picture's size in design units. */
  private avatarSize = 0;
  /** Plate size in design units (set by `layout`). */
  size = { width: 0, height: 0 };

  constructor(scene: Phaser.Scene, cardBack: string) {
    super(scene);
    textures(scene);
    const slice = (key: string, s: number, top = s, bottom = s) =>
      scene.add.nineslice(0, 0, key, undefined, 2 * s + 2, top + bottom + 2, s, s, top, bottom);
    this.glow = slice('seat-plate', PLATE_SLICE.side, PLATE_SLICE.top, PLATE_SLICE.bottom)
      .setTint(GLOW)
      .setAlpha(0.7);
    this.plate = slice('seat-plate', PLATE_SLICE.side, PLATE_SLICE.top, PLATE_SLICE.bottom);
    this.avatar = scene.add.image(0, 0, '__DEFAULT');
    this.ring = scene.add.graphics();
    const text = (size: number) =>
      scene.add.text(0, 0, '', { ...titleStyle(size), strokeThickness: 0 }).setOrigin(0.5);
    this.title = text(20).setColor('#fff3d6');
    this.score = text(16).setColor('#f1cf94');
    this.badgeBack = slice('seat-pill', PILL_SLICE);
    this.badgeCard = scene.add.image(0, 0, cardBack);
    this.badgeCount = text(18).setColor('#5a1a0e');
    this.badge = scene.add.container(0, 0, [this.badgeBack, this.badgeCard, this.badgeCount]);
    this.stampBack = slice('seat-pill', PILL_SLICE);
    // Room above the letters for stacked Vietnamese accents ("Bỏ lượt").
    this.stampText = scene.add
      .text(0, 0, '', { ...titleStyle(16), strokeThickness: 0, padding: { top: 4 } })
      .setOrigin(0.5);
    // Upright: a text turned inside a container lost the top of its letters in the renderer.
    this.stamp = scene.add.container(0, 0, [this.stampBack, this.stampText]);
    this.add([
      this.glow,
      this.plate,
      this.avatar,
      this.ring,
      this.title,
      this.score,
      this.badge,
      this.stamp,
    ]);
    scene.add.existing(this);
  }

  /**
   * The plate's shape and HUD scale, and for a flat plate its width (250 at 100% by default, at
   * least 200: a narrower plate cuts long names).
   */
  layout(shape: SeatShape, hud: number, flatWidth = 250 * hud) {
    this.shape = shape;
    this.hud = hud;
    const side = shape === 'side';
    const width = side ? 104 * hud : Math.max(200 * hud, flatWidth);
    const height = (side ? 128 : 64) * hud;
    this.size = { width, height };
    // Corners of the plate art are 60 px round: about 20 units at 100%.
    const corner = (20 * hud) / 60;
    fitSlice(this.plate, width, height + PLATE_LIP * corner, corner);
    fitSlice(this.glow, width + 10 * hud, height + 10 * hud + PLATE_LIP * corner, corner);
    this.plate.setPosition(0, (PLATE_LIP * corner) / 2);
    this.glow.setPosition(0, (PLATE_LIP * corner) / 2);

    const a = (side ? 64 : 50) * hud;
    const ax = side ? 0 : -width / 2 + 7 * hud + a / 2;
    const ay = side ? -height / 2 + 8 * hud + a / 2 : 0;
    this.avatarSize = a;
    this.avatar.setDisplaySize(a, a).setPosition(ax, ay);
    this.ringAt = { x: ax, y: ay, r: a / 2 + 2 * hud };

    this.title.setFontSize(20 * hud);
    this.score.setFontSize(16 * hud);
    if (side) {
      this.title.setOrigin(0.5).setPosition(0, ay + a / 2 + 16 * hud);
      this.score.setOrigin(0.5).setPosition(0, ay + a / 2 + 37 * hud);
    } else {
      const tx = ax + a / 2 + 9 * hud;
      this.title.setOrigin(0, 0.5).setPosition(tx, -10 * hud);
      this.score.setOrigin(0, 0.5).setPosition(tx, 12 * hud);
    }

    // Cards in hand: a tiny card back and the number on a cream pill.
    const pillH = 30 * hud;
    const cardH = 22 * hud;
    this.badgeCard.setDisplaySize(cardH / 1.5, cardH).setPosition(0, 0);
    this.badgeCount.setFontSize(19 * hud);
    fitPill(this.badgeBack, pillH, pillH);
    if (side) this.badge.setPosition(ax + a / 2 - 2 * hud, ay + a / 2 - 6 * hud);
    else this.badge.setPosition(width / 2 - 36 * hud, 0);

    this.stampText.setFontSize(17 * hud);
    this.stamp.setPosition(side ? 0 : 6 * hud, side ? ay + a * 0.18 : 0);
    // Refill at the new sizes (names are cut to the new width).
    const info = this.info;
    this.info = null;
    if (info) this.show(info);
    return this;
  }

  /** Fills the plate in (only what changed is redrawn). */
  show(info: SeatInfo) {
    const hud = this.hud;
    const was = this.info;
    this.info = info;
    // Display size is a scale of the texture: set it again for a new picture.
    this.avatar.setTexture(info.avatar).setDisplaySize(this.avatarSize, this.avatarSize);
    // Beside the picture and the card count on a flat plate.
    const maxText = this.size.width - (this.shape === 'side' ? 12 : 136) * hud;
    if (was?.name !== info.name || !was) fit(this.title, info.name, maxText);
    if (was?.points !== info.points || !was) this.score.setText(info.points);

    this.badge.setVisible(info.cards > 0);
    if (info.cards > 0) {
      const count = String(info.cards);
      if (this.badgeCount.text !== count) this.badgeCount.setText(count);
      const last = info.cards === 1;
      this.badgeCount.setColor(last ? '#ffffff' : '#5a1a0e');
      this.badgeBack.setTint(last ? LAST_CARD : CREAM);
      const cardW = this.badgeCard.displayWidth;
      const w = 8 * hud + cardW + 5 * hud + this.badgeCount.width + 10 * hud;
      fitPill(this.badgeBack, w, 30 * hud);
      this.badgeCard.setX(-w / 2 + 8 * hud + cardW / 2);
      this.badgeCount.setX(-w / 2 + 8 * hud + cardW + 5 * hud + this.badgeCount.width / 2);
    }

    this.stamp.setVisible(Boolean(info.stamp));
    if (info.stamp) {
      if (this.stampText.text !== info.stamp.text) this.stampText.setText(info.stamp.text);
      this.stampText.setColor(info.stamp.ink);
      this.stampBack.setTint(info.stamp.fill);
      fitPill(this.stampBack, this.stampText.width + 18 * hud, 30 * hud);
    }

    this.glow.setVisible(info.turn);
    const faded = info.dim ? 0.55 : 1;
    for (const obj of [this.avatar, this.title, this.score, this.badge]) obj.setAlpha(faded);
    this.setAlpha(info.gone ? 0.6 : 1);
    return this;
  }

  /** The turn clock around the picture (`left`: 1 → 0, `null` = no clock); cheap every frame. */
  drawClock(left: number | null) {
    this.ring.clear();
    if (this.info?.turn && this.visible) {
      drawRing(this.ring, this.ringAt.x, this.ringAt.y, this.ringAt.r, left);
    }
  }
}

/** Cuts `text` with "…" until it fits `maxWidth`. */
export function fit(obj: Phaser.GameObjects.Text, text: string, maxWidth: number) {
  obj.setText(text);
  let chars = [...text];
  while (obj.width > maxWidth && chars.length > 1) {
    chars = chars.slice(0, -1);
    obj.setText(`${chars.join('').trimEnd()}…`);
  }
}
