/**
 * (Copied from games/tien-len: games share no files.)
 * How the cards look, as data: a face design and a back design, picked separately. Everything
 * that draws a card (the hand, the pile, the deal, the card counts at the seats) reads it from
 * here, so a new look is new images in `assets/` plus an entry below, and no drawing code.
 *
 * - A back is one picture: `assets/back-<id>.webp`, a card seen from the front (2:3).
 * - A face is a blank card (`assets/face-<id>.webp`), four suit symbols, the rank colors and
 *   where the rank and the suits go on it. The rank itself is drawn in the app's font.
 *
 * A face painted as one picture per card (court cards with people, say) would be a third field
 * here and one more branch in `CardSprite.setCard`; nothing else changes.
 */
import type { Suit } from '../game/cards.js';

/** A spot on the face: its center from the card's middle (in card widths / heights) and size. */
export interface FaceSpot {
  x: number;
  y: number;
  /** In card widths: the rank's letter height, a suit symbol's width. */
  size: number;
}

export interface CardFace {
  /** The blank face, in `assets/`. */
  blank: string;
  /** Suit symbols, in `assets/`. */
  suits: Record<Suit, string>;
  /** Rank colors on ♦♥ and on ♠♣ cards. */
  ink: { red: string; black: string };
  /** The rank in the top-left corner, the small suit under it, the big suit. */
  rank: FaceSpot;
  small: FaceSpot;
  big: FaceSpot;
}

export interface CardBack {
  /** The back, in `assets/`. */
  image: string;
}

export const FACES = {
  classic: {
    blank: 'face-classic',
    suits: {
      spade: 'suit-spade',
      club: 'suit-club',
      diamond: 'suit-diamond',
      heart: 'suit-heart',
    },
    ink: { red: '#c8102e', black: '#1d1d1f' },
    rank: { x: -0.27, y: -0.34, size: 0.32 },
    small: { x: -0.27, y: -0.15, size: 0.22 },
    big: { x: 0.1, y: 0.14, size: 0.52 },
  },
} satisfies Record<string, CardFace>;

export const BACKS = {
  /** Green lattice, like the cheap casino decks sold everywhere. */
  lattice: { image: 'back-lattice' },
  /** Red with a golden lotus, Tết style. */
  lotus: { image: 'back-lotus' },
} satisfies Record<string, CardBack>;

export type FaceId = keyof typeof FACES;
export type BackId = keyof typeof BACKS;

/** Which face and back the table uses. */
export interface CardLook {
  face: FaceId;
  back: BackId;
}

export const DEFAULT_LOOK: CardLook = { face: 'classic', back: 'lattice' };

/** A look with its images turned into texture keys, ready for `CardSprite`. */
export interface CardArt extends Omit<CardFace, 'blank' | 'suits'> {
  blank: string;
  suits: Record<Suit, string>;
  back: string;
}

/** Resolves a look's image names with `texture` (the scene's `assets/` lookup). */
export function cardArt(look: CardLook, texture: (name: string) => string): CardArt {
  const face: CardFace = FACES[look.face];
  const suits = Object.fromEntries(
    Object.entries(face.suits).map(([suit, name]) => [suit, texture(name)]),
  ) as Record<Suit, string>;
  return { ...face, blank: texture(face.blank), suits, back: texture(BACKS[look.back].image) };
}
